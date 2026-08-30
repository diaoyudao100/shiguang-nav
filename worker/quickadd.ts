/** 一键收藏：浏览器扩展 / 书签脚本经此端点把网页加入导航站
 *
 *  认证：Authorization: Bearer <扩展连接码>（长期设备令牌）或会话 Cookie。
 *  服务端完成整条链路：标题兜底（页面 <title>）→ AI 简述（用该用户自己的 AI 配置，
 *  带模型自动纠正并回写）→ 回退页面 meta description → 去重 → 归入分类 → 保存。
 *  图标无需处理：iconUrl 留空，前端会按域名自动获取。
 */
import type { NavData, Settings, Site } from '../src/types'
import { authAny, authSecret, requireUser } from './auth'
import { jwtSign, jwtVerify, uid } from './crypto'
import { chatWithHeal, isAllowedTarget, normalizeBase } from './ai'
import type { Env, UserRow } from './util'
import { fail, json, readJson } from './util'

const DEVICE_TTL = 365 * 24 * 3600 // 连接码有效期 1 年
const META_TIMEOUT_MS = 6_000

interface QuickAddBody {
  url?: string
  title?: string
  categoryId?: string
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  if (/^[a-z-]+-extension:\/\//i.test(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
  }
  return {}
}

/** 扩展连接码：POST /api/device-token（需网页端登录）→ { token } */
export async function handleDeviceToken(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  const user = await requireUser(req, env)
  if (user instanceof Response) return user
  const token = await jwtSign({ uid: user.id, typ: 'device' }, authSecret(env), DEVICE_TTL)
  return json({ token })
}

/** 连接码有效性预检（扩展「测试连接」用）：Bearer → { user }，无效返回 401 */
export async function handleDeviceCheck(req: Request, env: Env): Promise<Response> {
  const user = (await authAny(req, env)) as UserRow | null
  if (!user) return fail('连接码无效或已过期', 401)
  return json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } })
}

