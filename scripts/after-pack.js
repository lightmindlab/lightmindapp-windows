// electron-builder afterPack 钩子
// 在 win-unpacked 生成后、portable installer 打包前，
// 用 rcedit-x64.exe（64 位）注入自定义图标和版本信息
// 绕过 electron-builder 默认 rcedit-ia32.exe（沙箱内核不支持 32 位 ELF）
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// 自动探测 wine 可执行文件路径（兼容本地沙箱 /root 与 GitHub Actions /home/runner）
function findWine() {
  const candidates = ['/usr/lib/wine/wine64', '/usr/bin/wine64', '/usr/bin/wine']
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return 'wine64'
}

// 自动探测 electron-builder 缓存中的 rcedit-x64.exe（版本号可能随 electron-builder 升级变化）
function findRcedit() {
  const cacheRoot = path.join(os.homedir(), '.cache', 'electron-builder', 'winCodeSign')
  if (fs.existsSync(cacheRoot)) {
    const versions = fs.readdirSync(cacheRoot).filter(name => /^winCodeSign-/.test(name))
    for (const v of versions) {
      const p = path.join(cacheRoot, v, 'rcedit-x64.exe')
      if (fs.existsSync(p)) return p
    }
  }
  // 回退到本地沙箱历史路径
  return '/root/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe'
}

const WINE = findWine()
const RCEDIT = findRcedit()

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return

  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const icoPath = path.join(context.packager.info.projectDir, 'assets', 'icon.ico')
  // 版本号从 package.json 动态读取，保持与构建版本一致
  const version = context.packager.appInfo.version
  const fileVersion = version.split('.').length === 3 ? version + '.0' : version

  if (!fs.existsSync(exePath)) {
    console.log(`[afterPack] 跳过：未找到 ${exePath}`)
    return
  }
  if (!fs.existsSync(icoPath)) {
    console.log(`[afterPack] 跳过：未找到 ${icoPath}`)
    return
  }
  if (!fs.existsSync(RCEDIT)) {
    console.log(`[afterPack] 跳过：未找到 rcedit-x64.exe`)
    return
  }

  // 转换为 wine 路径格式（Z:\ 开头）
  const toWinePath = p => 'Z:' + p.replace(/\//g, '\\')

  const args = [
    toWinePath(exePath),
    '--set-version-string', 'FileDescription', 'LightMind',
    '--set-version-string', 'ProductName', 'LightMind',
    '--set-version-string', 'CompanyName', 'lightmindlab',
    '--set-version-string', 'LegalCopyright', 'Copyright (c) 2026 lightmindlab',
    '--set-version-string', 'OriginalFilename', 'LightMind.exe',
    '--set-version-string', 'InternalName', 'LightMind',
    '--set-version-string', 'FileVersion', version,
    '--set-version-string', 'ProductVersion', version,
    '--set-file-version', fileVersion,
    '--set-product-version', fileVersion,
    '--set-icon', toWinePath(icoPath)
  ]

  // WINEPREFIX 默认放在用户家目录下，兼容本地沙箱 /root 与 CI /home/runner
  const winePrefix = process.env.WINEPREFIX || path.join(os.homedir(), '.wine64')
  console.log('[afterPack] 注入图标和版本信息到', exePath)
  execFileSync(WINE, [RCEDIT, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WINEPREFIX: winePrefix, WINEDEBUG: '-all' }
  })
  console.log('[afterPack] 图标和版本信息注入完成')
}
