import { useStore } from '../hooks/useStore'
import { IconFolder, IconPin, IconSettings } from './icons'

interface SidebarProps {
  activeCat: string | null // null = 全部
  onSelect: (id: string | null) => void
  onManage: () => void
  dragActiveId: string | null
  onDropToCategory: (catId: string) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  activeCat,
  onSelect,
  onManage,
  dragActiveId,
  onDropToCategory,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { data } = useStore()
  const pinnedCount = data.sites.filter((s) => s.pinned && !s.hidden).length
  const countOf = (id: string) => data.sites.filter((s) => s.categoryId === id && !s.hidden).length

  const itemCls = (active: boolean) =>
    `relative flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-sm transition-all ${
      active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-hover'
    }`

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={onCloseMobile} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col overflow-y-auto bg-surface p-4 transition-transform md:sticky md:top-16 md:z-0 md:h-[calc(100vh-4rem)] md:translate-x-0 md:border-r md:border-line md:bg-surface/50 ${
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        <div className="eyebrow flex items-center gap-2 px-2 pb-2.5 pt-1 text-ink">
          <IconFolder width={11} height={11} className="tracking-normal" /> 分类目录
          <button
            onClick={onManage}
            title="管理分类"
            aria-label="管理分类"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-ink2 transition-colors hover:bg-hover hover:text-accent"
          >
            <IconSettings width={13} height={13} />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5">
          <button
            className={itemCls(null === activeCat)}
            onClick={() => {
              onSelect(null)
              onCloseMobile()
            }}
          >
            全部网站
            <span className="ml-auto text-xs tabular-nums text-ink">
              {data.sites.filter((s) => !s.hidden).length}
            </span>
          </button>
          <button
            className={`${itemCls(activeCat === '__pinned__')} ${dragActiveId ? 'ring-2 ring-accent/40' : ''}`}
            onClick={() => {
              onSelect('__pinned__')
              onCloseMobile()
            }}
            onDragOver={(e) => dragActiveId && e.preventDefault()}
            onDrop={() => dragActiveId && onDropToCategory('__pinned__')}
          >
            <IconPin width={13} height={13} className={activeCat === '__pinned__' ? '' : 'opacity-70'} />
            置顶网站
            <span className="ml-auto text-xs tabular-nums text-ink">{pinnedCount}</span>
          </button>
          {data.categories.map((c) => (
            <button
              key={c.id}
              className={`${itemCls(activeCat === c.id)} ${dragActiveId ? 'ring-2 ring-transparent' : ''}`}
              onClick={() => {
                onSelect(c.id)
                onCloseMobile()
              }}
              onDragOver={(e) => dragActiveId && e.preventDefault()}
              onDrop={() => dragActiveId && onDropToCategory(c.id)}
            >
              {activeCat === c.id && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[var(--c-accent)] to-[var(--c-accent2)]" />
              )}
              <span className="truncate">{c.name}</span>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-ink">{countOf(c.id)}</span>
            </button>
          ))}
        </nav>
        <p className="mt-auto px-2 pt-8 text-xs leading-5 text-ink2/60">
          数据保存在浏览器本地
          <br />
          支持书签 / JSON 导入导出
        </p>
      </aside>
    </>
  )
}