/** 私网地址拒绝抓取（避免探内网）；quick-add 接受公网 http(s) 地址 */
function isPublicHttpUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (/^(127|10)\./.test(h)) return false
  if (/^192\.168\./.test(h)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
  if (/^169\.254\./.test(h)) return false
  return h !== '0.0.0.0' && h !== '::1'
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function extractMeta(html: string): { title: string; description: string } {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = t ? decodeEntities(t[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim() : ''
  let description = ''
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? ''
    const key = (attr('property') || attr('name')).toLowerCase()
    if (key !== 'og:description' && key !== 'description') continue
    const v = decodeEntities(attr('content')).replace(/\s+/g, ' ').trim()
    if (v) {
      description = v
      if (key === 'og:description') break
    }
  }
  return { title, description }
}

/** 抓取目标页 <title> 与 description 作为兜底；任何失败都静默（不阻塞主流程） */
async function fetchPageMeta(url: string): Promise<{ title: string; description: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (type && !/text\/html|application\/xhtml/i.test(type)) return null
    return extractMeta((await res.text()).slice(0, 300_000))
  } catch {
    return null
  }
}

/** 全新账户（云端还没有数据行）的最小数据；字段镜像 src/lib/storage.ts 的 DEFAULT_SETTINGS
 *  （那份文件含 localStorage，Worker 的 tsconfig 无 DOM lib，不能直接 import） */
function defaultSettings(): Settings {
  return {
    theme: 'system',
    accent: 'purple',
    accentCustom: '',
    bgStyle: 'zinc',
    bgImage: '',
    bgImageEnabled: false,
    siteTitle: '拾光导航',
    favicon: '',
    maskClosable: true,
    searchEngine: 'bing',
    greetingName: '拾光',
    aiProvider: 'openai',
    aiBaseURL: '',
    aiKey: '',
    aiModel: 'gpt-4o-mini',
  }
}

function freshData(): NavData {
  return {
    version: 1,
    categories: [{ id: 'c-default', name: '默认' }],
    sites: [],
    settings: defaultSettings(),
  }
}

/** POST /api/quick-add：{ url, title? } → { site, categoryId, descSource, duplicate? } */
export async function handleQuickAdd(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
  if (req.method !== 'POST') return fail('方法不允许', 405)

  // 来源校验：同源放行；浏览器扩展（chrome-extension:// 等）放行（其走 Bearer 连接码认证）
  const origin = req.headers.get('Origin')
  if (origin) {
    try {
      const same = new URL(origin).origin === new URL(req.url).origin
      if (!same && !/^[a-z-]+-extension:\/\//i.test(origin)) return fail('来源校验失败', 403)
    } catch {
      return fail('来源校验失败', 403)
    }
  }
  const user = await authAny(req, env)
  if (!user) return fail('未连接：请先在导航站「设置 → 数据 → 浏览器扩展」生成连接码并填入扩展', 401)

  const body = await readJson<QuickAddBody>(req, 32_000)
  let parsed: URL
  try {
    parsed = new URL((body?.url ?? '').trim())
  } catch {
    return fail('无效的网址')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('仅支持 http/https 网址')
  if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
    return fail('无效的网址')
  }
  const url = parsed.href

  const row = await env.DB.prepare('SELECT data FROM user_data WHERE user_id = ?').bind(user.id).first<{ data: string }>()
  let data: NavData
  if (row) {
    try {
      data = JSON.parse(row.data) as NavData
    } catch {
      return fail('云端数据解析失败，请先在网页端打开一次导航站')
    }
  } else {
    data = freshData()
  }
  if (!Array.isArray(data.categories) || !Array.isArray(data.sites)) {
    return fail('云端数据格式异常，请先在网页端打开一次导航站')
  }
  if (!data.settings) data.settings = defaultSettings()

  // 去重：忽略大小写与结尾斜杠
  const key = url.replace(/\/+$/, '').toLowerCase()
  const dup = data.sites.find((s) => (s.url ?? '').replace(/\/+$/, '').toLowerCase() === key)
  if (dup) return json({ duplicate: true, site: dup }, 200, corsHeaders(req))

  // 页面元信息：标题 / 简述兜底（私网地址跳过抓取）
  const meta = isPublicHttpUrl(parsed) ? await fetchPageMeta(url) : null

  let name = ((body?.title ?? '').trim() || meta?.title || parsed.hostname).replace(/\s+/g, ' ').slice(0, 60)

  // AI 简述：使用该用户自己的 AI 配置（含模型自动纠正）；未配置或失败回退 meta description
  const s = data.settings as Settings
  let desc = ''
  let descSource: 'ai' | 'meta' | 'none' = 'none'
  const aiKey = (s.aiKey ?? '').trim()
  if (aiKey) {
    const provider = s.aiProvider === 'gemini' ? 'gemini' : 'openai'
    const base = normalizeBase(provider, s.aiBaseURL ?? '')
    if (isAllowedTarget(base)) {
      const model = (s.aiModel ?? '').trim() || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
      const prompt = `为网站「${name}」（${url}，域名 ${parsed.hostname}）写一句中文简介，不超过 24 个字，直接输出简介本身，不要任何前后缀和标点引导。`
      try {
        const r = await chatWithHeal(provider, base, aiKey, model, '你是一个网址导航助手，只输出简介文本。', prompt)
        desc = r.text
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim()
          .replace(/^["「『]|["」』]$/g, '')
          .trim()
          .slice(0, 60)
        if (desc) descSource = 'ai'
        // 模型被自动纠正：回写到用户设置，后续请求直接用正确模型
        if (r.model && r.model !== (s.aiModel ?? '').trim()) s.aiModel = r.model
      } catch {
        /* AI 失败不阻塞收藏，走回退 */
      }
    }
  }
  if (!desc && meta?.description) {
    desc = meta.description.slice(0, 60)
    descSource = 'meta'
  }

  // 分类：请求指定 → 第一个分类 → 新建「默认」
  let categoryId = body?.categoryId && data.categories.some((c) => c.id === body.categoryId) ? body.categoryId : ''
  if (!categoryId) categoryId = data.categories[0]?.id ?? ''
  if (!categoryId) {
    const c = { id: uid(), name: '默认' }
    data.categories.push(c)
    categoryId = c.id
  }

  const site: Site = {
    id: uid(),
    name,
    url,
    desc,
    categoryId,
    pinned: false,
    hidden: false,
    iconUrl: '',
    iconColor: '',
    addedAt: Date.now(),
  }
  data.sites.push(site)

  const now = Date.now()
  await env.DB
    .prepare(
      `INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(user.id, JSON.stringify(data), now)
    .run()
  return json({ site, categoryId, descSource }, 200, corsHeaders(req))
}
