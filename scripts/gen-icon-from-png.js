// 从源 PNG（含 APNG 动画）生成应用图标（assets/icon.png + assets/icon.ico）
// 使用方法：node scripts/gen-icon-from-png.js <源PNG路径>
// 流程：先剥离 APNG 动画帧块（acTL/fcTL/fdAT），保留首帧静态 IDAT，
//       再用 jimp 缩放生成 256x256 PNG 与多分辨率 ICO。
const { Jimp } = require('jimp')
const fs = require('fs')
const path = require('path')

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// 剥离 APNG 动画相关块，返回首帧静态 PNG 的 Buffer
// 保留：IHDR、PLTE、tRNS、gAMA、cHRM、sRGB、iCCP、bKGD、pHYs、tIME、tEXt、zTXt、iTXt、IDAT、IEND
// 丢弃：acTL（动画控制）、fcTL（帧控制）、fdAT（帧数据）
function stripApng(buf) {
  if (buf.length < 8 || buf.slice(0, 8).compare(PNG_SIG) !== 0) {
    throw new Error('不是有效的 PNG 文件')
  }
  const out = [PNG_SIG]
  let p = 8
  // APNG 规范：首帧数据可作为标准 IDAT（若 seq=0 的 fcTL 在 IDAT 之前，
  // 直接丢弃该 fcTL 即可，IDAT 仍构成完整首帧）
  let sawIHDR = false
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const dataStart = p + 8
    const dataEnd = dataStart + len
    const crcEnd = dataEnd + 4
    if (crcEnd > buf.length) break

    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
      // 跳过动画块
    } else {
      // 保留该块（含长度、类型、数据、CRC）
      out.push(buf.slice(p, crcEnd))
      if (type === 'IHDR') sawIHDR = true
      if (type === 'IEND') break
    }
    p = crcEnd
  }
  if (!sawIHDR) throw new Error('PNG 缺少 IHDR 块')
  return Buffer.concat(out)
}

async function main() {
  const src = process.argv[2]
  if (!src) {
    console.error('用法: node scripts/gen-icon-from-png.js <源PNG路径>')
    process.exit(1)
  }
  if (!fs.existsSync(src)) {
    console.error(`源文件不存在: ${src}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(src)
  // 剥离动画块，得到首帧静态 PNG
  const staticPng = stripApng(raw)
  const tmpPath = path.join(__dirname, '..', 'assets', '.icon-src-static.png')
  fs.writeFileSync(tmpPath, staticPng)

  const srcImg = await Jimp.read(tmpPath)
  console.log(`源图像首帧: ${srcImg.width}x${srcImg.height}`)

  const outDir = path.join(__dirname, '..', 'assets')
  fs.mkdirSync(outDir, { recursive: true })

  // 1) 生成 icon.png（256x256，cover 保持比例填充）
  const pngImg = srcImg.clone()
  pngImg.cover({ w: 256, h: 256 })
  const pngPath = path.join(outDir, 'icon.png')
  await pngImg.write(pngPath)
  console.log(`已生成 ${pngPath} (256x256)`)

  // 2) 生成 icon.ico（多分辨率，全 PNG 编码，兼容 Vista+）
  const sizes = [16, 32, 48, 64, 128, 256]
  const entries = []
  for (const sz of sizes) {
    const img = srcImg.clone()
    img.cover({ w: sz, h: sz })
    const buf = await img.getBuffer('image/png')
    entries.push({ width: sz, height: sz, png: buf })
  }

  const count = entries.length
  const headerSize = 6 + count * 16
  const bufs = []

  // ICONDIR (6 bytes)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // type: icon
  header.writeUInt16LE(count, 4)  // count
  bufs.push(header)

  // ICONDIRENTRY (16 bytes each)
  let offset = headerSize
  for (const { width, height, png } of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(width >= 256 ? 0 : width, 0)   // width (0 = 256)
    entry.writeUInt8(height >= 256 ? 0 : height, 1) // height
    entry.writeUInt8(0, 2)   // color palette
    entry.writeUInt8(0, 3)   // reserved
    entry.writeUInt16LE(1, 4)   // color planes
    entry.writeUInt16LE(32, 6)  // bits per pixel
    entry.writeUInt32LE(png.length, 8)  // image size
    entry.writeUInt32LE(offset, 12)     // image offset
    bufs.push(entry)
    offset += png.length
  }

  // 图像数据
  for (const { png } of entries) bufs.push(png)

  const ico = Buffer.concat(bufs)
  const icoPath = path.join(outDir, 'icon.ico')
  fs.writeFileSync(icoPath, ico)
  console.log(`已生成 ${icoPath}: ${count} 个分辨率, ${(ico.length / 1024).toFixed(1)} KB`)

  // 清理临时文件
  fs.unlinkSync(tmpPath)
}

main().catch(e => { console.error(e); process.exit(1) })
