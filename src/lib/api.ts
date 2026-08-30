/** 后端 API 封装 */
import type { AuthUser, Category, NavData, Site } from '../types'

export interface InviteRow {
  code: string
  created_by: string | null
  max_uses: number
  used_count: number
  expires_at: number | null
  created_at: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  providers: string[]
  createdAt: number
  lastLoginAt: number | null
}

export interface AdminOverview {
  stats: { users: number; activeInvites: number }
  users: AdminUserRow[]
  invites: InviteRow[]
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data
}

export const api = {
  config: () => req<{ providers: Record<string, boolean>; needsSetup: boolean }>('GET', '/api/auth/config'),
  register: (p: { email: string; password: string; name?: string; inviteCode?: string }) =>
    req<{ user: AuthUser }>('POST', '/api/auth/register', p),
  login: (p: { email: string; password: string }) => req<{ user: AuthUser }>('POST', '/api/auth/login', p),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),
  completeOAuth: (p: { token: string; inviteCode?: string }) =>
    req<{ user: AuthUser }>('POST', '/api/auth/complete', p),
  me: () => req<{ user: AuthUser | null; dataUpdatedAt: number | null }>('GET', '/api/me'),
  updateName: (name: string) => req<{ user: AuthUser }>('PUT', '/api/me', { name }),
  getData: () => req<{ data: NavData | null; updatedAt: number | null }>('GET', '/api/data'),
  putData: (data: NavData) => req<{ updatedAt: number }>('PUT', '/api/data', { data }),
  /** 浏览器扩展连接码（自定义 code 或留空随机；durationDays 天数，0 = 长期，生成即覆盖旧码）
   *  服务端只存指纹，明码仅本次响应返回 */
  deviceToken: (p: { code?: string; durationDays?: number }) =>
    req<{ code: string; expiresAt: number | null }>('POST', '/api/device-token', p),
  admin: {
    overview: () => req<AdminOverview>('GET', '/api/admin/overview'),
    createInvite: (p: { maxUses: number; expiresInDays: number | null }) =>
      req<{ invite: InviteRow }>('POST', '/api/admin/invites', p),
    deleteInvite: (code: string) => req<{ ok: true }>('DELETE', `/api/admin/invites/${encodeURIComponent(code)}`),
    patchUser: (id: string, p: { status?: 'active' | 'disabled'; role?: 'admin' | 'user' }) =>
      req<{ user: AdminUserRow }>('PATCH', `/api/admin/users/${id}`, p),
    resetPassword: (id: string, password: string) =>
      req<{ ok: true }>('POST', `/api/admin/users/${id}/reset-password`, { password }),
  },
}

/* 供 worker 类型引用（仅类型，不参与打包） */
export type { AuthUser, Category, NavData, Site }
