/** 认证：邮箱注册/登录、OAuth 起始与回调、会话、邀请码校验 */
import type { AuthUser } from '../src/types'
import { hashPassword, jwtSign, jwtVerify, randomCode, uid, verifyPassword } from './crypto'
import type { Identity } from './oauth'
import {
  buildAuthorizeUrl,
  exchangeIdentity,
  providerConfig,
  providerEnabled,
  unauthorizedProvider,
} from './oauth'
import type { Env, UserRow } from './util'
import {
  cookieHeader,
  fail,
  getCookie,
  json,
  readJson,
  sameOrigin,
  toAuthUser,
} from './util'

export const SESSION_COOKIE = 'nav_session'
const SESSION_TTL = 30 * 24 * 3600 // 30 天
const OAUTH_STATE_COOKIE = 'nav_oauth_state'

function secret(env: Env): string {
  return env.JWT_SECRET || 'insecure-dev-secret'
}
export { secret as authSecret }

interface SessionPayload {
  uid: string
  role: 'admin' | 'user'
}

export async function getSessionUser(req: Request, env: Env): Promise<UserRow | null> {
  const token = getCookie(req, SESSION_COOKIE)
  if (!token) return null
  const payload = await jwtVerify<SessionPayload>(token, secret(env))
  if (!payload?.uid) return null
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.uid).first<UserRow>()
  if (!row || row.status !== 'active') return null
  return row
}

export async function requireUser(req: Request, env: Env): Promise<UserRow | Response> {
  const user = await getSessionUser(req, env)
  if (!user) return fail('未登录或会话已过期', 401)
  return user
}

/** 会话 Cookie 或「扩展连接码」（Authorization: Bearer，长期设备令牌）二选一认证 */
export async function authAny(req: Request, env: Env): Promise<UserRow | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (/^Bearer\s+/i.test(auth)) {
    const payload = await jwtVerify<{ uid?: string; typ?: string }>(auth.replace(/^Bearer\s+/i, ''), secret(env))
    if (!payload?.uid || payload.typ !== 'device') return null
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.uid).first<UserRow>()
    return row && row.status === 'active' ? row : null
  }
  return getSessionUser(req, env)
}

export async function requireAdmin(req: Request, env: Env): Promise<UserRow | Response> {
  const user = await getSessionUser(req, env)
  if (!user) return fail('未登录或会话已过期', 401)
  if (user.role !== 'admin') return fail('需要管理员权限', 403)
  return user
}

async function startSession(env: Env, user: UserRow): Promise<string> {
  const token = await jwtSign({ uid: user.id, role: user.role }, secret(env), SESSION_TTL)
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id).run()
  return cookieHeader(SESSION_COOKIE, token, SESSION_TTL)
}

function sessionCookieClear(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
}

export function publicUserCount(env: Env): Promise<number> {
  return env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>().then((r) => r?.n ?? 0)
}

/* ---------------- 邮箱注册 / 登录 ---------------- */

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ email?: string; password?: string; name?: string; inviteCode?: string }>(req)
  const email = body?.email?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  const name = body?.name?.trim() || email.split('@')[0] || '新用户'
  const inviteCode = body?.inviteCode?.trim().toUpperCase() ?? ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('请输入有效的邮箱地址')
  if (password.length < 8) return fail('密码至少 8 位')

  const total = await publicUserCount(env)
  const isFirstUser = total === 0

  if (!isFirstUser) {
    if (!inviteCode) return fail('注册需要邀请码')
    const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(inviteCode).first<{
      code: string
      max_uses: number
      used_count: number
      expires_at: number | null
    }>()
    if (!invite) return fail('邀请码不存在')
    if (invite.expires_at && invite.expires_at < Date.now()) return fail('邀请码已过期')
    if (invite.used_count >= invite.max_uses) return fail('邀请码已被用完')
    await env.DB.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ?').bind(inviteCode).run()
  }

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (exists) return fail('该邮箱已注册，请直接登录')

  const user: UserRow = {
    id: uid(),
    email,
    password_hash: await hashPassword(password),
    name: name.slice(0, 30),
    avatar: null,
    role: isFirstUser ? 'admin' : 'user',
    status: 'active',
    created_at: Date.now(),
    last_login_at: Date.now(),
  }
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, avatar, role, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(user.id, user.email, user.password_hash, user.name, user.avatar, user.role, user.status, user.created_at, user.last_login_at)
    .run()
  const setCookie = await startSession(env, user)
  return json({ user: toAuthUser(user), isFirstUser }, 200, { 'Set-Cookie': setCookie })
}

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ email?: string; password?: string }>(req)
  const email = body?.email?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
    return fail('邮箱或密码不正确', 401)
  }
  if (row.status !== 'active') return fail('该账户已被禁用，请联系管理员', 403)
  const setCookie = await startSession(env, row)
  return json({ user: toAuthUser(row) }, 200, { 'Set-Cookie': setCookie })
}

