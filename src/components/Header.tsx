import { useEffect, useRef, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { AccountMenu } from './AccountMenu'
import { BrandLogo } from './BrandLogo'
import { SearchBar } from './SearchBar'
import { IconMenu, IconMonitor, IconMoon, IconPlus, IconSettings, IconSort, IconSun } from './icons'

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 20)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function SyncChip() {
  const { sync, forceSync } = useStore()
  const { user } = useAuth()
  const time = sync.time
    ? new Date(sync.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const label = !user
    ? '本地模式'
    : sync.state === 'saving'
      ? '同步中'
      : sync.state === 'error'
        ? '同步失败'
        : `已同步 ${time}`
  const dotColor = !user
    ? 'bg-ink2/50'
    : sync.state === 'saving'
      ? 'animate-pulse bg-amber-400'
      : sync.state === 'error'
        ? 'bg-danger'
        : 'bg-emerald-400'
  return (
    <button
      type="button"
      onClick={() => user && forceSync()}
      title={
        sync.state === 'error'
          ? `同步失败：${sync.errMsg ?? '网络异常'}，点击重试`
          : user
            ? '点击立即同步'
            : '本地模式：登录后可云同步'
      }
      className="hidden h-10 items-center gap-1.5 rounded-full border border-line bg-surface/60 px-3 text-[11px] text-ink2 transition-colors hover:border-line-strong hover:text-ink lg:flex"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </button>
  )
}

function ThemeSwitch() {
  const { mode, setMode } = useTheme()
  const { setSettings } = useStore()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const opts = [
    { id: 'light', icon: IconSun, title: '浅色' },
    { id: 'dark', icon: IconMoon, title: '深色' },
    { id: 'system', icon: IconMonitor, title: '跟随系统' },
  ] as const
  const current = opts.find((o) => o.id === mode) ?? opts[2]
  const apply = (id: (typeof opts)[number]['id']) => {
    setMode(id)
    setSettings({ theme: id })
    setOpen(false)
  }
  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`主题：${current.title}（点击切换）`}
        aria-label="切换主题"
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink2 transition-colors hover:bg-hover hover:text-ink sm:h-8 sm:w-8 sm:rounded-[9px]"
      >
        <current.icon width={15} height={15} />
      </button>
      {open && (
        <div className="glass-panel anim-pop absolute right-0 top-12 z-50 w-32 rounded-2xl p-1.5 shadow-pop">
          {opts.map((o) => (
            <button
              key={o.id}
              onClick={() => apply(o.id)}
              className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-hover ${
                mode === o.id ? 'font-medium text-accent' : 'text-ink'
              }`}
            >
              <o.icon width={14} height={14} />
              {o.title}
              {mode === o.id && <span className="ml-auto text-[11px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface HeaderProps {
  onAdd: () => void
  onSettings: () => void
  onToggleSidebar: () => void
  sortMode: boolean
  onToggleSort: () => void
  search: {
    scope: 'in' | 'out'
    setScope: (s: 'in' | 'out') => void
    query: string
    setQuery: (q: string) => void
  }
}

export function Header({ onAdd, onSettings, onToggleSidebar, sortMode, onToggleSort, search }: HeaderProps) {
  const clock = useClock()
  const { data } = useStore()
  const { user } = useAuth()
  const brand = data.settings.siteTitle?.trim() || '拾光导航'
  // 滚动响应：离开顶部后顶栏加深阴影，页面更有整体感
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={`glass-header sticky top-0 z-40 transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_14px_36px_-24px_rgba(0,0,0,0.5)]' : ''
      }`}
    >
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 md:px-6">
        <button
          onClick={onToggleSidebar}
          className="shrink-0 rounded-lg p-1.5 text-ink2 transition-colors hover:bg-hover hover:text-ink sm:p-2 md:hidden"
          aria-label="打开菜单"
        >
          <IconMenu width={18} height={18} />
        </button>

        <div className="flex min-w-0 shrink items-center gap-2.5 sm:gap-3">
          <BrandLogo
            boxCls="h-9 w-9 rounded-[12px] sm:h-10 sm:w-10 sm:rounded-[13px]"
            letterCls="text-[16px] sm:text-[18px]"
            title={brand}
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[16px] font-semibold tracking-tight sm:text-[18px]">{brand}</div>
            <div className="mt-0.5 hidden text-[11px] tracking-[0.28em] text-ink2/75 xl:block">
              个人网址导航
            </div>
          </div>
        </div>
        <span aria-hidden className="hidden shrink-0 items-center gap-3 xl:flex">
          <span className="h-4 w-px bg-line-strong/60" />
          <span className="clock-display text-[17px] leading-none">{clock}</span>
        </span>

        {/* 顶栏中部搜索框 */}
        <div className="mx-2 hidden min-w-0 flex-1 md:block">
          <SearchBar compact scope={search.scope} setScope={search.setScope} query={search.query} setQuery={search.setQuery} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SyncChip />
          {/* 三模块：主题 / 排序 / 设置，整体由一张卡包裹（排序为拖拽功能，触屏无 hover 拖拽，小屏隐藏） */}
          <div className="flex h-9 items-center gap-0.5 rounded-[11px] border border-line bg-surface/70 p-0.5 shadow-sm sm:h-10 sm:rounded-[13px] sm:p-1">
            <ThemeSwitch />
            <button
              onClick={onToggleSort}
              className={`hidden h-7 w-7 items-center justify-center rounded-[8px] transition-colors sm:flex sm:h-8 sm:w-8 sm:rounded-[9px] ${
                sortMode ? 'bg-accent-soft text-accent' : 'text-ink2 hover:bg-hover hover:text-ink'
              }`}
              aria-pressed={sortMode}
              aria-label="排序模式"
              title={sortMode ? '退出排序模式' : '排序模式：拖拽调整网址卡片顺序'}
            >
              <IconSort width={15} height={15} />
            </button>
            <button
              onClick={onSettings}
              className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink2 transition-colors hover:bg-hover hover:text-ink sm:h-8 sm:w-8 sm:rounded-[9px]"
              aria-label="设置"
              title="设置"
            >
              <IconSettings width={15} height={15} />
            </button>
          </div>
          {user ? (
            <>
              <span className="hidden h-5 w-px bg-line sm:block" />
              <AccountMenu />
            </>
          ) : (
            <AccountMenu />
          )}
          <button onClick={onAdd} className="btn-primary h-9 px-3 sm:h-10 sm:px-5" aria-label="添加">
            <IconPlus width={14} height={14} />
            <span className="hidden sm:inline">添加</span>
          </button>
        </div>
      </div>
    </header>
  )
}
