/** 内置默认站点图标（与 index.html 中一致） */
export const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f6bf6'/%3E%3Cpath d='M9 22V10l7 8 7-8v12' stroke='white' stroke-width='2.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"

/** 用 Canvas 生成字母渐变图标（站点 favicon 用） */
export function generateLetterIcon(letter: string, hue: number): string {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, `hsl(${hue} 85% 62%)`)
  g.addColorStop(1, `hsl(${(hue + 45) % 360} 78% 48%)`)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, size, size, 14)
  else ctx.rect(0, 0, size, size)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${letter.charCodeAt(0) > 255 ? 30 : 34}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, size / 2, size / 2 + 2)
  return canvas.toDataURL('image/png')
}

/** 规范化用户输入的 URL：补协议、去首尾空格 */
export function normalizeUrl(input: string): string {
  const s = input.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s // mailto: 等其他协议
  return 'https://' + s
}

export function isLikelyUrl(input: string): boolean {
  const s = normalizeUrl(input)
  try {
    const u = new URL(s)
    return !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}

export function hostOf(input: string): string {
  try {
    return new URL(normalizeUrl(input)).hostname
  } catch {
    return input
  }
}

/** Google S2 favicon，跨域可用；sz=64 保证清晰度 */
export function faviconUrl(siteUrl: string): string {
  const host = hostOf(siteUrl)
  if (!host) return ''
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

/** 根据名字生成稳定的字母头像底色 */
const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
]
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
