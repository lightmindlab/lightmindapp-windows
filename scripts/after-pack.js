// electron-builder afterPack 钩子
// 在 win-unpacked 生成后、portable installer 打包前，
// 用 rcedit-x64.exe（64 位）注入自定义图标和版本信息。
//
// 跨平台执行：
// - Windows（如 GitHub Actions windows-latest）：直接运行 rcedit-x64.exe
// - Linux（本地沙箱）：通过 wine64 运行 rcedit-x64.exe（沙箱内核不支持 32 位 ELF，
//   故绕过 electron-builder 默认 rcedit-ia32.exe）
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isWin = process.platform === 'win32'

// 自动探测 wine 可执行文件路径（仅 Linux 沙箱使用）
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

// 解析 rcedit-x64.exe 路径：优先使用环境变量 RCEDIT_PATH（CI 注入），否则探测缓存
function resolveRcedit() {
  if (process.env.RCEDIT_PATH && fs.existsSync(process.env.RCEDIT_PATH)) {
    return process.env.RCEDIT_PATH
  }
  return findRcedit()
}

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

  const RCEDIT = resolveRcedit()
  if (!fs.existsSync(RCEDIT)) {
    console.log(`[afterPack] 跳过：未找到 rcedit-x64.exe`)
    return
  }

  // Windows 原生运行时直接使用本机路径；Linux 经 wine 运行时需转换为 Z:\ 路径
  const toExeArg = p => isWin ? p : 'Z:' + p.replace(/\//g, '\\')

  const rceditArgs = [
    toExeArg(exePath),
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
    '--set-icon', toExeArg(icoPath)
  ]

  console.log('[afterPack] 注入图标和版本信息到', exePath)
  if (isWin) {
    // Windows 原生运行 rcedit-x64.exe，无需 wine
    execFileSync(RCEDIT, rceditArgs, { stdio: 'inherit' })
  } else {
    const WINE = findWine()
    // WINEPREFIX 默认放在用户家目录下，兼容本地沙箱 /root
    const winePrefix = process.env.WINEPREFIX || path.join(os.homedir(), '.wine64')
    execFileSync(WINE, [RCEDIT, ...rceditArgs], {
      stdio: 'inherit',
      env: { ...process.env, WINEPREFIX: winePrefix, WINEDEBUG: '-all' }
    })
  }
  console.log('[afterPack] 图标和版本信息注入完成')
}
