// 生成应用图标 PNG（512x512）
// 灯泡 + 心智意象，品牌色 #1A73E8
const { Jimp } = require('jimp')

async function main() {
  const SIZE = 512
  const img = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 }) // 透明

  const cx = 256, cy = 220, r = 130
  const set = (x, y, c) => img.setPixelColor(c, x, y)

  // 灯泡圆形（白色填充）
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= r) set(x, y, 0xFFFFFFFF)
      else if (d <= r + 2) set(x, y, 0x80FFFFFF)
    }
  }

  // 灯泡底座
  for (let y = 340; y < 380; y++)
    for (let x = 206; x < 306; x++) set(x, y, 0xFFFFFFFF)
  for (let y = 380; y < 405; y++)
    for (let x = 216; x < 296; x++) set(x, y, 0xFFFFFFFF)

  // 内部蓝色圆形（心智核心）
  const ix = 256, iy = 230, ir = 55
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - ix, dy = y - iy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= ir) set(x, y, 0xFF1A73E8)
      else if (d <= ir + 2) set(x, y, 0x801A73E8)
    }
  }

  // 高光
  const hx = 230, hy = 210, hr = 18
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - hx, dy = y - hy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= hr) set(x, y, 0xCCFFFFFF)
    }
  }

  await img.write('assets/icon.png')
  console.log('icon.png generated (512x512)')
}

main().catch(e => { console.error(e); process.exit(1) })
