/** OAuth 提供商：Google / Linux.do / 微信（均标准授权码流程） */
import { fail, json, type Env } from './util'

type ProviderId = 'google' | 'linuxdo' | 'wechat'

export interface Identity {
  provider: ProviderId
  uid: string
  name: string
  email: string | null
  avatar: string | null
}

interface ProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  userUrl: string
  scope: string
  clientId: (env: Env) => string | undefined
  clientSecret: (env: Env) => string | undefined
  /** 用访问令牌换取身份 */
  fetchIdentity: (accessToken: string, extra: Record<string, string>) => Promise<Identity>
  /** 生成 authorize 参数（微信需要 appid 而非 client_id） */
  authorizeParams?: (clientId: string, redirectUri: string, state: string) => Record<string, string>
}

const GOOGLE: ProviderConfig = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  scope: 'openid email profile',
  clientId: (e) => e.GOOGLE_CLIENT_ID,
  clientSecret: (e) => e.GOOGLE_CLIENT_SECRET,
  async fetchIdentity(token) {
    const res = await fetch(GOOGLE.userUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('google userinfo failed')
    const u = (await res.json()) as { sub: string; name?: string; email?: string; picture?: string; email_verified?: boolean }
    return {
      provider: 'google',
      uid: u.sub,
      name: u.name || (u.email ?? 'Google 用户').split('@')[0],
      email: u.email_verified ? (u.email ?? null) : null,
      avatar: u.picture ?? null,
    }
  },
}

const LINUXDO: ProviderConfig = {
  authorizeUrl: 'https://connect.linux.do/oauth2/authorize',
  tokenUrl: 'https://connect.linux.do/oauth2/token',
  userUrl: 'https://connect.linux.do/oauth2/userinfo',
  scope: '',
  clientId: (e) => e.LINUXDO_CLIENT_ID,
  clientSecret: (e) => e.LINUXDO_CLIENT_SECRET,
  async fetchIdentity(token) {
    const res = await fetch(LINUXDO.userUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('linuxdo userinfo failed')
    const u = (await res.json()) as { id?: number; sub?: string; username?: string; name?: string; email?: string }
    const uid = String(u.id ?? u.sub ?? '')
    if (!uid) throw new Error('linuxdo userinfo missing id')
    return {
      provider: 'linuxdo',
      uid,
      name: u.name || u.username || `linuxdo_${uid.slice(-4)}`,
      email: u.email ?? null,
      avatar: null,
    }
  },
}

const WECHAT: ProviderConfig = {
  authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
  tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
  userUrl: 'https://api.weixin.qq.com/sns/userinfo',
  scope: 'snsapi_login',
  clientId: (e) => e.WECHAT_CLIENT_ID,
  clientSecret: (e) => e.WECHAT_CLIENT_SECRET,
  authorizeParams: (clientId, redirectUri, state) => ({
    appid: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: WECHAT.scope,
    state,
  }),
  async fetchIdentity(token, extra) {
    const openid = extra.openid
    if (!openid) throw new Error('wechat missing openid')
    const res = await fetch(
      `${WECHAT.userUrl}?access_token=${encodeURIComponent(token)}&openid=${encodeURIComponent(openid)}`,
    )
    if (!res.ok) throw new Error('wechat userinfo failed')
    const u = (await res.json()) as { openid?: string; nickname?: string; headimgurl?: string }
    let name = u.nickname || '微信用户'
    // 微信接口的昵称是 URL 编码的 UTF-8，需要解码
    try {
      name = decodeURIComponent(name)
    } catch {
      /* 含字面 % 的昵称保持原样 */
    }
    return { provider: 'wechat', uid: u.openid || openid, name, email: null, avatar: u.headimgurl ?? null }
  },
}

export function providerConfig(id: string): ProviderConfig | null {
  if (id === 'google') return GOOGLE
  if (id === 'linuxdo') return LINUXDO
  if (id === 'wechat') return WECHAT
  return null
}

export function providerEnabled(env: Env, id: ProviderId): boolean {
  const c = providerConfig(id)
  return !!c && !!c.clientId(env) && !!c.clientSecret(env)
}

export function enabledProviders(env: Env): ProviderId[] {
  return (['google', 'linuxdo', 'wechat'] as ProviderId[]).filter((p) => providerEnabled(env, p))
}

/** 生成授权跳转 URL */
export function buildAuthorizeUrl(env: Env, provider: ProviderId, origin: string, state: string): string | null {
  const c = providerConfig(provider)
  const clientId = c?.clientId(env)
  if (!c || !clientId) return null
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`
  const url = new URL(c.authorizeUrl)
  if (c.authorizeParams) {
    Object.entries(c.authorizeParams(clientId, redirectUri, state)).forEach(([k, v]) => url.searchParams.set(k, v))
  } else {
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', c.scope)
    url.searchParams.set('state', state)
  }
  return url.toString()
}

/** 用 code 换身份 */
export async function exchangeIdentity(
  env: Env,
  provider: ProviderId,
  code: string,
  origin: string,
): Promise<Identity> {
  const c = providerConfig(provider)
  if (!c) throw new Error('unknown provider')
  const clientId = c.clientId(env)!
  const clientSecret = c.clientSecret(env)!
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`

  let token: string
  const extra: Record<string, string> = {}
  if (provider === 'wechat') {
    const url = new URL(c.tokenUrl)
    url.searchParams.set('appid', clientId)
    url.searchParams.set('secret', clientSecret)
    url.searchParams.set('code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string; openid?: string; errcode?: number; errmsg?: string }
    if (!data.access_token || !data.openid) throw new Error(`wechat token: ${data.errmsg ?? 'failed'}`)
    token = data.access_token
    extra.openid = data.openid
  } else {
    const res = await fetch(c.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const data = (await res.json()) as { access_token?: string; error?: string }
    if (!data.access_token) throw new Error(`${provider} token: ${data.error ?? 'failed'}`)
    token = data.access_token
  }
  return c.fetchIdentity(token, extra)
}

export function unauthorizedProvider(): Response {
  return fail('该登录方式尚未在服务端配置，请联系管理员', 400)
}

export { json }