export async function handleLogout(): Promise<Response> {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieClear() })
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const user = await authAny(req, env)
  if (!user) return json({ user: null })
  const dataRow = await env.DB
    .prepare('SELECT updated_at FROM user_data WHERE user_id = ?')
    .bind(user.id)
    .first<{ updated_at: number }>()
  return json({ user: toAuthUser(user), dataUpdatedAt: dataRow?.updated_at ?? null })
}

export async function handleUpdateName(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const user = await requireUser(req, env)
  if (user instanceof Response) return user
  const body = await readJson<{ name?: string }>(req)
  const name = body?.name?.trim()
  if (!name) return fail('昵称不能为空')
  await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name.slice(0, 30), user.id).run()
  return json({ user: { ...toAuthUser(user), name: name.slice(0, 30) } })
}

/* ---------------- OAuth ---------------- */

export async function handleAuthConfig(env: Env): Promise<Response> {
  return json({
    providers: {
      google: providerEnabled(env, 'google'),
      linuxdo: providerEnabled(env, 'linuxdo'),
      wechat: providerEnabled(env, 'wechat'),
    },
    needsSetup: (await publicUserCount(env)) === 0,
  })
}

export async function handleOAuthStart(req: Request, env: Env, provider: string): Promise<Response> {
  if (!providerConfig(provider)) return fail('不支持的登录方式', 404)
  if (!providerEnabled(env, provider as 'google')) return unauthorizedProvider()
  const url = new URL(req.url)
  const returnTo = url.searchParams.get('return') || '/'
  // state：签名短 JWT，同时写入 HttpOnly Cookie，回调时双校验
  const state = await jwtSign({ p: provider, r: returnTo }, secret(env), 600)
  const authorizeUrl = buildAuthorizeUrl(env, provider as 'google', url.origin, state)
  if (!authorizeUrl) return unauthorizedProvider()
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': cookieHeader(OAUTH_STATE_COOKIE, state, 600),
    },
  })
}

