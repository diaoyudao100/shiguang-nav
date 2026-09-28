import { AlarmClock, BellRing, Check, X } from 'lucide-react'
import type { Todo } from '../types'
import type { TodoBannerItem } from '../hooks/useTodoReminders'

function Row({
  item,
  onComplete,
  onSnooze,
  onDismiss,
  onOpenManage,
}: {
  item: TodoBannerItem
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
  onDismiss: (id: string) => void
  onOpenManage: () => void
}) {
  const { todo, label } = item
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2">
      <button type="button" onClick={onOpenManage} title="点击管理待办" className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold">{todo.title}</span>
          {todo.repeat === 'daily' && (
            <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[10px] leading-4">每天</span>
          )}
          {todo.repeat === 'weekly' && (
            <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[10px] leading-4">每周</span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/85">
          <AlarmClock width={12} height={12} className="shrink-0" />
          <span className="truncate">{label}</span>
          {todo.note && <span className="hidden truncate opacity-80 sm:inline">· {todo.note}</span>}
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onComplete(todo.id)}
          className="flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-red-600 shadow-sm transition-all hover:brightness-95 active:scale-95"
        >
          <Check width={13} height={13} /> 完成
        </button>
        <button
          type="button"
          onClick={() => onSnooze(todo.id)}
          className="hidden h-8 items-center rounded-full border border-white/40 px-3 text-xs font-medium text-white transition-colors hover:bg-white/15 sm:flex"
        >
          稍后
        </button>
        <button
          type="button"
          onClick={() => onDismiss(todo.id)}
          aria-label="关闭提醒"
          title="关闭（下一个提醒节点照常提示）"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X width={15} height={15} />
        </button>
      </span>
    </div>
  )
}

/** 待办提醒条：固定悬浮在顶栏之上的红色公告条，不挤压布局。
 *  多条到期时在条内上下堆叠，全部处理后收起。 */
export function TodoBanner({
  items,
  onComplete,
  onSnooze,
  onDismiss,
  onOpenManage,
}: {
  items: TodoBannerItem[]
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
  onDismiss: (id: string) => void
  onOpenManage: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex justify-center px-2 pt-2 sm:px-4 sm:pt-3">
      <div
        role="alert"
        className="anim-drop pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-red-400/30 bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_18px_44px_-16px_rgba(220,38,38,0.65)]"
      >
        <div className="flex items-center gap-2 px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
          <BellRing width={13} height={13} />
          待办提醒
          {items.length > 1 && <span className="tracking-normal">· {items.length} 项</span>}
        </div>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto p-2.5 pt-1.5">
          {items.map((item) => (
            <Row
              key={item.todo.id}
              item={item}
              onComplete={onComplete}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
              onOpenManage={onOpenManage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
