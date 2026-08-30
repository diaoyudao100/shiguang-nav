import { hostOf, normalizeUrl } from './favicon'
import type { Settings } from '../types'

export interface AiSuggestion {
  name: string
  desc: string
  category: string
}

/** 代理不可达的哨兵（静态部署无后端时回退浏览器直连） */
const PROXY_MISS = new Error('proxy-miss')

function isOpenAi(settings: Settings): boolean {
  return (settings.aiProvider ?? 'openai') === 'openai'
}

/** 后端自动纠正过的模型（提供商不支持所配模型时），会话内生效并通过 autoModelSaver 持久化 */
let autoModel: string | null = null
let autoModelSaver: ((m: string) => void) | null = null

/** 由 useStore 注册：把自动纠正的模型写回设置 */
export function registerAutoModelSaver(fn: (m: string) => void): void {
  autoModelSaver = fn
}

function endpointOf(settings: Settings): string {
  const custom = settings.aiBaseURL.trim().replace(/\/+$/, '')
  if (isOpenAi(settings)) {
    if (!custom) return 'https://api.openai.com/v1'
    // 未带版本段时自动补 /v1（兼容 api.openai.com、deepseek 等写法；bigmodel 等以 /v4 结尾的原样保留）
    return /\/v\d+$/.test(custom) ? custom : `${custom}/v1`
  }
  if (!custom) return 'https://generativelanguage.googleapis.com/v1beta'
  return /\/v\d+[a-z]*$/i.test(custom) ? custom : `${custom}/v1beta`
}

function modelOf(settings: Settings): string {
  const m = settings.aiModel.trim() || autoModel
  if (m) return m
  return isOpenAi(settings) ? 'gpt-4o-mini' : 'gemini-2.0-flash'
}

/** 浏览器直连提供商（回退路径，可能受 CORS 限制） */
async function chatDirect(settings: Settings, prompt: string, system: string): Promise<string> {
  const key = settings.aiKey.trim()
  if (isOpenAi(settings)) {
    const res = await fetch(endpointOf(settings) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelOf(settings),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || `请求失败 (${res.status})`)
    const text: string = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? ''
    if (!text) throw new Error('AI 未返回内容')
    return text
  }
  const model = modelOf(settings)
  const res = await fetch(`${endpointOf(settings)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || `请求失败 (${res.status})`)
  const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('AI 未返回内容')
  return text
}

/** 统一的对话入口：经本站后端代理转发，返回模型文本，失败抛错 */
async function chat(settings: Settings, prompt: string, system: string): Promise<string> {
  const key = settings.aiKey.trim()
  if (!key) throw new Error('未配置 API KEY')
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: settings.aiProvider ?? 'openai',
        baseUrl: settings.aiBaseURL.trim(),
        apiKey: key,
        model: modelOf(settings),
        system,
        prompt,
      }),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) throw PROXY_MISS
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string; model?: string }
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
    if (!data.text) throw new Error('AI 未返回内容')
    // 后端自动纠正过模型：记住并持久化，后续请求直接用正确模型
    if (data.model && data.model !== settings.aiModel.trim()) {
      autoModel = data.model
      try {
        autoModelSaver?.(data.model)
      } catch {
        /* 持久化失败不影响本次结果 */
      }
    }
    return data.text
  } catch (e) {
    if (e !== PROXY_MISS) throw e
  }
  return chatDirect(settings, prompt, system)
}

export function aiConfigured(settings: Settings): boolean {
  return !!settings.aiKey.trim()
}

/** 测试连接：发一条最小请求 */
export async function aiTestConnection(settings: Settings): Promise<{ ok: boolean; message: string }> {
  try {
    const text = await chat(settings, '请只回复两个字符：OK', '你是连通性测试器。')
    if (/ok/i.test(text)) return { ok: true, message: `连接成功（${modelOf(settings)}）` }
    return { ok: true, message: `连接成功，模型回复：${text.slice(0, 30)}` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/** 拉取提供商可用模型列表（经代理，无后端时回退直连） */
export async function aiListModels(settings: Settings): Promise<string[]> {
  const key = settings.aiKey.trim()
  if (!key) throw new Error('未配置 API KEY')
  try {
    const res = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: settings.aiProvider ?? 'openai',
        baseUrl: settings.aiBaseURL.trim(),
        apiKey: key,
      }),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) throw PROXY_MISS
    const data = (await res.json().catch(() => ({}))) as { models?: string[]; error?: string }
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
    if (!data.models?.length) throw new Error('提供商未返回模型列表')
    return data.models
  } catch (e) {
    if (e !== PROXY_MISS) throw e
  }
  // 直连回退
  try {
    const base = endpointOf(settings)
    const res = isOpenAi(settings)
      ? await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
      : await fetch(`${base}/models?key=${encodeURIComponent(key)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } }).error?.message ||
        (data as { error?: string }).error ||
        `请求失败 (${res.status})`
      throw new Error(typeof msg === 'string' ? msg : `请求失败 (${res.status})`)
    }
    const models = isOpenAi(settings)
      ? ((data as { data?: { id?: string }[] }).data ?? []).map((m) => m.id ?? '')
      : ((data as { models?: { name?: string }[] }).models ?? []).map((m) => (m.name ?? '').replace(/^models\//, ''))
    const list = models.filter(Boolean).sort() as string[]
    if (!list.length) throw new Error('提供商未返回模型列表')
    return list
  } catch (e) {
    const msg = (e as Error).message
    throw new Error(/failed to fetch/i.test(msg) ? '无法连接提供商（网络或跨域限制）' : msg)
  }
}

/** 单个站点的智能补全：名称 / 简介 / 分类建议 */
export async function aiSuggestSite(
  url: string,
  categoryNames: string[],
  settings: Settings,
): Promise<AiSuggestion | null> {
  const prompt = [
    `给定一个网站地址：${normalizeUrl(url)}（域名 ${hostOf(url)}）`,
    '请推断该网站的名称、一句话中文简介（不超过 30 字），并从以下分类中选择最合适的一个：',
    categoryNames.join('、') + '，或给一个新的简短中文分类名。',
    '严格以 JSON 返回：{"name":"...","desc":"...","category":"..."}，不要输出其他内容。',
  ].join('\n')
  try {
    const text = await chat(settings, prompt, '你是一个网址导航助手，只输出 JSON。')
    const json = text.match(/\{[\s\S]*\}/)
    if (!json) return null
    const obj = JSON.parse(json[0])
    return {
      name: String(obj.name || '').slice(0, 50),
      desc: String(obj.desc || '').slice(0, 100),
      category: String(obj.category || ''),
    }
  } catch {
    return null
  }
}

/** 只生成一句话描述；失败抛错（错误信息可直接展示） */
export async function aiDescribeSite(url: string, name: string, settings: Settings): Promise<string> {
  const prompt = `为网站「${name}」（${normalizeUrl(url)}，域名 ${hostOf(url)}）写一句中文简介，不超过 24 个字，直接输出简介本身，不要任何前后缀和标点引导。`
  const text = await chat(settings, prompt, '你是一个网址导航助手，只输出简介文本。')
  const desc = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^["「『]|["」』]$/g, '')
    .trim()
  if (!desc) throw new Error('AI 未返回有效简介，请换一个模型试试')
  return desc.slice(0, 60)
}
