import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { AccountMenu } from './AccountMenu'
import { SearchBar } from './SearchBar'
import { IconMenu, IconMonitor, IconMoon, IconPlus, IconSettings, IconSun } from './icons'

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
  const { sync } = useStore()
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
    <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/60 px-2.5 py-1 text-[11px] text-ink2 lg:flex">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  )
}

function ThemeSwitch() {
  const { mode, setMode } = useTheme()
  const { setSettings } = useStore()
  const opts = [
    { id: 'light', icon: IconSun, title: '浅色' },
    { id: 'dark', icon: IconMoon, title: '深色' },
    { id: 'system', icon: IconMonitor, title: '跟随系统' },
  ] as const
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface/60 p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          title={o.title}
          aria-label={o.title}
          onClick={() => {
            setMode(o.id)
            setSettings({ theme: o.id })
          }}
          className={`rounded-full p-1.5 transition-all ${
            mode === o.id
              ? 'bg-surface text-accent shadow-sm'
              : 'text-ink2 hover:bg-hover hover:text-ink'
          }`}
        >
          <o.icon width={14} height={14} />
        </button>
      ))}
    </div>
  )
}

interface HeaderProps {
  onAdd: () => void
  onSettings: () => void
  onToggleSidebar: () => void
  search: {
    scope: 'in' | 'out'
    setScope: (s: 'in' | 'out') => void
    query: string
    setQuery: (q: string) => void
  }
}

export function Header({ onAdd, onSettings, onToggleSidebar, search }: HeaderProps) {
  const clock = useClock()
  const { data } = useStore()
  const brand = data.settings.siteTitle?.trim() || '拾光导航'
  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="flex h-16 items-center gap-3 px-5 md:px-6">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-ink2 transition-colors hover:bg-hover hover:text-ink md:hidden"
          aria-label="打开菜单"
        >
          <IconMenu width={18} height={18} />
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-[18px] font-semibold text-white shadow-[var(--shadow-glow)]">
            <span className="drop-shadow-sm">{brand.charAt(0)}</span>
            <span className="pointer-events-none absolute inset-0 rounded-[13px] ring-1 ring-inset ring-white/25" />
          </div>
          <div className="leading-tight">
            <div className="text-[18px] font-semibold tracking-tight">{brand}</div>
            <div className="mt-0.5 hidden text-[11px] tracking-[0.28em] text-ink2/75 xl:block">
              个人网址导航
            </div>
          </div>
        </div>
        <span className="hidden font-mono text-[11px] text-ink2/60 xl:inline">~/Y-{clock}</span>

        {/* 顶栏中部搜索框 */}
        <div className="mx-2 hidden min-w-0 flex-1 md:block">
          <SearchBar compact scope={search.scope} setScope={search.setScope} query={search.query} setQuery={search.setQuery} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SyncChip />
          <ThemeSwitch />
          <button
            onClick={onSettings}
            className="rounded-full border border-line bg-surface/60 p-2 text-ink2 transition-all hover:border-line-strong hover:text-ink"
            aria-label="设置"
            title="设置"
          >
            <IconSettings width={15} height={15} />
          </button>
          <AccountMenu />
          <button onClick={onAdd} className="btn-primary">
            <IconPlus width={14} height={14} /> 添加
          </button>
        </div>
      </div>
    </header>
  )
}
