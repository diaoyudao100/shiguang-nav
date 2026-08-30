/** 一键收藏：浏览器扩展确认窗经此组端点把网页加入导航站
 *
 *  认证：Authorization: Bearer <扩展连接码>（长期设备令牌）或会话 Cookie。
 *  GET  /api/categories    — 用户的分类列表（确认窗下拉框）
 *  POST /api/quick-suggest — AI 推荐简介 + 分类（确认窗打开时调用）
 *  POST /api/quick-add     — 收藏入库；desc/categoryId 可由确认窗回传（省一次 AI 调用）
 *  图标无需处理：iconUrl 留空，前端会按域名自动获取。
 */
import type { NavData, Settings, Site } from '../src/types'
import { authAny, authSecret, requireUser } from './auth'
import { hashCode, randomCode, uid } from './crypto'
import { chatWithHeal, isAllowedTarget, normalizeBase } from './ai'
import type { Env } from './util'
import { fail, json, readJson } from './util'

const META_TIMEOUT_MS = 6_000

/** 连接码可选时长（天）；0 = 长期 */
const DEVICE_DURATIONS = [365, 1825, 3650, 7300, 0]

interface QuickAddBody {
  url?: string
  title?: string
  desc?: string
  categoryId?: string
}

/* ---------------- 通用小工具 ---------------- */

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  if (/^[a-z-]+-extension:\/\//i.test(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
  }
  return {}
}

/** 浏览器扩展跨域预检 */
export function preflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/** 同源或浏览器扩展来源放行；不合法返回错误 Response（扩展走 Bearer 连接码认证） */
function originGuard(req: Request): Response | null {
  const origin = req.headers.get('Origin')
  if (!origin) return null
  try {
    const same = new URL(origin).origin === new URL(req.url).origin
    if (!same && !/^[a-z-]+-extension:\/\//i.test(origin)) return fail('来源校验失败', 403)
    return null
  } catch {
    return fail('来源校验失败', 403)
  }
}

/** 解析并校验 http(s) 网址；不合法返回 null */
function parseHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim())
    if (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      u.hostname &&
      (u.hostname.includes('.') || u.hostname === 'localhost')
    ) {
      return u
    }
  } catch {
    /* 非 URL */
  }
  return null
}

/** 私网地址拒绝抓取（避免探内网） */
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
    categories: [{ id: 'c-default', name: '默认', icon: 'folder' }],
    sites: [],
    settings: defaultSettings(),
  }
}

/** 读取用户云端数据；无数据行或解析失败返回 null */
async function loadNavData(env: Env, userId: string): Promise<NavData | null> {
  const row = await env.DB.prepare('SELECT data FROM user_data WHERE user_id = ?').bind(userId).first<{ data: string }>()
  if (!row) return null
  try {
    return JSON.parse(row.data) as NavData
  } catch {
    return null
  }
}

/** 分类归属：请求指定 → AI 推荐（匹配现有分类名）→ 第一个分类 */
function resolveCategory(data: NavData, explicitId: string | undefined, aiCategory: string): string {
  if (explicitId && data.categories.some((c) => c.id === explicitId)) return explicitId
  if (aiCategory) {
    const hit = data.categories.find(
      (c) => c.name.trim() === aiCategory || c.name.trim().toLowerCase() === aiCategory.toLowerCase(),
    )
    if (hit) return hit.id
  }
  return data.categories[0]?.id ?? ''
}

/* ---------------- AI：简介 + 分类推荐 ---------------- */

interface AiEnrich {
  desc: string
  aiCategory: string
  model?: string
}

