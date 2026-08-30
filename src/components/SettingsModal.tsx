import { useRef, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { generateLetterIcon } from '../lib/favicon'
import { api } from '../lib/api'
import { Field, Modal, inputCls } from './Modal'
import { useToast } from './Toast'
import { aiListModels, aiTestConnection, aiDescribeSite } from '../lib/ai'
import type { Settings, ThemeMode } from '../types'
import { IconBot, IconDatabase, IconDownload, IconGlobe, IconKey, IconPalette, IconSparkles } from './icons'

type Tab = 'site' | 'ai' | 'appearance' | 'data'

const TABS = [
  { id: 'site', label: '网站设置', icon: IconGlobe },
  { id: 'ai', label: 'AI 助手', icon: IconBot },
  { id: 'appearance', label: '外观', icon: IconPalette },
  { id: 'data', label: '数据', icon: IconDatabase },
] as const

const ACCENTS = [
  { id: 'purple', label: '紫色', from: '#5b5ce2', to: '#8b5cf6' },
  { id: 'blue', label: '蓝色', from: '#0284c7', to: '#0ea5e9' },
  { id: 'pink', label: '品红', from: '#c026d3', to: '#ec4899' },
  { id: 'red', label: '红色', from: '#e11d48', to: '#f43f5e' },
  { id: 'orange', label: '橙色', from: '#ea580c', to: '#f97316' },
  { id: 'green', label: '绿色', from: '#059669', to: '#10b981' },
  { id: 'slate', label: '石灰', from: '#475569', to: '#64748b' },
]

const BGS = [
  { id: 'zinc', name: '高级灰 (Zinc)', desc: '纯净无色值', preview: 'linear-gradient(135deg, #a1a1aa, #52525b)' },
  { id: 'slate', name: '青灰 (Slate)', desc: '经典冷色调', preview: 'linear-gradient(135deg, #94a3b8, #475569)' },
  { id: 'neutral', name: '暖灰 (Neutral)', desc: '柔和舒适', preview: 'linear-gradient(135deg, #a8a29e, #57534e)' },
] as const

const MODEL_SUGGESTIONS = [
  'gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'deepseek-reasoner',
  'gemini-2.0-flash', 'gemini-1.5-pro', 'qwen-plus', 'moonshot-v1-8k',
]

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onOpenData: () => void
}

