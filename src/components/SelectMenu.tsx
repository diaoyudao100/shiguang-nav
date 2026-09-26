import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDown } from './icons'

export interface SelectOption {
  value: string
  label: string
  /** 选项左侧小图标（可选） */
  icon?: ReactNode
}

interface SelectMenuProps {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  /** 触发框基础样式：input = 表单大框（py-2.5），compact = 紧凑行内（配合 className 传高度） */
  variant?: 'input' | 'compact'
  className?: string
  ariaLabel?: string
}

const BASE =
  'flex items-center justify-between gap-2 rounded-[10px] border border-line bg-base/60 text-ink outline-none transition-all hover:border-line-strong focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10'

/** 全站统一的自定义下拉：毛玻璃弹层 + 主题化选项（替代原生 select 的系统灰框）
 *  Esc/方向键/Enter 键盘操作；spaceBelow 不足时向上翻转；弹层跟随触发框滚动 */
export function SelectMenu({ value, onChange, options, variant = 'input', className = '', ariaLabel }: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(-1)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const selected = options.find((o) => o.value === value)

  const setActiveBoth = (n: number) => {
    activeRef.current = n
    setActive(n)
  }

  const openMenu = () => {
    console.log("[SM] openMenu")
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    setPos({
      left: Math.min(r.left, window.innerWidth - 160),
      top: spaceBelow < 236 ? undefined : r.bottom + 4,
      bottom: spaceBelow < 236 ? window.innerHeight - r.top + 4 : undefined,
      width: Math.max(r.width, 150),
    })
    const cur = Math.max(0, optionsRef.current.findIndex((o) => o.value === value))
    setActiveBoth(cur)
    setOpen(true)
  }
  const close = (refocus = false) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }
  const toggle = () => (open ? close(true) : openMenu())

  // 键盘：Esc 关闭（capture 拦截，防止把外层弹窗一起关掉）、方向键移动、Enter 选中
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close(true)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = (activeRef.current + (e.key === 'ArrowDown' ? 1 : -1) + optionsRef.current.length) % optionsRef.current.length
        setActiveBoth(n)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const opt = optionsRef.current[activeRef.current]
        if (opt) {
          onChange(opt.value)
          close(true)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onChange])

  // 弹层跟随触发框（弹窗内部滚动时重新定位）；滚出可视区则关闭。选项列表自身滚动不关闭
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false)
        return
      }
      setPos((p) => (p ? { ...p, left: Math.min(r.left, window.innerWidth - 160), top: r.bottom + 4, bottom: undefined } : p))
    }
    const onScroll = (e: Event) => {
      if (popupRef.current?.contains(e.target as Node)) return
      reposition()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  // 键盘高亮项滚入视野
  useEffect(() => {
    if (!open || active < 0) return
    popupRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  // 打开时点击外部关闭
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popupRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    close(true)
  }

  const triggerCls = variant === 'input' ? 'w-full px-3 py-2.5 text-[13px]' : 'px-3 text-[13px]'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            e.preventDefault()
            openMenu()
          }
        }}
        className={`${BASE} ${triggerCls} ${open ? 'border-accent/50 bg-surface ring-4 ring-accent/10' : ''} ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? options[0]?.label ?? ''}</span>
        <IconChevronDown
          width={14}
          height={14}
          className={`shrink-0 text-ink2 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div className="fixed inset-0 z-[80]" onMouseDown={(e) => e.stopPropagation()}>
            <div
              ref={popupRef}
              role="listbox"
              className="glass-panel anim-pop absolute max-h-60 overflow-y-auto rounded-xl p-1 shadow-pop"
              style={{
                left: pos.left,
                width: pos.width,
                ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
              }}
            >
              {options.map((o, i) => {
                const isSelected = o.value === value
                const isActive = i === active
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveBoth(i)}
                    onClick={() => pick(o.value)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                      isSelected ? 'font-medium text-accent' : 'text-ink'
                    } ${isActive ? 'bg-hover' : ''}`}
                  >
                    {o.icon && <span className="shrink-0 text-ink2">{o.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
