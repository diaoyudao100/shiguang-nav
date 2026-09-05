import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { IconTrash } from './icons'

interface ConfirmOptions {
  title?: string
  message: ReactNode
  /** 危险操作：确认按钮显示为红色 */
  danger?: boolean
  okText?: string
  cancelText?: string
}

interface ConfirmState {
  opts: ConfirmOptions
  resolve: (v: boolean) => void
}

const Ctx = createContext<{ confirm: (o: ConfirmOptions) => Promise<boolean> }>({
  confirm: async () => false,
})

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ opts, resolve }))
  }, [])

  const settle = useCallback(
    (v: boolean) => {
      state?.resolve(v)
      setState(null)
    },
    [state],
  )

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, settle])

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="anim-fade fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(false)
          }}
        >
          <div
            className="modal-card anim-pop w-full max-w-xs rounded-[20px] p-5"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2.5">
              {state.opts.danger && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <IconTrash width={15} height={15} />
                </span>
              )}
              <h3 className="text-sm font-semibold tracking-tight">
                {state.opts.title ?? (state.opts.danger ? '确认删除' : '确认操作')}
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-ink2">{state.opts.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="btn-ghost h-9 px-4 text-xs"
              >
                {state.opts.cancelText ?? '取消'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`h-9 rounded-full px-4 text-xs font-medium text-white transition-all ${
                  state.opts.danger
                    ? 'bg-danger hover:brightness-110'
                    : 'bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] shadow-[var(--shadow-glow)] hover:brightness-110'
                }`}
              >
                {state.opts.okText ?? '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm() {
  return useContext(Ctx).confirm
}
