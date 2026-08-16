// 生成黑马记账的应用图标（build/icon.ico）
// 图标设计：深蓝色渐变圆角方块 + 三条白色"账本"横条
// 纯代码生成，无需任何图形库
const fs = require('fs')
const path = require('path')

const SIZES = [16, 24, 32, 48, 64, 128, 256]

// —— 颜色工具 ——
function gradientColor(y, height) {
  // 从顶部浅蓝 (61,101,255) 渐变到底部深蓝 (28,48,140)
  const t = y / (height - 1)
  return {
    r: Math.round(61 + (28 - 61) * t),
    g: Math.round(101 + (48 - 101) * t),
    b: Math.round(255 + (140 - 255) * t)
  }
}

function insideRoundedRect(x, y, w, h, radius) {
  if (x < radius && y < radius) {
    return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2
  }
  if (x >= w - radius && y < radius) {
    return (x - (w - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2
  }
  if (x < radius && y >= h - radius) {
    return (x - radius) ** 2 + (y - (h - radius)) ** 2 <= radius ** 2
  }
  if (x >= w - radius && y >= h - radius) {
    return (x - (w - radius)) ** 2 + (y - (h - radius)) ** 2 <= radius ** 2
  }
  return x >= 0 && x < w && y >= 0 && y < h
}

// 白色横条（圆角矩形）
function insideBar(x, y, size, cx, cy, bw, bh, radius) {
  return insideRoundedRect(x - (cx - bw / 2), y - (cy - bh / 2), bw, bh, radius)
}

// —— BMP (32位带透明通道) 编码 ——
function createBmp(size, pixelFn) {
  const rowSize = size * 4
  const dataSize = rowSize * size
  const fileSize = 54 + dataSize
  const buf = Buffer.alloc(fileSize)
  // 文件头
  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10)
  // 信息头
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(size, 18)
  buf.writeInt32LE(size, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(32, 28)
  buf.writeUInt32LE(dataSize, 34)
  // 像素（BMP 从下往上存）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = pixelFn(x, y)
      const offset = 54 + (size - 1 - y) * rowSize + x * 4
      buf.writeUInt8(px.b, offset)
      buf.writeUInt8(px.g, offset + 1)
      buf.writeUInt8(px.r, offset + 2)
      buf.writeUInt8(px.a, offset + 3)
    }
  }
  return buf
}

// 绘制一个尺寸的图标（返回 ICO 中的图像数据，去掉 14 字节文件头）
function drawIcon(size) {
  const radius = Math.round(size * 0.2)
  const bars = [
    { cx: size * 0.5, cy: size * 0.34, bw: size * 0.52, bh: size * 0.09 },
    { cx: size * 0.5, cy: size * 0.5, bw: size * 0.42, bh: size * 0.09 },
    { cx: size * 0.5, cy: size * 0.66, bw: size * 0.52, bh: size * 0.09 }
  ]
  const barR = Math.round(size * 0.045)
  const bmp = createBmp(size, (x, y) => {
    if (!insideRoundedRect(x, y, size, size, radius)) {
      return { r: 0, g: 0, b: 0, a: 0 }
    }
    for (const bar of bars) {
      if (insideBar(x, y, size, bar.cx, bar.cy, bar.bw, bar.bh, barR)) {
        return { r: 255, g: 255, b: 255, a: 255 }
      }
    }
    const c = gradientColor(y, size)
    return { r: c.r, g: c.g, b: c.b, a: 255 }
  })
  // ICO 中的 BMP 数据 = 去掉 14 字节文件头（保留 DIB 头）
  return bmp.subarray(14)
}

// —— ICO 封装 ——
const images = SIZES.map((size) => ({ size, data: drawIcon(size) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // 保留
header.writeUInt16LE(1, 2) // 类型: 图标
header.writeUInt16LE(images.length, 4)

const entries = []
let offset = 6 + 16 * images.length
for (const img of images) {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 0) // 宽
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 1) // 高
  entry.writeUInt8(0, 2) // 调色板
  entry.writeUInt8(0, 3) // 保留
  entry.writeUInt16LE(1, 4) // 色深
  entry.writeUInt16LE(0, 6) // BMP 格式
  entry.writeUInt32LE(img.data.length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += img.data.length
  entries.push(entry)
}

const outDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'icon.ico')
fs.writeFileSync(outFile, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]))
console.log('已生成图标: ' + outFile)
