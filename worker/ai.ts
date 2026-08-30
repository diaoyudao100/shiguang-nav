/** AI 代理：浏览器直连提供商常被 CORS 拦截，统一由 Worker 转发（Key 仅在本次请求中透传，不落库）
 *
 *  模型自动纠正：若提供商返回"模型不存在/不支持"类错误（如默认模型不被该提供商支持），
 *  自动拉取 /models 列表、挑选一个轻量对话模型重试一次，并在响应中回传实际使用的模型，
 *  前端据此持久化，后续请求直接用正确模型。
 */
import { fail, json, readJson, sameOrigin } from './util'

const TIMEOUT_MS = 30_000

interface AiChatBody {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  system?: string
  prompt?: string
}

interface AiModelsBody {
  provider?: string
  baseUrl?: string
  apiKey?: string
}

/** 本地大模型服务（Ollama / LM Studio 等）允许 http，其余必须 https */
function isAllowedTarget(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
  } catch {
    return false
  }
}

/** 规范化 baseUrl：留空用官方默认；未带版本段时自动补 /v1（OpenAI 兼容）或 /v1beta（Gemini） */
export function normalizeBase(provider: string, base: string): string {
  const b = base.trim().replace(/\/+$/, '')
  if (provider === 'gemini') {
    if (!b) return 'https://generativelanguage.googleapis.com/v1beta'
    return /\/v\d+[a-z]*$/i.test(b) ? b : `${b}/v1beta`
  }
  if (!b) return 'https://api.openai.com/v1'
  return /\/v\d+$/.test(b) ? b : `${b}/v1`
}

async function fetchProvider(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

/** 提取提供商错误信息，尽量给出人话 */
function providerError(status: number, text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    const msg = typeof j.error === 'string' ? j.error : j.error?.message || j.message
    if (msg) return `${msg}（${status}）`
  } catch {
    /* 非 JSON，原样截断返回 */
  }
  return text.slice(0, 160) || `请求失败（${status}）`
}

function unreachable(e: unknown): string {
  const err = e as Error
  return err.name === 'TimeoutError' ? '提供商响应超时（30 秒）' : `无法连接提供商：${err.message}`
}

/** 判定是否"模型不被该提供商支持"类错误（值得自动换模型重试） */
function isModelMismatch(status: number, raw: string): boolean {
  return (status === 400 || status === 404) && /model/i.test(raw)
}

const NON_CHAT = /embed|rerank|whisper|tts|audio|moderation|dall-?e|image|clip|guard|vision-exp|realtime|transcribe/i
const PREFER = /flash|mini|lite|instant|turbo|air|small|fast|chat/i

/** 从模型列表里挑一个适合写简述的轻量对话模型 */
function pickChatModel(models: string[]): string | null {
  const usable = models.filter((m) => !NON_CHAT.test(m))
  if (!usable.length) return null
  return usable.find((m) => PREFER.test(m)) ?? usable[0]
}

