/** 生成浏览器扩展图标：拾光导航同款渐变圆角方块 + 白色星标
 *  用法：node scripts/gen-ext-icons.mjs  → 输出 extension/icons/{16,32,48,128}.png
 *  零依赖：手写 PNG 编码（zlib 内置），4x 超采样抗锯齿
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'extension', 'icons')
mkdirSync(outDir, { recursive: true })

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------- 绘制 ---------- */
// 与应用紫色强调色一致（ACCENTS purple）
const C1 = [0x5b, 0x5c, 0xe2]
const C2 = [0x8b, 0x5c, 0xf6]

function starPolygon(size) {
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.36
  const r = R * 0.5
  const pts = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)])
  }
  return pts
}

function inPoly(pts, x, y) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** 圆角方块内：clamp 到内接矩形后按圆半径判定（标准做法） */
function inRounded(size, x, y, radius) {
  const nx = Math.min(Math.max(x, radius), size - radius)
  const ny = Math.min(Math.max(y, radius), size - radius)
  const dx = x - nx
  const dy = y - ny
  return dx * dx + dy * dy <= radius * radius
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const SS = 2 // 2x2 超采样
  const star = starPolygon(size)
  const radius = size * 0.22
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!inRounded(size, px, py, radius)) continue
          bg++
          if (inPoly(star, px, py)) fg++
        }
      }
      const i = (y * size + x) * 4
      if (bg === 0) continue // 完全透明
      const t = (y / size) * 0.8 + (x / size) * 0.2 // 主对角渐变
      const base = [0, 1, 2].map((k) => Math.round(C1[k] + (C2[k] - C1[k]) * t))
      // 白星与底色按覆盖率混合
      const mix = fg / (bg || 1)
      const cov = bg / (SS * SS)
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(base[k] + (255 - base[k]) * mix)
      rgba[i + 3] = Math.round(255 * cov)
    }
  }
  return rgba
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `${size}.png`), encodePng(size, draw(size)))
  console.log(`extension/icons/${size}.png`)
}