export function SettingsModal({ open, onClose, onOpenData }: SettingsModalProps) {
  const { data, setSettings, updateSite, resetAll } = useStore()
  const { setMode } = useTheme()
  const { user } = useAuth()
  const toast = useToast()
  const faviconFileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('site')
  const [form, setForm] = useState<Settings>(() => ({ ...data.settings }))
  const [iconHues, setIconHues] = useState<number[]>([220, 280, 160, 30, 0, 330])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [models, setModels] = useState<{ loading: boolean; list: string[]; open: boolean }>({
    loading: false,
    list: [],
    open: false,
  })
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  })
  const [deviceToken, setDeviceToken] = useState('')
  const [deviceExpiry, setDeviceExpiry] = useState<number | null>(null)
  const [tokenDuration, setTokenDuration] = useState('365')
  const [tokenLoading, setTokenLoading] = useState(false)

  const letter = (form.siteTitle || '拾光导航').trim().charAt(0) || '拾'
  const regenIcons = () => {
    const base = Math.floor(Math.random() * 360)
    setIconHues(Array.from({ length: 6 }, (_, i) => Math.round((base + i * 60) % 360)))
  }
  const pickFaviconFile = (file: File) => {
    if (file.size > 150 * 1024) {
      toast('图标文件过大，请控制在 150KB 内')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, favicon: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  // 每次打开时重置表单
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setForm({ ...data.settings })
    setTestResult(null)
    setModels({ loading: false, list: [], open: false })
    setTab('site')
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const save = () => {
    setSettings(form)
    toast('设置已保存')
    onClose()
  }

  const applyTheme = (theme: ThemeMode) => {
    setForm((f) => ({ ...f, theme }))
    setMode(theme)
    setSettings({ theme })
  }

  const applyAccent = (id: string) => {
    setForm((f) => ({ ...f, accent: id }))
    setSettings({ accent: id })
    const root = document.documentElement
    if (id === 'custom') {
      const hex = form.accentCustom || '#8b5cf6'
      root.dataset.accent = 'custom'
      root.style.setProperty('--accent-custom', hex)
    } else if (id === 'purple') {
      root.removeAttribute('data-accent')
    } else {
      root.dataset.accent = id
    }
  }

  const applyCustomAccent = (hex: string) => {
    setForm((f) => ({ ...f, accent: 'custom', accentCustom: hex }))
    setSettings({ accent: 'custom', accentCustom: hex })
    const root = document.documentElement
    root.dataset.accent = 'custom'
    root.style.setProperty('--accent-custom', hex)
  }

  const applyBg = (bgStyle: Settings['bgStyle']) => {
    setForm((f) => ({ ...f, bgStyle }))
    setSettings({ bgStyle })
    const root = document.documentElement
    if (bgStyle === 'zinc') root.removeAttribute('data-bg')
    else root.dataset.bg = bgStyle
  }

  const applyBgImage = (enabled: boolean, url: string) => {
    setForm((f) => ({ ...f, bgImageEnabled: enabled, bgImage: url }))
    setSettings({ bgImageEnabled: enabled, bgImage: url })
    const root = document.documentElement
    if (enabled && url.trim()) {
      const scrim = 'color-mix(in srgb, var(--c-base) 60%, transparent)'
      root.style.setProperty(
        '--bg-custom',
        `linear-gradient(${scrim}, ${scrim}), url("${url.trim().replace(/"/g, '%22')}")`,
      )
      root.style.setProperty('--bg-size', 'auto, cover')
    } else {
      root.style.removeProperty('--bg-custom')
      root.style.removeProperty('--bg-size')
    }
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    const r = await aiTestConnection({ ...data.settings, ...form })
    setTestResult(r)
    setTesting(false)
  }

  /** 从提供商拉取可用模型列表（用当前表单里未保存的配置） */
  const pullModels = async () => {
    if (models.loading) return
    setModels((m) => ({ ...m, loading: true, open: true }))
    try {
      const list = await aiListModels({ ...data.settings, ...form })
      setModels({ loading: false, list, open: true })
      toast(`已拉取 ${list.length} 个模型，点击选择`)
    } catch (e) {
      setModels((m) => ({ ...m, loading: false }))
      toast((e as Error).message || '拉取模型失败')
    }
  }

  const missingDesc = data.sites.filter((s) => !s.desc.trim()).length

  const runBatch = async () => {
    const merged: Settings = { ...data.settings, ...form }
    if (!merged.aiKey.trim()) {
      toast('请先填写 API KEY 并保存')
      return
    }
    const targets = data.sites.filter((s) => !s.desc.trim())
    if (targets.length === 0) {
      toast('所有链接都已有描述')
      return
    }
    setBatch({ running: true, done: 0, total: targets.length })
    let ok = 0
    let firstError = ''
    for (let i = 0; i < targets.length; i++) {
      try {
        const desc = await aiDescribeSite(targets[i].url, targets[i].name, merged)
        updateSite(targets[i].id, { desc })
        ok++
      } catch (e) {
        if (!firstError) firstError = (e as Error).message
      }
      setBatch((b) => ({ ...b, done: i + 1 }))
    }
    setBatch({ running: false, done: 0, total: 0 })
    toast(ok > 0 ? `已补全 ${ok}/${targets.length} 条描述${firstError ? `；失败原因：${firstError}` : ''}` : `补全失败：${firstError || '未知原因'}`)
  }

  const pinned = data.sites.filter((s) => s.pinned).length

  /** 生成扩展连接码：长期设备令牌，粘贴进浏览器扩展即可一键收藏；重新生成使旧码立即失效 */
  const genDeviceToken = async () => {
    setTokenLoading(true)
    try {
      const { token, expiresAt } = await api.deviceToken(Number(tokenDuration) || 0)
      setDeviceToken(token)
      setDeviceExpiry(expiresAt)
      try {
        await navigator.clipboard.writeText(token)
        toast('连接码已生成并复制，请粘贴到扩展设置中')
      } catch {
        toast('连接码已生成，请手动复制')
      }
    } catch (e) {
      toast((e as Error).message || '生成失败，请重新登录后再试')
    } finally {
      setTokenLoading(false)
    }
  }

  const expiryText = deviceExpiry
    ? `有效期至 ${new Date(deviceExpiry).toLocaleDateString('zh-CN')}（重新生成将使旧连接码立即失效）`
    : '长期有效（重新生成将使旧连接码立即失效）'

  return (
    <Modal open={open} title="设置" onClose={onClose} width="max-w-[560px]">
      {/* 标签页：一行最多容纳 6 个，超出自动换行 */}
      <div className="mb-5 flex gap-1 rounded-xl bg-base p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 text-[11px] font-medium transition-all ${
              tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink2 hover:text-ink'
            }`}
          >
            <t.icon width={12} height={12} className="shrink-0" />
            <span className="hidden truncate sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'site' && (
        <div className="flex flex-col gap-4">
          {/* 网页标题 */}
          <Field label="网页标题" hint="浏览器标签与站点名">
            <input
              className={inputCls}
              value={form.siteTitle}
              onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
              placeholder="拾光导航"
            />
          </Field>

          {/* 网站图标 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink2">网站图标</span>
            <div className="flex items-start gap-2.5">
              <div
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-base"
                title="图标预览"
              >
                {form.favicon ? (
                  <img src={form.favicon} alt="" className="h-8 w-8 rounded-lg object-contain" />
                ) : (
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent2))' }}
                  >
                    {(form.siteTitle || '拾').trim().charAt(0) || '拾'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex gap-1.5">
                  <input
                    className={inputCls + ' h-9 min-w-0 flex-1 truncate py-0 font-mono text-[11px]'}
                    value={form.favicon}
                    onChange={(e) => setForm({ ...form, favicon: e.target.value })}
                    placeholder="图标链接，留空使用内置默认"
                  />
                  <button
                    type="button"
                    onClick={() => faviconFileRef.current?.click()}
                    className="h-9 shrink-0 rounded-lg border border-line bg-surface px-3 text-xs text-ink2 transition-all hover:border-line-strong hover:text-ink"
                  >
                    上传
                  </button>
                  <input
                    ref={faviconFileRef}
                    type="file"
                    accept=".svg,.png,.ico,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) pickFaviconFile(f)
                      e.target.value = ''
                    }}
                  />
                </div>
                <div className="mt-2 rounded-xl bg-base p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink2">随机生成图标</span>
                    <button
                      type="button"
                      onClick={regenIcons}
                      className="flex items-center gap-1 text-[11px] font-medium text-accent transition-opacity hover:opacity-75"
                    >
                      <span aria-hidden>⟳</span> 换一批
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {iconHues.map((h) => {
                      const opt = generateLetterIcon(letter, h)
                      const active = form.favicon === opt
                      return (
                        <button
                          key={h}
                          type="button"
                          title="使用该图标"
                          onClick={() => setForm({ ...form, favicon: opt })}
                          className={`overflow-hidden rounded-xl transition-transform hover:scale-105 ${
                            active ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--c-surface)]' : ''
                          }`}
                        >
                          <img src={opt} alt="" className="h-10 w-10" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 默认搜索引擎 */}
          <Field label="默认搜索引擎">
            <select
              className={inputCls}
              value={form.searchEngine}
              onChange={(e) => setForm({ ...form, searchEngine: e.target.value })}
            >
              <option value="bing">必应</option>
              <option value="google">Google</option>
              <option value="baidu">百度</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="github">GitHub</option>
            </select>
          </Field>

          {/* 弹窗交互 */}
          <div className="border-t border-line pt-4">
            <span className="mb-2 block text-xs font-semibold text-ink">弹窗交互</span>
            <div className="flex items-center justify-between rounded-xl border border-line bg-base px-4 py-3">
              <div>
                <div className="text-sm font-medium">点击遮罩关闭弹窗</div>
                <div className="mt-0.5 text-xs text-ink2">关闭可避免误触</div>
              </div>
              <button
                type="button"
                aria-label="点击遮罩关闭弹窗"
                onClick={() => setForm((f) => ({ ...f, maskClosable: !f.maskClosable }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  form.maskClosable ? 'bg-accent' : 'bg-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    form.maskClosable ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="flex flex-col gap-4">
          {/* 说明横幅 + 测试连接 */}
          <div className="flex items-start gap-2.5 rounded-xl bg-accent-soft p-4">
            <IconSparkles width={15} height={15} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-5 text-ink/85">
                配置 AI 助手后，可以自动为您的链接生成智能描述和分类建议。Key 仅存储在您的浏览器中；请求由本站后端转发给您选择的
                AI 提供商，不受浏览器跨域限制。BASE URL 留空或只填域名即可（自动补全 /v1）。
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                {testResult && (
                  <span className={`text-[11px] ${testResult.ok ? 'text-emerald-500' : 'text-danger'}`}>
                    {testResult.message}
                  </span>
                )}
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-opacity hover:opacity-75 disabled:opacity-50"
                >
                  <IconSparkles width={12} height={12} />
                  {testing ? '测试中…' : '测试连接'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink2">AI 提供商</span>
              <select
                className={inputCls}
                value={form.aiProvider}
                onChange={(e) => {
                  const provider = e.target.value as Settings['aiProvider']
                  const otherDefault = provider === 'openai' ? 'gemini-2.0-flash' : 'gpt-4o-mini'
                  setForm((f) => ({
                    ...f,
                    aiProvider: provider,
                    aiModel: !f.aiModel || MODEL_SUGGESTIONS.includes(f.aiModel) ? (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash') : f.aiModel === otherDefault ? (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash') : f.aiModel,
                  }))
                }}
              >
                <option value="openai">OpenAI Compatible</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </label>
            <div className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink2">模型名称</span>
              <div className="relative">
                <input
                  className={inputCls + ' pr-10'}
                  list="model-suggestions"
                  value={form.aiModel}
                  onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
                  placeholder={form.aiProvider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
                />
                <button
                  type="button"
                  title="从提供商拉取模型列表"
                  aria-label="拉取模型列表"
                  onClick={pullModels}
                  disabled={models.loading}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-hover hover:text-accent disabled:opacity-50"
                >
                  <IconDownload width={14} height={14} className={models.loading ? 'animate-spin' : ''} />
                </button>
                {models.open && models.list.length > 0 && (
                  <div className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-48 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop">
                    {models.list.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, aiModel: m })
                          setModels((s) => ({ ...s, open: false }))
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-hover ${
                          m === form.aiModel ? 'font-medium text-accent' : 'text-ink'
                        }`}
                      >
                        <span className="truncate">{m}</span>
                        {m === form.aiModel && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <datalist id="model-suggestions">
                {(models.list.length ? models.list : MODEL_SUGGESTIONS).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          <label className="relative block">
            <span className="mb-1.5 block text-xs font-medium text-ink2">API KEY</span>
            <IconKey
              width={14}
              height={14}
              className="pointer-events-none absolute bottom-[13px] left-3 text-ink2/70"
            />
            <input
              type="password"
              autoComplete="off"
              className={inputCls + ' pl-9'}
              placeholder="sk-…"
              value={form.aiKey}
              onChange={(e) => setForm({ ...form, aiKey: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink2">BASE URL（可选）</span>
            <input
              className={inputCls + ' font-mono text-xs'}
              placeholder={form.aiProvider === 'openai' ? 'https://api.openai.com/v1' : 'https://generativelanguage.googleapis.com/v1beta'}
              value={form.aiBaseURL}
              onChange={(e) => setForm({ ...form, aiBaseURL: e.target.value })}
            />
          </label>

          {/* 批量操作 */}
          <div className="border-t border-line pt-4">
            <p className="mb-2.5 text-xs font-semibold text-ink">批量操作</p>
            <button
              onClick={runBatch}
              disabled={batch.running}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong/70 text-xs font-medium text-ink2 transition-all hover:border-accent/50 hover:text-accent disabled:opacity-60"
            >
              <IconSparkles width={14} height={14} />
              {batch.running
                ? `AI 补全中… ${batch.done}/${batch.total}`
                : missingDesc > 0
                  ? `自动补全所有缺失的链接描述（${missingDesc} 条）`
                  : '自动补全所有缺失的链接描述'}
            </button>
          </div>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="flex flex-col gap-5">
          {/* 主题模式 */}
          <Field label="主题模式">
            <select className={inputCls} value={form.theme} onChange={(e) => applyTheme(e.target.value as ThemeMode)}>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </Field>

          {/* 主题色调 */}
          <div>
            <span className="mb-2.5 block text-xs font-medium text-ink2">主题色调 (Theme Color)</span>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENTS.map((a) => {
                const active = (form.accent || 'purple') === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.label}
                    aria-label={a.label}
                    onClick={() => applyAccent(a.id)}
                    className={`relative h-10 w-[92px] rounded-full transition-transform hover:scale-[1.04] ${
                      active ? 'scale-[1.04]' : ''
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
                      boxShadow: active
                        ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${a.from}, var(--shadow-glow)`
                        : 'inset 0 0 0 1px rgba(0,0,0,.06)',
                    }}
                  >
                    {active && (
                      <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white shadow-sm" />
                    )}
                  </button>
                )
              })}
              {/* 自定义颜色 */}
              <label
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-all ${
                  form.accent === 'custom'
                    ? 'border-accent/50 bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink'
                }`}
                title="自定义颜色"
              >
                <span
                  className="h-5 w-5 rounded-md border border-black/10"
                  style={{
                    background:
                      form.accent === 'custom' && form.accentCustom
                        ? form.accentCustom
                        : 'linear-gradient(135deg, var(--c-accent), var(--c-accent2))',
                  }}
                />
                <span className="text-xs font-medium">自定义颜色</span>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.accentCustom) ? form.accentCustom : '#8b5cf6'}
                  onChange={(e) => applyCustomAccent(e.target.value)}
                  className="absolute h-0 w-0 opacity-0"
                />
              </label>
            </div>
          </div>

          {/* 背景风格 */}
          <div>
            <span className="mb-2.5 block text-xs font-medium text-ink2">背景风格 (Background)</span>
            <div className="grid grid-cols-3 gap-3">
              {BGS.map((b) => {
                const active = (form.bgStyle || 'zinc') === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => applyBg(b.id)}
                    className={`rounded-xl border p-2.5 text-center transition-all hover:-translate-y-0.5 ${
                      active ? 'border-accent/60 bg-accent-soft/40 shadow-sm' : 'border-line bg-surface'
                    }`}
                  >
                    <div className="h-14 rounded-lg" style={{ background: b.preview }} />
                    <div className="mt-2 text-xs font-medium">{b.name}</div>
                    <div className="mt-0.5 text-[10px] text-ink2">{b.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 自定义背景 */}
          <div>
            <span className="mb-2 block text-xs font-medium text-ink2">自定义背景</span>
            <div className="flex items-center justify-between rounded-xl border border-line bg-base px-4 py-3">
              <div>
                <div className="text-sm font-medium">启用背景图</div>
                <div className="mt-0.5 text-xs text-ink2">支持 URL 或 data URL</div>
              </div>
              <button
                type="button"
                aria-label="启用背景图"
                onClick={() => applyBgImage(!form.bgImageEnabled, form.bgImage)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  form.bgImageEnabled ? 'bg-accent' : 'bg-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    form.bgImageEnabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {form.bgImageEnabled && (
              <div className="mt-2.5 flex gap-2">
                <input
                  className={inputCls + ' min-w-0 flex-1 font-mono text-xs'}
                  value={form.bgImage}
                  onChange={(e) => setForm((f) => ({ ...f, bgImage: e.target.value }))}
                  onBlur={(e) => applyBgImage(true, e.target.value)}
                  placeholder="https://example.com/background.jpg"
                />
                <button
                  type="button"
                  onClick={() => applyBgImage(false, '')}
                  className="h-[42px] shrink-0 rounded-lg border border-line bg-surface px-3.5 text-xs text-ink2 transition-all hover:border-line-strong hover:text-ink"
                >
                  清空
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['站点', data.sites.length],
              ['分类', data.categories.length],
              ['置顶', pinned],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-xl border border-line bg-base px-4 py-3 text-center">
                <div className="text-lg font-semibold tabular-nums">{n as number}</div>
                <div className="text-[11px] text-ink2">{label as string}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              onClose()
              onOpenData()
            }}
            className="btn-ghost h-11 w-full"
          >
            <IconDatabase width={14} height={14} /> 导入 / 导出（书签 & JSON 备份）
          </button>

          {/* 浏览器扩展 · 一键收藏 */}
          <div className="border-t border-line pt-4">
            <div className="mb-1 flex items-center gap-1.5">
              <IconKey width={12} height={12} className="text-accent" />
              <p className="text-xs font-semibold text-ink">浏览器扩展 · 一键收藏</p>
            </div>
            <p className="mb-2.5 text-[11px] leading-5 text-ink2">
              {user
                ? '在浏览器扩展页（chrome://extensions → 开发者模式）加载项目 extension 目录，再把连接码粘贴进扩展设置。之后在任意网页点扩展图标或按 Alt+S：弹出确认窗，AI 自动推荐分类与简介，可从全部分类中自选，确认后收藏。'
                : '登录后可生成扩展连接码，在浏览器中一键收藏任意网页。'}
            </p>
            {user && (
              <>
                {deviceToken && (
                  <div className="mb-2">
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={deviceToken}
                        onFocus={(e) => e.currentTarget.select()}
                        className={inputCls + ' h-9 min-w-0 flex-1 py-0 font-mono text-[11px]'}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(deviceToken).then(
                            () => toast('连接码已复制'),
                            () => toast('复制失败，请手动选择复制'),
                          )
                        }}
                        className="h-9 shrink-0 rounded-lg border border-line bg-surface px-3.5 text-xs text-ink2 transition-all hover:border-line-strong hover:text-ink"
                      >
                        复制
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink2">{expiryText}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value={tokenDuration}
                    onChange={(e) => setTokenDuration(e.target.value)}
                    className={inputCls + ' h-9 w-32 py-0'}
                    aria-label="连接码有效时长"
                  >
                    <option value="365">1 年有效</option>
                    <option value="1825">5 年有效</option>
                    <option value="3650">10 年有效</option>
                    <option value="7300">20 年有效</option>
                    <option value="0">长期有效</option>
                  </select>
                  <button
                    type="button"
                    onClick={genDeviceToken}
                    disabled={tokenLoading}
                    className="btn-ghost h-9 flex-1 !py-0 text-xs"
                  >
                    <IconKey width={13} height={13} />
                    {tokenLoading ? '生成中…' : deviceToken ? '重新生成连接码' : '生成扩展连接码'}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => {
              if (window.confirm('确定清空所有数据并恢复为初始示例吗？此操作不可撤销。')) {
                resetAll()
                toast('已恢复初始数据')
                onClose()
              }
            }}
            className="h-11 w-full rounded-full border border-danger/30 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
          >
            重置全部数据
          </button>
          <p className="text-[11px] leading-5 text-ink2/70">
            所有数据保存在浏览器 localStorage{user ? '，并实时同步到云端账户' : ''}，换浏览器/清缓存前请先导出备份。
          </p>

          {/* 关于（合并至数据页下方） */}
          <div className="mt-1 flex flex-col gap-4 border-t border-line pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-base p-4">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-[13px] bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-lg font-semibold text-white shadow-[var(--shadow-glow)]">
                {(form.siteTitle || '拾光导航').trim().charAt(0)}
                <span className="pointer-events-none absolute inset-0 rounded-[13px] ring-1 ring-inset ring-white/25" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{form.siteTitle || '拾光导航'}</div>
                <div className="mt-0.5 text-xs text-ink2">v2.0.0 · 个人网址导航</div>
              </div>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-ghost ms-auto shrink-0 !px-3 !py-1.5 text-xs"
              >
                GitHub
              </a>
            </div>
            <p className="text-xs leading-5 text-ink2">
              参考元启导航功能对齐实现的多用户网址导航站：微信 / Google / Linux.do / 邮箱四种注册登录、邀请码准入、每用户云端数据同步、浏览器书签与 JSON 备份导入导出、AI 智能补全。
            </p>
            <div className="rounded-xl border border-line bg-base p-3.5 text-[11px] leading-5 text-ink2">
              <p>
                <span className="font-medium text-ink">技术栈</span>
                ：Vite · React 18 · TypeScript · Tailwind CSS v4 · Cloudflare Workers + D1
              </p>
              <p className="mt-1">
                <span className="font-medium text-ink">数据</span>
                ：本地 localStorage 优先，登录后实时同步云端，换机迁移用上方「导入 / 导出」备份。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 保存 */}
      {tab !== 'data' && (
        <button onClick={save} className="btn-primary mt-6 h-11 w-full">
          保存设置
        </button>
      )}
    </Modal>
  )
}