/** 用该用户自己的 AI 配置生成一句简介并从现有分类中推荐；未配置/失败返回 null */
async function aiEnrich(
  settings: Settings,
  url: string,
  hostname: string,
  name: string,
  categories: { name: string }[],
): Promise<AiEnrich | null> {
  const aiKey = (settings.aiKey ?? '').trim()
  if (!aiKey) return null
  const provider = settings.aiProvider === 'gemini' ? 'gemini' : 'openai'
  const base = normalizeBase(provider, settings.aiBaseURL ?? '')
  if (!isAllowedTarget(base)) return null
  const model = (settings.aiModel ?? '').trim() || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
  const categoryNames = categories.map((c) => c.name).filter(Boolean)
  const prompt = [
    `给定网站「${name}」（${url}，域名 ${hostname}）。`,
    categoryNames.length ? `分类列表：${categoryNames.join('、')}。` : '',
    '请完成两件事：1. 为该网站写一句中文简介，不超过 24 个字；2. 从分类列表中选一个最合适的分类名（必须原样使用列表中的名称；若列表为空或都不合适，选最接近的一个）。',
    '严格以 JSON 返回：{"desc":"...","category":"..."}，不要输出任何其他内容。',
  ]
    .filter(Boolean)
    .join('\n')
  try {
    const r = await chatWithHeal(provider, base, aiKey, model, '你是一个网址导航助手，只输出 JSON。', prompt)
    const raw = r.text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim()
      .replace(/^["「『]|["」』]$/g, '')
      .trim()
    let desc = ''
    let aiCategory = ''
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        const obj = JSON.parse(m[0]) as { desc?: string; category?: string }
        desc = String(obj.desc ?? '')
          .replace(/^["「『]|["」』]$/g, '')
          .trim()
          .slice(0, 60)
        aiCategory = String(obj.category ?? '').trim().slice(0, 30)
      } catch {
        /* JSON 损坏 → 按纯文本当简介用 */
      }
    }
    if (!desc && raw) desc = raw.slice(0, 60)
    return { desc, aiCategory, model: r.model }
  } catch {
    return null
  }
}

/* ---------------- 连接码 ---------------- */

/** 扩展连接码：POST /api/device-token（需网页端登录）
 *  body: { code?: string, durationDays?: number }
 *  - code 提供且合法（8-64 字符、无空格）→ 自定义码；否则系统随机生成（12 位）
 *  - 生成即覆盖旧码（旧码立即失效）；服务端只存 SHA-256 指纹，明码仅本次响应返回
 *  → { code, expiresAt }（expiresAt 为 null 表示长期） */
export async function handleDeviceToken(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  const user = await requireUser(req, env)
  if (user instanceof Response) return user
  const body = await readJson<{ code?: string; durationDays?: number }>(req, 2_000)
  const days = (DEVICE_DURATIONS as readonly number[]).includes(body?.durationDays ?? -1)
    ? (body!.durationDays as number)
    : 365

  const custom = (body?.code ?? '').trim()
  let code: string
  if (custom) {
    if (custom.length < 8 || custom.length > 64) return fail('自定义连接码长度需在 8-64 个字符之间')
    if (/\s/.test(custom)) return fail('连接码不能包含空格')
    code = custom
  } else {
    code = randomCode(12)
  }

  const hash = await hashCode(code, authSecret(env))
  const taken = await env.DB.prepare('SELECT id FROM users WHERE device_code_hash = ?').bind(hash).first<{ id: string }>()
  if (taken && taken.id !== user.id) return fail('该连接码已被其他账户占用，换一个试试')

  const expiresAt = days > 0 ? Date.now() + days * 86_400_000 : null
  await env.DB
    .prepare('UPDATE users SET device_code_hash = ?, device_code_expires_at = ? WHERE id = ?')
    .bind(hash, expiresAt, user.id)
    .run()
  return json({ code, expiresAt })
}

/** 连接码有效性预检（扩展「测试连接」用）：Bearer → { user }，无效返回 401 */
export async function handleDeviceCheck(req: Request, env: Env): Promise<Response> {
  const user = await authAny(req, env)
  if (!user) return fail('连接码无效或已过期', 401)
  return json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } })
}

/* ---------------- 扩展确认窗端点 ---------------- */

