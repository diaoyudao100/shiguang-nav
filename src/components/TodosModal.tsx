import { useEffect, useMemo, useState } from 'react'
import { AlarmClock, Bell, CalendarClock, Check, ListTodo, Pencil, Plus, Sparkles, Trash2, Trash } from 'lucide-react'
import type { Todo } from '../types'
import { useStore } from '../hooks/useStore'
import { Modal, inputCls } from './Modal'
import { SelectMenu } from './SelectMenu'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import { REPEAT_OPTS, nextRemindAt, normalizeRepeatDays, repeatBadgeText } from '../lib/todo'
import { aiConfigured, aiParseTodo } from '../lib/ai'

const MAX_TITLE = 60
const MAX_NOTE = 200

/** 重复下拉选项：「每 N 天」的标签跟随当前天数 */
function repeatOptions(days: string) {
  return REPEAT_OPTS.map((o) =>
    o.value === 'ndays'
      ? { value: o.value, label: days ? `每 ${normalizeRepeatDays(days)} 天` : '每 N 天' }
      : { value: o.value, label: o.label },
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 时间戳 → datetime-local 输入值（本地时区） */
function toInputValue(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const sameYear = d.getFullYear() === now.getFullYear()
  return `${sameYear ? '' : d.getFullYear() + '/'}${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

/** 待办事项：添加（标题 + 到期时间 + 重复）、完成/取消、编辑、删除。
 *  到点提醒由 useTodoReminders 驱动（顶部红条 + 可选系统通知/提示音）。 */
export function TodosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addTodo, updateTodo, toggleTodoDone, deleteTodo, deleteDoneTodos, setSettings } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const adv = Number(data.settings.todoAdvanceDays ?? '7')

  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState<Todo['repeat']>('none')
  const [repeatDays, setRepeatDays] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    title: string
    note: string
    time: string
    repeat: Todo['repeat']
    repeatDays: string
  } | null>(null)

  const defaultTime = () => {
    const d = new Date(Date.now() + 3600_000)
    d.setSeconds(0, 0)
    return toInputValue(d.getTime())
  }

  // 打开时清空表单、时间给默认值（1 小时后整分）
  useEffect(() => {
    if (open) {
      setTitle('')
      setTime(defaultTime())
      setRepeat('none')
      setRepeatDays('')
      setEditingId(null)
      setDraft(null)
    }
  }, [open])

  const todos = data.todos ?? []
  const pending = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => a.remindAt - b.remindAt),
    [todos],
  )
  const done = useMemo(
    () => todos.filter((t) => t.done).sort((a, b) => b.remindAt - a.remindAt),
    [todos],
  )
  const isOverdue = (t: Todo) => !t.done && t.remindAt <= Date.now()

  /** AI 解析：把输入框里的一句自然语言填充到表单（不直接创建，用户确认后手动添加） */
  const [aiParsing, setAiParsing] = useState(false)
  const aiFill = async () => {
    const q = title.trim()
    if (!q) {
      toast('先在输入框写一句话（如下周五下午3点复诊），再点 AI 解析')
      return
    }
    if (!aiConfigured(data.settings)) {
      toast('请先在 设置 → AI 助手 中配置 API KEY')
      return
    }
    setAiParsing(true)
    const r = await aiParseTodo(data.settings, q)
    setAiParsing(false)
    if (!r) {
      toast('AI 没能解析出待办，试试把时间说得更明确些')
      return
    }
    setTitle(r.title)
    setTime(toInputValue(r.remindAt ?? Date.now() + 3600_000))
    setRepeat(r.repeat ?? 'none')
    setRepeatDays(r.repeatDays ? String(r.repeatDays) : '')
    toast('已按描述填充，请确认后点添加')
  }

  const submit = () => {
    const ts = time ? new Date(time).getTime() : NaN
    if (!title.trim()) {
      toast('请填写待办内容')
      return
    }
    if (Number.isNaN(ts)) {
      toast('请选择到期时间')
      return
    }
    addTodo({ title: title.trim(), remindAt: ts, repeat, repeatDays: Number(repeatDays) })
    setTitle('')
    setTime(defaultTime())
    setRepeat('none')
    setRepeatDays('')
    toast(
      Date.now() - adv * 86400_000 <= ts
        ? `已添加，到期前 ${adv} 天开始提醒`
        : `已添加，已进入提醒期（距到期不足 ${adv} 天）`,
    )
  }

  const startEdit = (t: Todo) => {
    setEditingId(t.id)
    setDraft({
      title: t.title,
      note: t.note,
      time: toInputValue(t.remindAt),
      repeat: t.repeat ?? 'none',
      repeatDays: t.repeat === 'ndays' ? String(normalizeRepeatDays(t.repeatDays)) : '',
    })
  }

  const saveEdit = () => {
    if (!editingId || !draft) return
    const ts = draft.time ? new Date(draft.time).getTime() : NaN
    if (!draft.title.trim()) {
      toast('请填写待办内容')
      return
    }
    if (Number.isNaN(ts)) {
      toast('请选择到期时间')
      return
    }
    // 改了到期时间 = 重排提醒节点，清掉已提醒/稍后标记
    updateTodo(editingId, {
      title: draft.title.trim(),
      note: draft.note.trim(),
      remindAt: ts,
      repeat: draft.repeat,
      repeatDays: draft.repeat === 'ndays' ? normalizeRepeatDays(draft.repeatDays) : undefined,
      remindedAt: undefined,
      snoozedUntil: undefined,
    })
    setEditingId(null)
    setDraft(null)
    toast('已保存')
  }

  const remove = async (t: Todo) => {
    const ok = await confirm({
      danger: true,
      title: '删除待办',
      message: (
        <>
          确定删除这条待办吗？
          <br />
          <span className="line-clamp-2 text-ink2/70">「{t.title}」</span>
        </>
      ),
      okText: '删除',
    })
    if (!ok) return
    deleteTodo(t.id)
    if (editingId === t.id) {
      setEditingId(null)
      setDraft(null)
    }
    toast('待办已删除')
  }

  const clearDone = async () => {
    if (done.length === 0) return
    const ok = await confirm({
      danger: true,
      title: '清空已完成',
      message: `将删除全部 ${done.length} 条已完成的待办，无法恢复。`,
      okText: '清空',
    })
    if (!ok) return
    deleteDoneTodos()
    toast('已清空完成的待办')
  }

  /** 系统通知状态行：默认权限时给一键开启入口；被拒时说明原因 */
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  const notificationRow =
    !data.settings.todoNotify || perm !== 'granted' ? (
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-base px-3.5 py-2.5 text-xs text-ink2">
        <Bell width={13} height={13} className="shrink-0 opacity-70" />
        {perm === 'unsupported' ? (
          <span>当前浏览器不支持系统通知，到点时以页面顶部横幅提醒</span>
        ) : perm === 'denied' ? (
          <span>系统通知已被浏览器拒绝，如需开启请在浏览器地址栏权限设置中允许通知</span>
        ) : !data.settings.todoNotify ? (
          <button
            type="button"
            className="font-medium text-accent transition-colors hover:underline"
            onClick={() => {
              setSettings({ todoNotify: true })
              if (perm === 'default') void Notification.requestPermission()
              toast('已开启系统通知')
            }}
          >
            系统通知已关闭，点击开启
          </button>
        ) : (
          <button
            type="button"
            className="font-medium text-accent transition-colors hover:underline"
            onClick={async () => {
              const r = await Notification.requestPermission()
              toast(r === 'granted' ? '系统通知已开启，后台到点也会提醒' : '未获得通知权限，仍会以页面横幅提醒')
            }}
          >
            开启系统通知（页面在后台时也能收到）
          </button>
        )}
      </div>
    ) : null

  const repeatBadge = (t: Todo) => {
    const text = repeatBadgeText(t)
    return text ? <span className="shrink-0 text-[10px] font-normal text-accent">{text}</span> : null
  }

  const row = (t: Todo, muted: boolean) => {
    const editing = editingId === t.id
    if (editing && draft) {
      return (
        <div key={t.id} className="rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
          <input
            value={draft.title}
            maxLength={MAX_TITLE}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="待办内容"
            className={`${inputCls} !py-2 text-[13px]`}
          />
          <input
            value={draft.note}
            maxLength={MAX_NOTE}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="备注（可选）"
            className={`${inputCls} mt-1.5 !py-2 text-xs`}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input
              type="datetime-local"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              className={`${inputCls} !w-[168px] shrink-0 !px-2.5 !py-1.5 text-xs tabular-nums`}
            />
            <SelectMenu
              value={draft.repeat ?? 'none'}
              onChange={(v) => setDraft({ ...draft, repeat: v as Todo['repeat'] })}
              options={repeatOptions(draft.repeatDays)}
              variant="compact"
              className="h-[30px] w-[104px] shrink-0 text-xs"
              ariaLabel="重复"
            />
            {draft.repeat === 'ndays' && (
              <input
                type="number"
                min={1}
                max={365}
                value={draft.repeatDays}
                onChange={(e) => setDraft({ ...draft, repeatDays: e.target.value })}
                aria-label="重复间隔天数"
                placeholder="34"
                className={`${inputCls} !w-[68px] shrink-0 !px-2 !py-1.5 text-center text-xs tabular-nums`}
              />
            )}
            {draft.repeat === 'ndays' && <span className="text-xs text-ink2">天</span>}
            <button
              type="button"
              onClick={saveEdit}
              className="h-[30px] shrink-0 rounded-[10px] bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] px-3.5 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-95"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(null)
              }}
              className="h-[30px] shrink-0 rounded-[10px] border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-line-strong"
            >
              取消
            </button>
          </div>
        </div>
      )
    }
    return (
      <div
        key={t.id}
        className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
          muted ? 'border-line/60 bg-surface/40' : 'border-line bg-surface/70 hover:bg-hover'
        }`}
      >
        <button
          type="button"
          aria-label={t.done ? '标记为未完成' : '标记为已完成'}
          onClick={() => {
            const cycling = !t.done && t.repeat && t.repeat !== 'none'
            toggleTodoDone(t.id)
            if (cycling) toast(`已完成，下次到期 ${fmtWhen(nextRemindAt(t))}`)
          }}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
            t.done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-line-strong text-transparent hover:border-emerald-500 hover:text-emerald-500'
          }`}
        >
          <Check width={12} height={12} strokeWidth={3} />
        </button>
        <button type="button" onClick={() => !t.done && startEdit(t)} className="min-w-0 flex-1 text-left">
          <span className={`flex items-center gap-1.5 ${t.done ? 'text-ink2/60 line-through' : 'font-medium text-ink'}`}>
            <span className="truncate text-[13px]">{t.title}</span>
            {!t.done && repeatBadge(t)}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px]">
            {t.note && <span className="min-w-0 truncate text-ink2/70">{t.note}</span>}
            <span
              className={`shrink-0 tabular-nums ${
                isOverdue(t) ? 'font-medium text-danger' : 'text-ink2/55'
              }`}
            >
              {isOverdue(t) ? '已过期 · ' : ''}
              {fmtWhen(t.remindAt)}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-0.5">
          {!t.done && (
            <button
              type="button"
              aria-label="编辑待办"
              onClick={() => startEdit(t)}
              className="rounded-lg p-1.5 text-ink2/60 transition-colors hover:bg-hover hover:text-ink"
            >
              <Pencil width={13} height={13} />
            </button>
          )}
          <button
            type="button"
            aria-label="删除待办"
            onClick={() => void remove(t)}
            className="rounded-lg p-1.5 text-ink2/60 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 width={13} height={13} />
          </button>
        </span>
      </div>
    )
  }

  return (
    <Modal
      open={open}
      title="待办事项"
      onClose={onClose}
      width="max-w-lg"
      icon={
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <ListTodo width={17} height={17} />
        </span>
      }
    >
      {/* 添加表单：第一行内容 + 添加；第二行到期时间 + 重复 */}
      <div className="flex items-center gap-1.5">
        <input
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="要做什么？"
          className={`${inputCls} min-w-0 flex-1 !py-2 text-[13px]`}
        />
        <button
          type="button"
          onClick={() => void aiFill()}
          disabled={aiParsing}
          aria-label="AI 解析"
          title="AI 解析：用一句自然语言自动填充标题与到期时间"
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border text-accent transition-all hover:border-accent/40 hover:bg-accent-soft active:scale-95 disabled:opacity-60 ${
            aiParsing ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface'
          }`}
        >
          <Sparkles width={15} height={15} className={aiParsing ? 'animate-pulse' : ''} />
        </button>
        <button
          type="button"
          onClick={submit}
          aria-label="添加待办"
          className="flex h-[38px] shrink-0 items-center gap-1 rounded-[10px] bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] px-3.5 text-xs font-medium text-white shadow-[var(--shadow-glow)] transition-all hover:brightness-110 active:scale-95"
        >
          <Plus width={14} height={14} />
          <span className="hidden sm:inline">添加</span>
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="到期时间"
          title={`到期时间：提前 ${adv} 天开始提醒`}
          className={`${inputCls} !w-[168px] shrink-0 !px-2.5 !py-2 text-xs tabular-nums`}
        />
        <SelectMenu
          value={repeat ?? 'none'}
          onChange={(v) => setRepeat(v as Todo['repeat'])}
          options={repeatOptions(repeatDays)}
          variant="compact"
          className="h-[38px] w-[112px] shrink-0 text-xs"
          ariaLabel="重复"
        />
        {repeat === 'ndays' && (
          <input
            type="number"
            min={1}
            max={365}
            value={repeatDays}
            onChange={(e) => setRepeatDays(e.target.value)}
            aria-label="重复间隔天数"
            placeholder="34"
            className={`${inputCls} !w-[68px] shrink-0 !px-2 !py-2 text-center text-xs tabular-nums`}
          />
        )}
        {repeat === 'ndays' && <span className="shrink-0 text-xs text-ink2">天</span>}
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink2/55">
          {repeat === 'daily'
            ? '完成后自动滚动到明天'
            : repeat === 'weekly'
              ? '完成后自动滚动到下周'
              : repeat === 'ndays'
                ? `完成后自动滚动到 ${normalizeRepeatDays(repeatDays)} 天后`
                : `到期前 ${adv} 天开始提醒`}
        </span>
      </div>

      {notificationRow}

      {/* 列表 */}
      <div className="mt-3 flex max-h-[46dvh] min-h-0 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {todos.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line-strong/60 px-6 py-9 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CalendarClock width={19} height={19} />
            </span>
            <p className="text-sm font-medium text-ink">还没有待办</p>
            <p className="text-xs text-ink2/75">写下要做的事和到期时间，到期前 {adv} 天开始在页面顶部提醒你</p>
          </div>
        )}
        {pending.length > 0 && (
          <p className="px-1 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-ink2/60">
            待完成 {pending.length} 项
          </p>
        )}
        {pending.map((t) => row(t, false))}
        {done.length > 0 && (
          <p className="flex items-center justify-between px-1 pb-0.5 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-ink2/50">
            <span>已完成 {done.length} 项</span>
            <button
              type="button"
              onClick={() => void clearDone()}
              className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 tracking-normal text-ink2/60 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash width={11} height={11} /> 清空
            </button>
          </p>
        )}
        {done.map((t) => row(t, true))}
      </div>

      {todos.length > 0 && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink2/60">
          <AlarmClock width={11} height={11} className="shrink-0 opacity-70" />
          到期前 {adv} 天开始提醒，每天一次直至到期；页面开着即时弹条，错过的话下次打开会补提
        </p>
      )}
    </Modal>
  )
}
