const { app, BrowserWindow, shell, session } = require('electron')
const path = require('path')

// 目标网址
const HOME_URL = 'https://www.lightmind.top'

// 单实例锁，避免重复启动
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'LightMind',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

  // 在应用内打开外部链接（非同源链接交给系统浏览器）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const sameSite = url.startsWith(HOME_URL) ||
        new URL(url).hostname.endsWith(new URL(HOME_URL).hostname.replace(/^www\./, ''))
      if (sameSite) {
        return { action: 'allow' }
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 拦截页面内 a[target=_blank] 等导航
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(HOME_URL) && !url.startsWith('https://www.lightmind.top')) {
      // 允许同源跳转，外链交给系统
      const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
      const homeHost = new URL(HOME_URL).hostname
      if (!host.endsWith(homeHost.replace(/^www\./, '')) && host !== homeHost) {
        event.preventDefault()
        shell.openExternal(url)
      }
    }
  })

  win.loadURL(HOME_URL)
}

app.whenReady().then(() => {
  // 清理旧缓存可选；这里不主动清理
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