/** GET /api/categories：用户分类列表（确认窗下拉框） */
export async function handleCategories(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'GET') return fail('方法不允许', 405)
  const guard = originGuard(req)
  if (guard) return guard
  const user = await authAny(req, env)
  if (!user) return fail('未连接：请先在导航站「设置 → 数据 → 浏览器扩展」生成连接码并填入扩展', 401)
  const data = (await loadNavData(env, user.id)) ?? freshData()
  return json({ categories: data.categories.map(({ id, name }) => ({ id, name })) }, 200, corsHeaders(req))
}

/** POST /api/quick-suggest：AI 推荐简介 + 分类（确认窗打开时调用，不入库） */
export async function handleQuickSuggest(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  const guard = originGuard(req)
  if (guard) return guard
  const user = await authAny(req, env)
  if (!user) return fail('未连接：请先在导航站「设置 → 数据 → 浏览器扩展」生成连接码并填入扩展', 401)
  const body = await readJson<{ url?: string; title?: string }>(req, 16_000)
  const parsed = parseHttpUrl(body?.url ?? '')
  if (!parsed) return fail('无效的网址')
  const url = parsed.href

  const data = (await loadNavData(env, user.id)) ?? freshData()
  if (!data.settings) data.settings = defaultSettings()
  const name = ((body?.title ?? '').trim() || parsed.hostname).replace(/\s+/g, ' ').slice(0, 60)

  const ai = await aiEnrich(data.settings as Settings, url, parsed.hostname, name, data.categories)
  const categoryId = resolveCategory(data, undefined, ai?.aiCategory ?? '')
  const category = data.categories.find((c) => c.id === categoryId)?.name ?? ''
  return json(
    { desc: ai?.desc ?? '', descSource: ai?.desc ? 'ai' : 'none', categoryId, category },
    200,
    corsHeaders(req),
  )
}

/** POST /api/quick-add：收藏入库
 *  body.desc / body.categoryId 由确认窗回传：跳过 AI 生成、按所选分类入库 */
export async function handleQuickAdd(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  const guard = originGuard(req)
  if (guard) return guard
  const user = await authAny(req, env)
  if (!user) return fail('未连接：请先在导航站「设置 → 数据 → 浏览器扩展」生成连接码并填入扩展', 401)

  const body = await readJson<QuickAddBody>(req, 32_000)
  const parsed = parseHttpUrl(body?.url ?? '')
  if (!parsed) return fail('无效的网址')
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

  const providedDesc = (body?.desc ?? '').trim()
  // 页面元信息仅在需要兜底时抓取（私网地址跳过）
  const meta = !providedDesc && isPublicHttpUrl(parsed) ? await fetchPageMeta(url) : null

  const name = ((body?.title ?? '').trim() || meta?.title || parsed.hostname).replace(/\s+/g, ' ').slice(0, 60)

  // 简介：确认窗回传 → AI（含模型自动纠正，回写用户设置）→ meta description
  let desc = ''
  let descSource: 'preset' | 'ai' | 'meta' | 'none' = 'none'
  let aiCategory = ''
  if (providedDesc) {
    desc = providedDesc.slice(0, 60)
    descSource = 'preset'
  } else {
    const ai = await aiEnrich(data.settings as Settings, url, parsed.hostname, name, data.categories)
    if (ai) {
      desc = ai.desc
      aiCategory = ai.aiCategory
      if (desc) descSource = 'ai'
      if (ai.model && ai.model !== (data.settings.aiModel ?? '').trim()) data.settings.aiModel = ai.model
    }
    if (!desc && meta?.description) {
      desc = meta.description.slice(0, 60)
      descSource = 'meta'
    }
  }

  let categoryId = resolveCategory(data, body?.categoryId, aiCategory)
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
  const category = data.categories.find((c) => c.id === categoryId)?.name ?? ''
  return json({ site, categoryId, category, descSource }, 200, corsHeaders(req))
}
