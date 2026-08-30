import { useEffect, type ReactNode } from 'react'
import { IconX } from './icons'
import { useStore } from '../hooks/useStore'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
  headerExtra?: ReactNode
}

export function Modal({ open, title, onClose, children, width = 'max-w-lg', headerExtra }: ModalProps) {
  const { data } = useStore()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && data.settings.maskClosable) onClose()
      }}
    >
      <div
        className={`anim-pop flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-pop ${width}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pb-3.5 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {headerExtra}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink2 transition-colors hover:bg-hover hover:text-ink"
            aria-label="关闭"
          >
            <IconX width={17} height={17} />
          </button>
        </div>
        <div className="border-t border-line" />
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
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

export const btnPrimary = 'btn-primary'
export const btnGhost = 'btn-ghost'
