import { useEffect, useRef, useState } from 'react'
import type { Note } from '../types'
import { useStore } from '../hooks/useStore'
import { Modal } from './Modal'
import { IconPin, IconPlus, IconStickyNote, IconTrash } from './icons'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'

const MAX_TITLE = 60
const MAX_LEN = 2000

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${hhmm}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 便签：双栏布局（左列表 + 右编辑/预览），自动保存并随账户同步。
 *  空白便签（无标题且无内容）除「刚新建正在输入的那条」外一律自动清理。 */
export function NotesModal({
  open,
  onClose,
  initialId,
}: {
  open: boolean
  onClose: () => void
  /** 打开时定位到指定便签（来自站内搜索结果点击） */
  initialId?: string | null
}) {
  const { data, addNote, updateNote, updateNoteTitle, toggleNotePin, deleteNote } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [noteQuery, setNoteQuery] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const pendingFocus = useRef<string | null>(null)
  const freshBlankId = useRef<string | null>(null) // 刚新建、允许暂时为空的那条
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const notes = [...(data.notes ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  )
  const selected = notes.find((n) => n.id === selectedId) ?? null

  const isBlank = (n: Note) => !n.title.trim() && !n.text.trim()
  /** 清理空白便签；keepId 用于豁免刚新建的那条 */
  const pruneBlanks = (keepId: string | null = null) => {
    for (const n of data.notes ?? []) {
      if (n.id !== keepId && isBlank(n)) deleteNote(n.id)
    }
  }

  // 打开/数据变化时：清理所有空白便签（豁免新建中的那条），并保证选中项有效
  useEffect(() => {
    if (!open) return
    pruneBlanks(freshBlankId.current)
    const cur = notes.find((n) => n.id === selectedId)
    if (!cur || (isBlank(cur) && cur.id !== freshBlankId.current)) {
      const first = notes.find((n) => !isBlank(n) || n.id === freshBlankId.current)
      setSelectedId(first?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.notes])

  // 切换便签回到编辑模式；新建后聚焦标题框
  useEffect(() => {
    setMode('edit')
    if (open && pendingFocus.current && selectedId === pendingFocus.current) {
      pendingFocus.current = null
      titleRef.current?.focus()
      titleRef.current?.select()
    }
  }, [selectedId, open])

  // 站内搜索点击便签结果：打开后定位到对应便签
  useEffect(() => {
    if (open && initialId && notes.some((n) => n.id === initialId)) {
      setSelectedId(initialId)
      setMode('edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialId])

  // 左列表过滤：关键字（标题/内容）+ 只看置顶
  const q = noteQuery.trim().toLowerCase()
  const visibleNotes = notes.filter(
    (n) =>
      (!onlyPinned || n.pinned) &&
      (!q || n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)),
  )

  const create = () => {
    pruneBlanks(freshBlankId.current) // 新建前先丢掉历史空白
    const n = addNote()
    freshBlankId.current = n.id
    pendingFocus.current = n.id
    setSelectedId(n.id)
  }

  // 切换选中：离开的若是空白便签（放弃输入），直接丢弃
  const select = (id: string) => {
    if (selectedId !== id) {
      const cur = notes.find((x) => x.id === selectedId)
      if (cur && isBlank(cur)) {
        deleteNote(cur.id)
        if (freshBlankId.current === cur.id) freshBlankId.current = null
      }
    }
    setSelectedId(id)
  }

  // 关闭面板：所有空白便签（含刚新建未写的）全部丢弃
  const handleClose = () => {
    for (const n of data.notes ?? []) if (isBlank(n)) deleteNote(n.id)
    freshBlankId.current = null
    onClose()
  }

  const remove = async (note: Note) => {
    const preview = note.title.trim() || note.text
    const ok = await confirm({
      danger: true,
      title: '删除便签',
      message: (
        <>
          确定删除这条便签吗？
          {preview && (
            <>
              <br />
              <span className="line-clamp-2 text-ink2/70">「{preview.slice(0, 60)}」</span>
            </>
          )}
        </>
      ),
      okText: '删除',
    })
    if (!ok) return
    deleteNote(note.id)
    if (freshBlankId.current === note.id) freshBlankId.current = null
    toast('便签已删除')
  }

  const snippet = (n: Note) => n.text.replace(/\s+/g, ' ').trim()

  return (
    <Modal
      open={open}
      title="便签随记"
      onClose={handleClose}
      width="max-w-3xl"
      icon={
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <IconStickyNote width={17} height={17} />
        </span>
      }
    >
      {/* 双栏：左列表 / 右编辑 */}
      <div className="flex h-[460px] overflow-hidden rounded-2xl border border-line bg-base/40">
        {/* 左侧：新建 + 搜索 + 标题列表 */}
        <div className="flex w-56 shrink-0 flex-col border-r border-line md:w-60">
          <div className="shrink-0 space-y-1.5 p-2 pb-1.5">
            <button
              type="button"
              onClick={create}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-medium text-ink transition-all hover:border-line-strong hover:shadow-card"
            >
              <IconPlus width={13} height={13} /> 新建便签
            </button>
            <div className="flex items-center gap-1.5">
              <input
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="搜索便签…"
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink outline-none transition-colors placeholder:text-ink2/40 focus:border-accent/50"
              />
              <button
                type="button"
                onClick={() => setOnlyPinned((v) => !v)}
                title={onlyPinned ? '显示全部' : '只看置顶'}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  onlyPinned
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink2 hover:text-ink'
                }`}
              >
                <IconPin width={13} height={13} />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5 pt-0.5">
            {notes.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <IconStickyNote width={18} height={18} />
                </span>
                <p className="text-xs text-ink2">还没有便签</p>
              </div>
            )}
            {notes.length > 0 && visibleNotes.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-ink2/60">没有匹配的便签</p>
            )}
            {visibleNotes.map((n) => {
              const active = n.id === selectedId
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => select(n.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                    active
                      ? 'border-accent/60 bg-accent-soft/60'
                      : 'border-transparent bg-surface/60 hover:bg-hover'
                  }`}
                >
                  <span
                    className={`block truncate text-[13px] font-semibold ${
                      active ? 'text-accent' : 'text-ink'
                    }`}
                  >
                    {n.title.trim() || '无标题'}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-accent/75">
                      {snippet(n) || '空便签'}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-ink2/55">
                      {fmtTime(n.updatedAt)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧：编辑 / 预览 */}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {selected ? (
            <>
              <input
                ref={titleRef}
                maxLength={MAX_TITLE}
                value={selected.title}
                onChange={(e) => updateNoteTitle(selected.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (mode === 'edit') bodyRef.current?.focus()
                  }
                }}
                placeholder="便签标题"
                className="w-full truncate rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink2/40 focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
              />
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className={`h-7 rounded-full px-3.5 text-[11px] font-medium transition-all ${
                    mode === 'edit'
                      ? 'bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-white shadow-[var(--shadow-glow)]'
                      : 'border border-line bg-surface text-ink2 hover:text-ink'
                  }`}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setMode('preview')}
                  className={`h-7 rounded-full px-3.5 text-[11px] font-medium transition-all ${
                    mode === 'preview'
                      ? 'bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-white shadow-[var(--shadow-glow)]'
                      : 'border border-line bg-surface text-ink2 hover:text-ink'
                  }`}
                >
                  预览
                </button>
                <span className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      toggleNotePin(selected.id)
                      toast(selected.pinned ? '已取消置顶' : '已置顶')
                    }}
                    className={`rounded-lg p-1.5 transition-colors ${
                      selected.pinned ? 'text-accent' : 'text-ink2/70 hover:bg-hover hover:text-ink'
                    }`}
                    title={selected.pinned ? '取消置顶' : '置顶此便签'}
                  >
                    <IconPin width={14} height={14} />
                  </button>
                </span>
              </div>

              {/* 内容区：独立浅灰圆角框 */}
              <div className="mt-2.5 min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-base/60">
                {mode === 'edit' ? (
                  <textarea
                    ref={bodyRef}
                    maxLength={MAX_LEN}
                    value={selected.text}
                    onChange={(e) => updateNote(selected.id, e.target.value)}
                    placeholder="写点什么…（自动保存）"
                    className="h-full w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-6 text-ink outline-none placeholder:text-ink2/45"
                  />
                ) : (
                  <div className="h-full w-full overflow-y-auto px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap break-words text-ink">
                    {selected.text ? (
                      selected.text
                    ) : (
                      <span className="text-ink2/45">暂无内容，切回「编辑」填写</span>
                    )}
                  </div>
                )}
              </div>

              {/* 底部操作条：删除 + 字数 + 关闭/保存 */}
              <div className="mt-2.5 flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => remove(selected)}
                  className="flex items-center gap-1.5 rounded-full bg-danger/10 px-3.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
                >
                  <IconTrash width={13} height={13} /> 删除
                </button>
                <span className="text-[11px] tabular-nums text-ink2/60">{selected.text.length} 字</span>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-8 rounded-lg border border-line bg-surface px-4 text-xs font-medium text-ink transition-colors hover:border-line-strong"
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={() => toast('已保存')}
                    className="h-8 rounded-lg bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] px-4 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition-all hover:brightness-110 active:scale-95"
                  >
                    保存
                  </button>
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong/60 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <IconStickyNote width={20} height={20} />
              </span>
              {notes.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-ink">这里还空空如也</p>
                  <p className="text-xs text-ink2/75">随手记点东西，自动保存并同步到你的账户</p>
                  <button type="button" onClick={create} className="btn-primary h-9 px-4 text-xs">
                    <IconPlus width={13} height={13} /> 新建便签
                  </button>
                </>
              ) : (
                <p className="text-xs text-ink2/75">从左侧选择一条便签开始编辑</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
