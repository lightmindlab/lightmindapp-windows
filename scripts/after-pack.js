// electron-builder afterPack 钩子
// 在 win-unpacked 生成后、portable installer 打包前，
// 用 rcedit-x64.exe（64 位）注入自定义图标和版本信息
// 绕过 electron-builder 默认 rcedit-ia32.exe（沙箱内核不支持 32 位 ELF）
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const WINE = '/usr/lib/wine/wine64'
const RCEDIT = '/root/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe'

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

  console.log('[afterPack] 注入图标和版本信息到', exePath)
  execFileSync(WINE, [RCEDIT, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WINEPREFIX: '/root/.wine64', WINEDEBUG: '-all' }
  })
  console.log('[afterPack] 图标和版本信息注入完成')
}
