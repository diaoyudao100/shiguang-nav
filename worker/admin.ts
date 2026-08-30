/** 管理员：概览、邀请码、用户管理 */
import { hashPassword } from './crypto'
import { randomCode, requireAdmin, userIdentities } from './auth'
import type { Env } from './util'
import { fail, json, readJson, sameOrigin } from './util'

interface InviteRow {
  code: string
  created_by: string | null
  max_uses: number
  used_count: number
  expires_at: number | null
  created_at: number
}

export async function handleAdminOverview(req: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (admin instanceof Response) return admin

  const users = await env.DB.prepare('SELECT * FROM users ORDER BY created_at ASC').all()
  const invites = await env.DB
    .prepare('SELECT * FROM invite_codes ORDER BY created_at DESC LIMIT 100')
    .all<InviteRow>()
  const identities = await userIdentities(env, (users.results ?? []).map((u) => u.id as string))
  const now = Date.now()
  const activeInvites = (invites.results ?? []).filter(
    (i) => i.used_count < i.max_uses && (!i.expires_at || i.expires_at > now),
  ).length

  return json({
    stats: { users: users.results?.length ?? 0, activeInvites },
    users: (users.results ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      status: u.status,
      providers: identities.get(u.id as string) ?? [],
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
    })),
    invites: invites.results ?? [],
  })
}

export async function handleCreateInvite(req: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (admin instanceof Response) return admin
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ maxUses?: number; expiresInDays?: number | null }>(req)
  const maxUses = Math.min(Math.max(Number(body?.maxUses) || 1, 1), 100)
  const days = body?.expiresInDays ?? null
  const expiresAt = days && days > 0 ? Date.now() + days * 86400_000 : null
  const code = 'SG-' + randomCode(8)
  await env.DB
    .prepare('INSERT INTO invite_codes (code, created_by, max_uses, used_count, expires_at, created_at) VALUES (?, ?, ?, 0, ?, ?)')
    .bind(code, admin.id, maxUses, expiresAt, Date.now())
    .run()
  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first<InviteRow>()
  return json({ invite })
}

export async function handleDeleteInvite(req: Request, env: Env, code: string): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (admin instanceof Response) return admin
  if (!sameOrigin(req)) return fail('非法来源', 403)
  await env.DB.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code).run()
  return json({ ok: true })
}

export async function handlePatchUser(req: Request, env: Env, targetId: string): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (admin instanceof Response) return admin
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ status?: 'active' | 'disabled'; role?: 'admin' | 'user' }>(req)
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first()
  if (!target) return fail('用户不存在', 404)

  if (body?.status) {
    if (targetId === admin.id && body.status === 'disabled') return fail('不能禁用自己')
    await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, targetId).run()
  }
  if (body?.role) {
    if (targetId === admin.id && body.role !== 'admin') return fail('不能降级自己')
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, targetId).run()
  }
  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first()
  return json({ user: updated })
}

export async function handleResetPassword(req: Request, env: Env, targetId: string): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (admin instanceof Response) return admin
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ password?: string }>(req)
  const password = body?.password ?? ''
  if (password.length < 8) return fail('密码至少 8 位')
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<{ password_hash: string | null }>()
  if (!target) return fail('用户不存在', 404)
  if (!target.password_hash) return fail('该用户使用第三方登录，没有密码可重置', 400)
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), targetId).run()
  return json({ ok: true })
}