export async function handleOAuthCallback(req: Request, env: Env, provider: string): Promise<Response> {
  const url = new URL(req.url)
  const origin = url.origin
  const back = (params: Record<string, string>) =>
    Response.redirect(`${origin}/login?${new URLSearchParams(params)}`, 302)

  if (!providerConfig(provider)) return back({ oauth_error: '不支持的登录方式' })
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = getCookie(req, OAUTH_STATE_COOKIE)
  if (!code || !state || state !== cookieState) return back({ oauth_error: 'state 校验失败，请重试' })
  const statePayload = await jwtVerify<{ p: string; r: string }>(state, secret(env))
  if (!statePayload || statePayload.p !== provider) return back({ oauth_error: 'state 已过期，请重试' })

  let identity
  try {
    identity = await exchangeIdentity(env, provider as 'google', code, origin)
  } catch (e) {
    return back({ oauth_error: `登录失败：${(e as Error).message}` })
  }

  // 已绑定的身份直接登录
  const bound = await env.DB
    .prepare('SELECT u.* FROM oauth_identities o JOIN users u ON u.id = o.user_id WHERE o.provider = ? AND o.provider_uid = ?')
    .bind(identity.provider, identity.uid)
    .first<UserRow>()
  if (bound) {
    if (bound.status !== 'active') return back({ oauth_error: '该账户已被禁用，请联系管理员' })
    const setCookie = await startSession(env, bound)
    return new Response(null, { status: 302, headers: { Location: origin + (statePayload.r || '/'), 'Set-Cookie': setCookie } })
  }

  // 邮箱一致时自动绑定已有账户（Google 邮箱经验证；内部工具可接受）
  if (identity.email) {
    const byEmail = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(identity.email.toLowerCase()).first<UserRow>()
    if (byEmail) {
      if (byEmail.status !== 'active') return back({ oauth_error: '该账户已被禁用，请联系管理员' })
      await env.DB
        .prepare('INSERT INTO oauth_identities (provider, provider_uid, user_id) VALUES (?, ?, ?)')
        .bind(identity.provider, identity.uid, byEmail.id)
        .run()
      const setCookie = await startSession(env, byEmail)
      return new Response(null, { status: 302, headers: { Location: origin + (statePayload.r || '/'), 'Set-Cookie': setCookie } })
    }
  }

  // 新用户：签发一次性注册令牌，回到前端补邀请码完成注册
  const regToken = await jwtSign({ reg: identity, r: statePayload.r || '/' }, secret(env), 900)
  return back({ oauth: regToken })
}

export async function handleOAuthComplete(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req)) return fail('非法来源', 403)
  const body = await readJson<{ token?: string; inviteCode?: string }>(req)
  const payload = body?.token ? await jwtVerify<{ reg: Identity; r: string }>(body.token, secret(env)) : null
  if (!payload?.reg) return fail('注册令牌无效或已过期，请重新登录', 400)
  const identity = payload.reg

  const total = await publicUserCount(env)
  const isFirstUser = total === 0

  if (!isFirstUser) {
    const inviteCode = body?.inviteCode?.trim().toUpperCase() ?? ''
    if (!inviteCode) return fail('注册需要邀请码')
    const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(inviteCode).first<{
      max_uses: number
      used_count: number
      expires_at: number | null
    }>()
    if (!invite) return fail('邀请码不存在')
    if (invite.expires_at && invite.expires_at < Date.now()) return fail('邀请码已过期')
    if (invite.used_count >= invite.max_uses) return fail('邀请码已被用完')
    await env.DB.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ?').bind(inviteCode).run()
  }

  const user: UserRow = {
    id: uid(),
    email: identity.email,
    password_hash: null,
    name: identity.name.slice(0, 30),
    avatar: identity.avatar,
    role: isFirstUser ? 'admin' : 'user',
    status: 'active',
    created_at: Date.now(),
    last_login_at: Date.now(),
  }
  const stmts = [
    env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, avatar, role, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(user.id, user.email, user.password_hash, user.name, user.avatar, user.role, user.status, user.created_at, user.last_login_at),
    env.DB.prepare('INSERT INTO oauth_identities (provider, provider_uid, user_id) VALUES (?, ?, ?)').bind(
      identity.provider,
      identity.uid,
      user.id,
    ),
  ]
  await env.DB.batch(stmts)
  const setCookie = await startSession(env, user)
  return json({ user: toAuthUser(user) as AuthUser, returnTo: payload.r || '/' }, 200, { 'Set-Cookie': setCookie })
}

/* ---------------- 身份标签（管理后台展示用） ---------------- */

export async function userIdentities(env: Env, userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (userIds.length === 0) return map
  const placeholders = userIds.map(() => '?').join(',')
  const { results } = await env.DB
    .prepare(`SELECT provider, user_id FROM oauth_identities WHERE user_id IN (${placeholders})`)
    .bind(...userIds)
    .all<{ provider: string; user_id: string }>()
  for (const row of results ?? []) {
    const arr = map.get(row.user_id) ?? []
    arr.push(row.provider)
    map.set(row.user_id, arr)
  }
  return map
}

export { randomCode }
