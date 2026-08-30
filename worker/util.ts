/** 共享类型与工具 */
import type { AuthUser } from '../src/types'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  LINUXDO_CLIENT_ID?: string
  LINUXDO_CLIENT_SECRET?: string
  WECHAT_CLIENT_ID?: string
  WECHAT_CLIENT_SECRET?: string
}

export interface UserRow {
  id: string
  email: string | null
  password_hash: string | null
  name: string
  avatar: string | null
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  device_token_ver: number
  device_code_hash: string | null
  device_code_expires_at: number | null
  created_at: number
  last_login_at: number | null
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

export function fail(error: string, status = 400): Response {
  return json({ error }, status)
}

export function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get('Cookie') ?? ''
  for (const part of cookie.split(/;\s*/)) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1)
  }
  return null
}

export function cookieHeader(name: string, value: string, maxAgeSec: number): string {
  const secure = '' // localhost http 下浏览器也接受无 Secure；生产在 https 下 SameSite=Lax 已足够内部使用
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure}`
}

export async function readJson<T>(req: Request, maxBytes = 2_000_000): Promise<T | null> {
  try {
    const text = await req.text()
    if (text.length > maxBytes) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function toAuthUser(u: UserRow): AuthUser {
  return { id: u.id, name: u.name, email: u.email, avatar: u.avatar, role: u.role }
}

/** 简单同源校验：变更类请求要求 Origin 与站点一致（配合 SameSite=Lax 防 CSRF） */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return true // 同源 fetch 一般不带 Origin 的场景（curl 等）放行，内部工具可接受
  try {
    return new URL(origin).origin === new URL(req.url).origin
  } catch {
    return false
  }
}
