const { app, BrowserWindow, shell, Tray, Menu, nativeImage, session } = require('electron')
const path = require('path')

// 目标网址
const HOME_URL = 'https://www.lightmind.top'

// 桌面端标识：追加到 User-Agent 末尾，供网页识别后隐藏「下载 APP」按钮等元素
// 网页端判断方式：/LightMindApp\//.test(navigator.userAgent)
const APP_UA_TOKEN = 'LightMindApp'

// 全局引用，避免托盘被回收
let tray = null
let mainWindow = null
// 加载启动屏（页面未加载完成时显示破壳小鸡动画）
let splash = null
// 标记是否真正退出，用于区分“关闭即隐藏”与“托盘退出”
let isQuiting = false

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
      win.show()
      win.focus()
    }
  })
}

function getTrayIcon() {
  // Windows 使用 ico，其他平台使用 png
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const iconPath = path.join(__dirname, 'assets', iconName)
  const image = nativeImage.createFromPath(iconPath)
  // 缩放到托盘合适尺寸（16x16），避免过大显示
  if (!image.isEmpty() && process.platform !== 'darwin') {
    return image.resize({ width: 16, height: 16 })
  }
  return image
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
    center: true, // 与 splash 居中一致，切换时无位移
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // 启动时先不显示，等页面加载完成后再显示，期间显示加载屏
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

  mainWindow = win

  // 页面加载完成：显示主窗口并关闭加载屏
  // did-finish-load 在每次导航完成（含 reload）时触发
  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) win.show()
    closeSplash()
  })

  // 页面加载失败时也显示主窗口（避免一直停留在加载屏）
  win.webContents.on('did-fail-load', () => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
    closeSplash()
  })

  // 兜底：若长时间未完成加载，也显示主窗口，避免永久停留在加载屏
  const loadTimer = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
      closeSplash()
    }
  }, 30000)
  win.once('closed', () => clearTimeout(loadTimer))

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

  // 关闭窗口时拦截：隐藏到托盘而非退出应用
  win.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      win.hide()
      // 仅首次隐藏时提示用户
      if (!win._trayNotified) {
        win._trayNotified = true
        if (tray) {
          tray.displayBalloon({
            iconType: 'info',
            title: 'LightMind',
            content: '应用已最小化到系统托盘，点击托盘图标可重新打开窗口。'
          })
        }
      }
    }
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.loadURL(HOME_URL)
}

// 显示加载启动屏：在页面加载期间于窗口中央显示破壳小鸡动画
function showSplash() {
  if (splash && !splash.isDestroyed()) {
    splash.show()
    splash.focus()
    return
  }
  splash = new BrowserWindow({
    width: 1280,
    height: 820,
    center: true,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  splash.loadFile(path.join(__dirname, 'assets', 'loading.html'))
  splash.on('closed', () => { splash = null })
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) {
    splash.close()
    splash = null
  }
}

function createTray() {
  const icon = getTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('LightMind')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow()
    },
    {
      label: '重新加载页面',
      click: () => {
        if (mainWindow) {
          showSplash()
          mainWindow.reload()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuiting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 单击托盘图标：显示/聚焦主窗口
  tray.on('click', () => {
    showMainWindow()
  })

  // 双击托盘图标：同样显示主窗口
  tray.on('double-click', () => {
    showMainWindow()
  })
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

app.whenReady().then(() => {
  // 在默认 session 的 User-Agent 末尾追加桌面端标识，
  // 使该 session 下所有请求（首屏 HTML / 子资源 / XHR / fetch / iframe）均携带，
  // 网页端可通过 navigator.userAgent 或服务端 UA 头识别。
  // 必须在创建窗口前设置，确保首个 loadURL 请求即带上标识。
  const baseUA = session.defaultSession.getUserAgent()
  session.defaultSession.setUserAgent(`${baseUA} ${APP_UA_TOKEN}/${app.getVersion()}`)

  // 清理旧缓存可选；这里不主动清理
  // 先显示加载屏，再创建（隐藏的）主窗口加载页面，加载完成后切换
  showSplash()
  createWindow()
  createTray()

  app.on('activate', () => {
    // macOS dock 点击时，若窗口不存在则创建；若被隐藏则显示
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

// 所有窗口关闭后不退出应用（保留托盘）
app.on('window-all-closed', () => {
  // 不再调用 app.quit()，让应用驻留托盘
  if (process.platform === 'darwin') {
    // macOS 上保持默认行为
  }
})

// 应用真正退出前清理托盘与加载屏
app.on('before-quit', () => {
  isQuiting = true
  closeSplash()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
