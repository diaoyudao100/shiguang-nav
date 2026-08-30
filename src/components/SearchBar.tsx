import { useEffect, useRef, useState } from 'react'
import { SEARCH_ENGINES, getEngine } from '../lib/search'
import { faviconUrl } from '../lib/favicon'
import { useStore } from '../hooks/useStore'
import { IconGlobe, IconSearch } from './icons'

interface SearchBarProps {
  scope: 'in' | 'out'
  setScope: (s: 'in' | 'out') => void
  query: string
  setQuery: (q: string) => void
  compact?: boolean // 顶栏内嵌的紧凑样式
}

export function SearchBar({ scope, setScope, query, setQuery, compact }: SearchBarProps) {
  const { data, setSettings } = useStore()
  const engine = getEngine(data.settings.searchEngine)
  const inputRef = useRef<HTMLInputElement>(null)
  const [engineOpen, setEngineOpen] = useState(false)

  // ⌘K / Ctrl+K 聚焦搜索，Esc 清空
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setScope('in')
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) setQuery('')
        else inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [query, setQuery, setScope])

  const submit = () => {
    const q = query.trim()
    if (!q) return
    if (scope === 'out') {
      const target = q.match(/^https?:\/\/\S+$/i) ? q : engine.url.replace('%s', encodeURIComponent(q))
      window.open(target, '_blank', 'noopener')
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div
        className={`glass-panel flex items-center rounded-2xl pl-1 pr-1.5 shadow-card transition-all duration-200 focus-within:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] focus-within:shadow-glow focus-within:ring-4 focus-within:ring-accent/10 ${
          compact ? 'h-10' : 'h-[52px] pl-1.5'
        }`}
      >
        {/* 站内 / 站外 */}
        <div className="flex shrink-0 rounded-xl bg-base p-0.5">
          {(
            [
              ['in', '站内'],
              ['out', '站外'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              className={`h-8 rounded-[10px] px-3 text-xs font-medium transition-all ${
                scope === id
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <IconSearch width={15} height={15} className="mx-3 shrink-0 text-ink2/70" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={scope === 'in' ? '搜索站内网站…' : `用 ${engine.name} 搜索，回车打开`}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink2/50"
          type="text"
          role="searchbox"
        />

        {query && (
          <button
            onClick={() => setQuery('')}
            className="mr-1 shrink-0 rounded-md px-1.5 py-1 text-xs text-ink2 transition-colors hover:text-ink"
            aria-label="清空"
          >
            清空
          </button>
        )}
        <kbd className="kbd me-1.5 hidden sm:inline-flex">⌘K</kbd>

        {scope === 'out' && (
          <div className="relative shrink-0">
            <button
              onClick={() => setEngineOpen((v) => !v)}
              onBlur={() => setTimeout(() => setEngineOpen(false), 150)}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-base px-2.5 py-1.5 text-xs text-ink2 transition-colors hover:text-ink"
            >
              <img src={faviconUrl('https://' + engine.host)} alt="" className="h-3.5 w-3.5 rounded-sm" />
              {engine.name}
              <IconGlobe width={11} height={11} className="opacity-60" />
            </button>
            {engineOpen && (
              <div className="glass-panel anim-pop absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl py-1 shadow-pop">
                {SEARCH_ENGINES.map((se) => (
                  <button
                    key={se.id}
                    onMouseDown={() => {
                      setSettings({ searchEngine: se.id })
                      setEngineOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors hover:bg-hover ${
                      se.id === engine.id ? 'text-accent' : 'text-ink'
                    }`}
                  >
                    <img src={faviconUrl('https://' + se.host)} alt="" className="h-3.5 w-3.5 rounded-sm" />
                    {se.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
