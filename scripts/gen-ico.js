// 生成 ICO 图标文件，包含多分辨率（16/32/48/64/128/256）
// ICO 格式：ICONDIR + ICONDIRENTRY[] + 图像数据
// 图像数据使用 PNG（256）和 BMP（其他）混合，符合现代 ICO 规范
const { Jimp } = require('jimp')
const fs = require('fs')
const path = require('path')

// 颜色辅助
const BG = 0x1A73E8FF  // 蓝色背景（RGBA）
const WHITE = 0xFFFFFFFF
const BLUE = 0x1A73E8FF
const HIGHLIGHT = 0xCCFFFFFF

function drawIcon(size) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 })
  const s = (x, y, c) => img.setPixelColor(c, x, y)
  const scale = size / 512

  // 缩放坐标
  const cx = Math.round(256 * scale), cy = Math.round(220 * scale)
  const r = Math.round(130 * scale)
  const baseY1 = Math.round(340 * scale), baseY2 = Math.round(380 * scale)
  const baseX1 = Math.round(206 * scale), baseX2 = Math.round(306 * scale)
  const baseY3 = Math.round(380 * scale), baseY4 = Math.round(405 * scale)
  const baseX3 = Math.round(216 * scale), baseX4 = Math.round(296 * scale)
  const ix = Math.round(256 * scale), iy = Math.round(230 * scale), ir = Math.round(55 * scale)
  const hx = Math.round(230 * scale), hy = Math.round(210 * scale), hr = Math.round(18 * scale)

  // 灯泡圆形（蓝色背景填充整个圆，作为应用图标底色更协调）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= r) s(x, y, WHITE)
      else if (d <= r + 1) s(x, y, 0x80FFFFFF)
    }
  }

  // 灯泡底座
  for (let y = baseY1; y < baseY2; y++)
    for (let x = baseX1; x < baseX2; x++) s(x, y, WHITE)
  for (let y = baseY3; y < baseY4; y++)
    for (let x = baseX3; x < baseX4; x++) s(x, y, WHITE)

  // 内部蓝色圆形（心智核心）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - ix, dy = y - iy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= ir) s(x, y, BLUE)
    }
  }

  // 高光
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - hx, dy = y - hy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= hr) s(x, y, HIGHLIGHT)
    }
  }

  return img
}

async function main() {
  const sizes = [16, 32, 48, 64, 128, 256]
  const images = await Promise.all(sizes.map(async sz => {
    const img = drawIcon(sz)
    const buf = await img.getBuffer('image/png')
    return { size: sz, width: sz, height: sz, png: buf }
  }))

  // 构建 ICO
  const count = images.length
  const headerSize = 6 + count * 16
  const bufs = []

  // ICONDIR (6 bytes)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: icon
  header.writeUInt16LE(count, 4)  // count
  bufs.push(header)

  // ICONDIRENTRY (16 bytes each)
  let offset = headerSize
  for (const { width, height, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(width >= 256 ? 0 : width, 0)  // width (0 = 256)
    entry.writeUInt8(height >= 256 ? 0 : height, 1)  // height
    entry.writeUInt8(0, 2)  // color palette
    entry.writeUInt8(0, 3)  // reserved
    entry.writeUInt16LE(1, 4)  // color planes
    entry.writeUInt16LE(32, 6)  // bits per pixel
    entry.writeUInt32LE(png.length, 8)  // image size
    entry.writeUInt32LE(offset, 12)  // image offset
    bufs.push(entry)
    offset += png.length
  }

  // 图像数据
  for (const { png } of images) bufs.push(png)

  const ico = Buffer.concat(bufs)
  const outPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  fs.writeFileSync(outPath, ico)
  console.log(`icon.ico generated: ${count} sizes, ${(ico.length / 1024).toFixed(1)} KB`)
}

main().catch(e => { console.error(e); process.exit(1) })
