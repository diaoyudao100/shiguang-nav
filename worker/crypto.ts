/** WebCrypto 工具：JWT(HS256)、PBKDF2 密码哈希、随机码 */

const enc = new TextEncoder()

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const raw = atob(s)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function jwtSign(payload: Record<string, unknown>, secret: string, ttlSec: number): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  // ttlSec 非正数 / 无穷 = 永不过期（不写入 exp）
  const withExp =
    Number.isFinite(ttlSec) && ttlSec > 0 ? { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec } : payload
  const body = b64urlEncode(enc.encode(JSON.stringify(withExp)))
  const data = `${header}.${body}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data))
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`
}

export async function jwtVerify<T = Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(sig),
      enc.encode(`${header}.${body}`),
    )
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)))
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload as T
  } catch {
    return null
  }
}

/** PBKDF2-SHA256。迭代次数权衡了 Workers 免费版 10ms CPU 限制；付费版可调高 */
const PBKDF2_ITERATIONS = 12_000

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64urlDecode(saltB64), iterations: Number(iterStr), hash: 'SHA-256' },
    key,
    256,
  )
  const a = b64urlEncode(new Uint8Array(bits))
  // 常量时间比较
  if (a.length !== hashB64.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ hashB64.charCodeAt(i)
  return diff === 0
}

export function uid(): string {
  return crypto.randomUUID()
}

/** 扩展连接码指纹：SHA-256(全局密钥:码) 十六进制。只存指纹不存明文，全局密钥防库外暴力反推 */
export async function hashCode(secret: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${secret}:${code}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // 去掉易混淆字符
export function randomCode(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return s
}
