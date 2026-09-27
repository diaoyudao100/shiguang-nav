import { LayoutGrid } from 'lucide-react'
import { useStore } from '../hooks/useStore'
import { categoryIcon } from '../lib/categoryIcons'
import { IconChevronLeft, IconChevronRight, IconDatabase, IconPin, IconSettings } from './icons'

interface SidebarProps {
  activeCat: string | null // null = 全部
  onSelect: (id: string | null) => void
  onManage: () => void
  dragActiveId: string | null
  onDropToCategory: (catId: string) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

/** 目录行小卡片：置入左侧目录托盘内，每行独立成卡；rail=折叠成图标条 */
function Row({
  active,
  ring,
  rail,
  icon,
  label,
  count,
  onClick,
  onDragOver,
  onDrop,
}: {
  active: boolean
  ring?: boolean
  rail?: boolean
  icon: React.ReactNode
  label: string
  count?: number
  onClick: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={rail ? label : undefined}
      className={`relative flex shrink-0 items-center gap-2.5 border text-sm transition-all duration-150 ${
        rail ? 'h-10 w-10 justify-center rounded-[10px]' : 'h-11 w-full rounded-[12px] px-2.5'
      } ${
        active
          ? 'border-accent/30 bg-accent-soft text-accent shadow-sm'
          : 'border-line bg-surface/85 text-ink hover:-translate-y-px hover:border-line-strong hover:bg-surface hover:shadow-card'
      } ${ring ? 'ring-2 ring-accent/40' : ''}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border transition-colors ${
          active ? 'border-accent/25 bg-accent/10 text-accent' : 'border-line bg-base text-ink2'
        }`}
      >
        {icon}
      </span>
      {!rail && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {typeof count === 'number' && (
            <span
              className={`shrink-0 rounded-full px-2 text-[11px] font-normal leading-[18px] tabular-nums ${
                active ? 'bg-accent/15 text-accent' : 'bg-hover text-ink2'
              }`}
            >
              {count}
            </span>
          )}
        </>
      )}
    </button>
  )
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
  const { data, setSettings } = useStore()
  const total = data.sites.filter((s) => !s.hidden).length
  const pinnedCount = data.sites.filter((s) => s.pinned && !s.hidden).length
  const countOf = (id: string) => data.sites.filter((s) => s.categoryId === id && !s.hidden).length
  const collapsed = !!data.settings.sidebarCollapsed && !mobileOpen

  const toggleCollapsed = () => setSettings({ sidebarCollapsed: !data.settings.sidebarCollapsed })

  const rowProps = (id: string | null) => ({
    active: activeCat === id,
    onClick: () => {
      onSelect(id)
      onCloseMobile()
    },
  })
  const dropProps = (id: string) => ({
    onDragOver: (e: React.DragEvent) => dragActiveId && e.preventDefault(),
    onDrop: () => dragActiveId && onDropToCategory(id),
  })

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => onCloseMobile()} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col p-3 transition-transform duration-300 md:sticky md:top-16 md:z-0 md:h-[calc(100vh-4rem)] md:translate-x-0 md:p-3.5 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-[76px]' : ''}`}
      >
        {/* 收起/展开：骑缝在托盘右缘、竖直居中 */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? '展开分类目录' : '收起分类目录'}
          aria-label={collapsed ? '展开分类目录' : '收起分类目录'}
          className={`absolute top-1/2 z-20 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-sm transition-colors hover:text-accent md:flex ${
            collapsed ? '-right-2.5' : 'right-0.5'
          }`}
        >
          {collapsed ? <IconChevronRight width={12} height={12} /> : <IconChevronLeft width={12} height={12} />}
        </button>
        {/* 目录托盘：一块独立的毛玻璃底座，把右侧面板隔开；行与行仍是独立小卡片 */}
        <div
          className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-line bg-base/45 p-2.5 shadow-sm backdrop-blur-xl ${
            collapsed ? 'md:w-[60px] md:rounded-2xl md:p-2' : 'md:rounded-[22px] md:p-3'
          } ${mobileOpen ? 'shadow-2xl' : ''}`}
        >
          {/* 托盘头部：标题 + 管理（折叠时隐藏，展开按钮在骑缝位置） */}
          {!collapsed && (
            <div className="flex shrink-0 items-center justify-between px-1.5 pb-2 pt-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink2/60">
                分类目录
              </span>
              <button
                onClick={onManage}
                title="管理分类"
                aria-label="管理分类"
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-hover hover:text-accent"
              >
                <IconSettings width={14} height={14} />
              </button>
            </div>
          )}

          {/* 小卡片列表区（内部滚动） */}
          <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 ${collapsed ? 'items-center' : ''}`}>
            <Row
              rail={collapsed}
              icon={<LayoutGrid width={14} height={14} />}
              label="全部网站"
              count={total}
              {...rowProps(null)}
            />
            <Row
              rail={collapsed}
              icon={<IconPin width={14} height={14} />}
              label="置顶网站"
              count={pinnedCount}
              ring={!!dragActiveId}
              {...rowProps('__pinned__')}
              {...(dragActiveId ? { ...dropProps('__pinned__') } : {})}
            />
            {data.categories.map((c) => {
              const CatIcon = categoryIcon(c.icon)
              return (
                <Row
                  key={c.id}
                  rail={collapsed}
                  icon={<CatIcon width={14} height={14} />}
                  label={c.name}
                  count={countOf(c.id)}
                  ring={!!dragActiveId}
                  {...rowProps(c.id)}
                  {...(dragActiveId ? { ...dropProps(c.id) } : {})}
                />
              )
            })}
          </div>

          {/* 托盘底部：数据说明 */}
          {!collapsed && (
            <div className="mt-2.5 shrink-0 border-t border-line px-1.5 pt-2.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-ink2">
                <IconDatabase width={12} height={12} className="shrink-0 opacity-70" />
                数据保存在浏览器本地
              </div>
              <p className="mt-1 pl-[18px] text-[11px] leading-4 text-ink2/55">
                支持书签 / JSON 导入导出
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
