import { useRef } from 'react'
import { useStore } from '../hooks/useStore'
import { Modal } from './Modal'
import { IconPin, IconPlus, IconStickyNote, IconTrash } from './icons'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'

const MAX_LEN = 2000

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${hhmm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 便签面板：本地与云端实时同步（随数据一并保存），置顶排前、自动存稿 */
export function NotesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addNote, updateNote, toggleNotePin, deleteNote } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const focusId = useRef<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const notes = [...(data.notes ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  )

  const create = () => {
    const n = addNote()
    focusId.current = n.id
    bodyRef.current?.scrollTo({ top: 0 })
  }

  const remove = async (id: string, preview: string) => {
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
    deleteNote(id)
    toast('便签已删除')
  }

  return (
    <Modal
      open={open}
      title="便签"
      onClose={onClose}
      width="max-w-lg"
      headerExtra={
        <button
          type="button"
          onClick={create}
          className="flex h-7 items-center gap-1 rounded-full bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] px-3 text-[11px] font-medium text-white shadow-[var(--shadow-glow)] transition-all hover:brightness-110 active:scale-95"
        >
          <IconPlus width={11} height={11} /> 新建
        </button>
      }
    >
      <div ref={bodyRef} className="flex flex-col gap-2.5 overflow-y-auto pr-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-12 text-center">
            <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <IconStickyNote width={20} height={20} />
            </span>
            <p className="text-sm text-ink2">还没有便签</p>
            <p className="mt-1 text-xs text-ink2/70">随手记点东西，自动保存并同步到你的账户</p>
            <button type="button" onClick={create} className="btn-primary mt-5 h-9 px-4 text-xs">
              <IconPlus width={13} height={13} /> 新建便签
            </button>
          </div>
        ) : (
          notes.map((n) => {
            const rows = Math.min(8, Math.max(2, n.text.split('\n').length + (n.text.endsWith('\n') ? 1 : 0)))
            return (
              <div
                key={n.id}
                className={`rounded-xl border bg-base/40 p-3 transition-colors ${
                  n.pinned ? 'border-accent/30 bg-accent-soft/30' : 'border-line'
                }`}
              >
                <textarea
                  ref={(el) => {
                    if (el && focusId.current === n.id) {
                      focusId.current = null
                      el.focus()
                      const end = el.value.length
                      el.setSelectionRange(end, end)
                    }
                  }}
                  rows={rows}
                  maxLength={MAX_LEN}
                  value={n.text}
                  onChange={(e) => updateNote(n.id, e.target.value)}
                  placeholder="写点什么…（自动保存）"
                  className="w-full resize-none bg-transparent text-[13px] leading-6 text-ink outline-none placeholder:text-ink2/45"
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] tabular-nums text-ink2/60">
                    {n.text.length >= MAX_LEN - 100 ? `${n.text.length}/${MAX_LEN} · ` : ''}
                    更新于 {fmtTime(n.updatedAt)}
                  </span>
                  <span className="ml-auto flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        toggleNotePin(n.id)
                        toast(n.pinned ? '已取消置顶' : '已置顶')
                      }}
                      className={`rounded-md p-1 transition-colors ${
                        n.pinned ? 'text-accent' : 'text-ink2/70 hover:bg-hover hover:text-ink'
                      }`}
                      title={n.pinned ? '取消置顶' : '置顶此便签'}
                    >
                      <IconPin width={12} height={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n.id, n.text)}
                      className="rounded-md p-1 text-ink2/70 transition-colors hover:bg-hover hover:text-danger"
                      title="删除便签"
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
      {notes.length > 0 && (
        <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-ink2/55">
          便签自动保存，并随账户数据同步到云端；最多 {MAX_LEN} 字
        </p>
      )}
    </Modal>
  )
}
