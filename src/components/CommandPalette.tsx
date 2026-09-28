import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlarmClock, Globe, Loader2, MessageSquareText, Plus, Search } from 'lucide-react'
import type { Site } from '../types'
import { useStore } from '../hooks/useStore'
import { aiChat, aiConfigured, aiParseTodo, stripThink } from '../lib/ai'
import { useToast } from './Toast'

type CmdItem = {
  id: string
  icon: React.ReactNode
  label: React.ReactNode
  hint?: string
  run: () => void
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtWhen(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const day = (offset: number) => {
    const x = new Date(now)
    x.setDate(now.getDate() + offset)
    return d.toDateString() === x.toDateString()
  }
  if (day(0)) return `今天 ${hm}`
  if (day(1)) return `明天 ${hm}`
  if (day(-1)) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

/** 万能框（Ctrl/Cmd+K）：搜收藏、开网站、一句话加待办、直接问 AI */
export function CommandPalette({ open, onClose, onAddLink }: { open: boolean; onClose: () => void; onAddLink: () => void }) {
  const { data, addTodo } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'ask' | 'todo' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const configured = aiConfigured(data.settings)

  // 打开时重置并聚焦
  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setAiAnswer(null)
      setAiBusy(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const siteItems = useMemo<CmdItem[]>(() => {
    const query = q.trim().toLowerCase()
    const list = query
      ? data.sites.filter(
          (s: Site) =>
            !s.hidden &&
            (s.name.toLowerCase().includes(query) ||
              s.url.toLowerCase().includes(query) ||
              s.desc.toLowerCase().includes(query)),
        )
      : data.sites.filter((s: Site) => s.pinned && !s.hidden)
    return list.slice(0, 7).map((s) => ({
      id: 'site-' + s.id,
      icon: <Globe width={14} height={14} className="shrink-0 text-ink2" />,
      label: <span className="truncate">{s.name}</span>,
      hint: s.url.replace(/^https?:\/\//, '').slice(0, 32),
      run: () => {
        window.open(s.url, '_blank', 'noopener')
        onClose()
      },
    }))
  }, [q, data.sites, onClose])

  const askAi = async () => {
    const query = q.trim()
    if (!query) return
    setAiBusy('ask')
    setAiAnswer('')
    try {
      const out = stripThink(await aiChat(data.settings, query, '你是个人导航工作台里的 AI 助手。用中文简洁回答，可适当分点，不要废话。'))
      setAiAnswer(out || '（AI 未返回内容）')
    } catch (e) {
      setAiAnswer('⚠️ ' + (e as Error).message)
    } finally {
      setAiBusy(null)
    }
  }

  const addTodoViaAi = async () => {
    const query = q.trim()
    if (!query) return
    setAiBusy('todo')
    const r = await aiParseTodo(data.settings, query)
    setAiBusy(null)
    if (!r) {
      toast('AI 未能解析出待办，试试把时间说得更明确些')
      return
    }
    const ts = r.remindAt ?? Date.now() + 3600_000
    addTodo({ title: r.title, remindAt: ts, repeat: r.repeat, repeatDays: r.repeatDays })
    toast(`已添加待办：${r.title}（${fmtWhen(ts)}）`)
    onClose()
  }

  const actionItems = useMemo<CmdItem[]>(() => {
    const query = q.trim()
    if (!query) return []
    const list: CmdItem[] = []
    if (/^(https?:\/\/|www\.)\S+$/i.test(query)) {
      list.push({
        id: 'open-url',
        icon: <Globe width={14} height={14} className="shrink-0 text-ink2" />,
        label: (
          <span>
            打开网址 <span className="font-medium text-ink">{query}</span>
          </span>
        ),
        run: () => {
          window.open(/^https?:\/\//i.test(query) ? query : `https://${query}`, '_blank', 'noopener')
          onClose()
        },
      })
    }
    if (configured) {
      list.push({
        id: 'ask',
        icon:
          aiBusy === 'ask' ? (
            <Loader2 width={14} height={14} className="shrink-0 animate-spin text-accent" />
          ) : (
            <MessageSquareText width={14} height={14} className="shrink-0 text-accent" />
          ),
        label: (
          <span className="truncate">
            问 AI：<span className="font-medium text-ink">{query}</span>
          </span>
        ),
        hint: 'Enter',
        run: () => void askAi(),
      })
      list.push({
        id: 'todo',
        icon:
          aiBusy === 'todo' ? (
            <Loader2 width={14} height={14} className="shrink-0 animate-spin text-accent" />
          ) : (
            <AlarmClock width={14} height={14} className="shrink-0 text-accent" />
          ),
        label: (
          <span className="truncate">
            加为待办：<span className="font-medium text-ink">{query}</span>
          </span>
        ),
        hint: 'AI 识别时间',
        run: () => void addTodoViaAi(),
      })
    }
    list.push({
      id: 'add-link',
      icon: <Plus width={14} height={14} className="shrink-0 text-ink2" />,
      label: (
        <span>
          新建链接{query && !/^(https?:\/\/|www\.)\S+$/i.test(query) ? '' : ''}
        </span>
      ),
      hint: query ? '' : '空搜索时可用',
      run: () => {
        onClose()
        onAddLink()
      },
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, configured, aiBusy, data.settings, onClose, onAddLink, toast])

  const items = useMemo(() => [...siteItems, ...actionItems], [siteItems, actionItems])

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, items.length - 1)))
  }, [items.length])

  if (!open) return null

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-3 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-panel w-full max-w-xl overflow-hidden rounded-2xl shadow-pop">
        {/* 输入框 */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search width={16} height={16} className="shrink-0 text-ink2/70" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setCursor(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => (items.length ? (c + 1) % items.length : 0))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                items[cursor]?.run()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
            placeholder="搜收藏、开网站，或直接一句话…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink2/45"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink2/60 sm:block">
            ESC 关闭
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-ink2/60">
              {q.trim() ? (configured ? '试试下面的 AI 动作' : '没有匹配的网站（配置 AI 后可解锁智能动作）') : '输入关键词搜索，或直接写一句话'}
            </p>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={item.run}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                i === cursor ? 'bg-accent-soft/70 text-accent' : 'text-ink2 hover:bg-hover'
              }`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <span className="shrink-0 text-[10px] text-ink2/50">{item.hint}</span>}
            </button>
          ))}

          {/* AI 回答区 */}
          {(aiAnswer !== null || aiBusy === 'ask') && (
            <div className="mx-1 mt-1.5 rounded-xl border border-line bg-base/70 p-3">
              {aiBusy === 'ask' ? (
                <p className="flex items-center gap-2 text-xs text-ink2">
                  <Loader2 width={13} height={13} className="animate-spin text-accent" /> AI 思考中…
                </p>
              ) : (
                <>
                  <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6 text-ink">
                    {aiAnswer}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(aiAnswer ?? '')
                        toast('已复制')
                      }}
                      className="h-7 rounded-lg border border-line bg-surface px-2.5 text-[11px] text-ink2 transition-colors hover:text-ink"
                    >
                      复制
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