/** 拉取提供商模型列表；失败返回 null（不打断主流程） */
async function listModels(provider: string, base: string, key: string): Promise<string[] | null> {
  try {
    const res =
      provider === 'gemini'
        ? await fetchProvider(`${base}/models?key=${encodeURIComponent(key)}`, {})
        : await fetchProvider(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (!res.ok) return null
    const j = (await res.json().catch(() => null)) as {
      data?: { id?: string }[]
      models?: { name?: string; supportedGenerationMethods?: string[] }[]
    } | null
    if (!j) return null
    const models =
      provider === 'gemini'
        ? (j.models ?? [])
            .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
            .map((m) => (m.name ?? '').replace(/^models\//, ''))
        : (j.data ?? []).map((m) => m.id ?? '')
    return models.filter(Boolean)
  } catch {
    return null
  }
}

interface ChatResult {
  ok: boolean
  status: number
  raw: string
}

/** 发起一次对话请求；网络异常时抛错（由调用方转为提示，不再重试） */
async function chatOnce(
  provider: string,
  base: string,
  key: string,
  model: string,
  system: string,
  prompt: string,
): Promise<ChatResult> {
  let res: Response
  try {
    if (provider === 'gemini') {
      res = await fetchProvider(
        `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          }),
        },
      )
    } else {
      res = await fetchProvider(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          // 不传 temperature：部分推理模型只接受默认值，传了会被拒绝
        }),
      })
    }
  } catch (e) {
    throw new Error(unreachable(e))
  }
  return { ok: res.ok, status: res.status, raw: await res.text() }
}

/** 从提供商响应中提取文本；附带回退与诊断信息 */
function extractText(provider: string, raw: string): { text: string; hint?: string } {
  try {
    const j = JSON.parse(raw) as {
      choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      promptFeedback?: { blockReason?: string }
    }
    if (provider === 'gemini') {
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
      if (!text && j.promptFeedback?.blockReason) {
        return { text: '', hint: `请求被提供商安全策略拦截（${j.promptFeedback.blockReason}）` }
      }
      return { text }
    }
    // 部分推理模型把文本放在 reasoning_content，content 为空：依次回退
    const msg = j.choices?.[0]?.message
    const text = (msg?.content ?? '').trim() || (msg?.reasoning_content ?? '').trim()
    if (!text && j.choices?.[0]?.finish_reason === 'length') {
      return { text: '', hint: 'AI 返回被截断（finish_reason=length），请换用输出更简洁的模型' }
    }
    return { text }
  } catch {
    return { text: '' }
  }
}

/** POST /api/ai/chat：转发对话请求，返回 { text, model? }（model 仅在自动纠正时回传） */
export async function handleAiChat(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  if (!sameOrigin(req)) return fail('来源校验失败', 403)
  const body = await readJson<AiChatBody>(req, 64_000)
  if (!body?.apiKey?.trim() || !body.prompt) return fail('缺少 API KEY 或提问内容')
  const provider = body.provider === 'gemini' ? 'gemini' : 'openai'
  const key = body.apiKey.trim()
  const system = body.system ?? ''
  const prompt = body.prompt
  const model = (body.model ?? '').trim() || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
  const base = normalizeBase(provider, body.baseUrl ?? '')
  if (!isAllowedTarget(base)) return fail('BASE URL 必须是 https 地址（本地仅允许 127.0.0.1 / localhost）')

  let r: ChatResult
  try {
    r = await chatOnce(provider, base, key, model, system, prompt)
  } catch (e) {
    return fail((e as Error).message, 502)
  }

  // 模型不被支持：自动拉列表挑一个可用的重试一次
  if (!r.ok && isModelMismatch(r.status, r.raw)) {
    const list = await listModels(provider, base, key)
    const alt = list ? pickChatModel(list) : null
    if (alt && alt !== model) {
      let r2: ChatResult
      try {
        r2 = await chatOnce(provider, base, key, alt, system, prompt)
      } catch (e) {
        return fail((e as Error).message, 502)
      }
      if (!r2.ok) return fail(providerError(r2.status, r2.raw), 502)
      const t2 = extractText(provider, r2.raw)
      if (t2.hint) return fail(t2.hint, 502)
      if (!t2.text) return fail('AI 未返回内容，请换一个模型试试', 502)
      return json({ text: t2.text, model: alt })
    }
  }

  if (!r.ok) return fail(providerError(r.status, r.raw), 502)
  const { text, hint } = extractText(provider, r.raw)
  if (hint) return fail(hint, 502)
  if (!text) return fail('AI 未返回内容，请换一个模型试试', 502)
  return json({ text })
}

/** POST /api/ai/models：拉取提供商模型列表，返回 { models } */
export async function handleAiModels(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('方法不允许', 405)
  if (!sameOrigin(req)) return fail('来源校验失败', 403)
  const body = await readJson<AiModelsBody>(req, 16_000)
  if (!body?.apiKey?.trim()) return fail('缺少 API KEY')
  const provider = body.provider === 'gemini' ? 'gemini' : 'openai'
  const key = body.apiKey.trim()
  const base = normalizeBase(provider, body.baseUrl ?? '')
  if (!isAllowedTarget(base)) return fail('BASE URL 必须是 https 地址（本地仅允许 127.0.0.1 / localhost）')

  const models = (await listModels(provider, base, key)) ?? []
  models.sort()
  if (models.length === 0) return fail('未能获取模型列表：请检查 KEY 与 BASE URL', 502)
  return json({ models })
}
