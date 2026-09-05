import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons'
import { useStore } from '../hooks/useStore'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
  headerExtra?: ReactNode
  /** 标题左侧的自定义图标（不传用主题色光点） */
  icon?: ReactNode
  /** 弹窗之上还会叠一层选择器时，关掉本层的 Esc 关闭，让 Esc 只关最上层 */
  closeOnEsc?: boolean
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 'max-w-lg',
  headerExtra,
  icon,
  closeOnEsc = true,
}: ModalProps) {
  const { data } = useStore()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, closeOnEsc])

  if (!open) return null
  // Portal 到 body：毛玻璃/变形等祖先会劫持 fixed 定位（包含块规则），挂 body 上保证屏幕居中
  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && data.settings.maskClosable) onClose()
      }}
    >
      <div
        className={`modal-card anim-pop flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[22px] ${width}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pb-3.5 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ?? (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] shadow-[0_0_8px_color-mix(in_srgb,var(--c-accent)_60%,transparent)]"
              />
            )}
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {headerExtra}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-hover hover:text-ink"
            aria-label="关闭"
          >
            <IconX width={15} height={15} />
          </button>
        </div>
        <div className="border-t border-line" />
        {/* min-h-0：flex 子项默认 min-height 为内容高度，缺了它内容超高时不会滚动而是被硬裁 */}
        <div className="min-h-0 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-ink2">
        {label}
        {hint && <span className="text-[11px] font-normal text-ink2/70">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-[10px] border border-line bg-base/60 px-3 py-2.5 text-[13px] text-ink outline-none transition-all placeholder:text-ink2/50 hover:border-line-strong focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10'

/** 紧凑输入框/下拉框：外观同 inputCls 但不含 py-2.5 —— 用于 h-9 等固定矮高度的场合
 *  （在 inputCls 上叠 py-0 会被 Tailwind 的样式顺序翻转成 py-2.5，中文文字底部会被裁掉）。
 *  select 需自行配 leading-[高度-2px] 让文字垂直居中，如 h-9 → leading-[34px] */
export const compactCls =
  'rounded-[10px] border border-line bg-base/60 px-3 text-[13px] text-ink outline-none transition-all placeholder:text-ink2/50 hover:border-line-strong focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10'

export const btnPrimary = 'btn-primary'
export const btnGhost = 'btn-ghost'
