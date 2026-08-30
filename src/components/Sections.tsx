import { useState } from 'react'
import type { Category, Site } from '../types'
import { useStore } from '../hooks/useStore'
import { SiteCard } from './SiteCard'
import { categoryIcon } from '../lib/categoryIcons'
import { IconEyeOff, IconPin, IconPlus } from './icons'

export interface DragState {
  id: string | null
  from: 'pinned' | 'category'
  edge: { catId: string; anchorId: string | null; after: boolean } | null
}

interface SectionsProps {
  drag: DragState
  setDrag: (d: DragState) => void
  query: string
  activeCat: string | null // null=全部，'__pinned__'=仅置顶，其他为分类 id
  onEditSite: (site: Site) => void
  onAddToCategory: (catId: string) => void
}

export function Sections({ drag, setDrag, query, activeCat, onEditSite, onAddToCategory }: SectionsProps) {
  const { data, dropSite } = useStore()
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '未分类'
  const hiddenSites = data.sites.filter((s) => s.hidden)

  const commitDrop = (e: React.DragEvent, catId: string, anchorId: string | null, after: boolean, from: 'pinned' | 'category') => {
    e.preventDefault()
    if (!drag.id) return
    // 置顶网格内拖动只调整顺序，不改变所属分类
    const dragged = data.sites.find((s) => s.id === drag.id)
    const target = from === 'pinned' && dragged ? dragged.categoryId : catId
    dropSite(drag.id, target, anchorId, after)
    setDrag({ id: null, from: 'category', edge: null })
  }

  const overCard = (e: React.DragEvent, catId: string, site: Site, from: 'pinned' | 'category') => {
    if (!drag.id || drag.id === site.id) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const after = e.clientY - rect.top > rect.height / 2
    setDrag({ ...drag, edge: { catId, anchorId: site.id, after } })
    void from
  }

  const edgeOf = (catId: string, site: Site) => {
    const e = drag.edge
    if (!e || e.catId !== catId || e.anchorId !== site.id) return null
    return e.after ? ('bottom' as const) : ('top' as const)
  }

  // 一行容纳 6 张卡片：笔记本及以上档位固定 6 列（用户屏幕 150% 缩放下 CSS 宽约 1272，落在 lg 档）
  const gridCls = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6'

  const renderCard = (site: Site, catId: string, from: 'pinned' | 'category', chip?: string) => (
    <SiteCard
      key={site.id}
      site={site}
      query={query}
      categoryChip={chip}
      isDragging={drag.id === site.id}
      dropEdge={edgeOf(catId, site)}
      onDragStart={() => setDrag({ id: site.id, from, edge: null })}
      onDragEnd={() => setDrag({ id: null, from: 'category', edge: null })}
      onDragOverCard={(e) => overCard(e, catId, site, from)}
      onDropCard={(e) => commitDrop(e, catId, site.id, drag.edge?.after ?? false, from)}
      onEdit={() => onEditSite(site)}
    />
  )

  const renderDropZone = (catId: string) => (
    <div
      onDragOver={(e) => {
        if (drag.id) e.preventDefault()
      }}
      onDrop={(e) => commitDrop(e, catId, null, false, 'category')}
      className="flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong/60 text-xs text-ink2/70 transition-colors hover:border-accent/45"
    >
      <IconPlus width={14} height={14} className="opacity-60" />
      拖拽网站到这里，或点击右上角 + 添加
    </div>
  )

  /* 搜索结果（不含已隐藏） */
  if (query) {
    const q = query.toLowerCase()
    const hits = data.sites.filter(
      (s) =>
        !s.hidden &&
        (s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)),
    )
    return (
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-[15px] tracking-wide">
            搜索结果 <span className="tabular-nums text-ink2">({hits.length})</span>
          </h2>
          <span className="text-[13px] text-ink2/80">匹配「{query}」的站点</span>
        </div>
        {hits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong/60 py-16 text-center text-sm text-ink2">
            没有找到匹配的站点，试试切换到「站外」用搜索引擎查找
          </div>
        ) : (
          <div className={gridCls}>{hits.map((s) => renderCard(s, s.categoryId, 'category', catName(s.categoryId)))}</div>
        )}
      </section>
    )
  }

  const pinned = data.sites.filter((s) => s.pinned && !s.hidden)
  const visibleCats =
    activeCat === '__pinned__' ? [] : activeCat ? data.categories.filter((c) => c.id === activeCat) : data.categories
  const showPinned = pinned.length > 0 && (activeCat === null || activeCat === '__pinned__')
  const showHidden = hiddenSites.length > 0 && activeCat === null && !drag.id

  return (
    <>
      {showPinned && (
        <section className="mb-8">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-accent shadow-sm">
              <IconPin width={12} height={12} />
            </span>
            <h2 className="text-[15px] tracking-wide">置顶 / 常用</h2>
            <span className="rounded-full bg-hover px-1.5 py-px text-[11px] font-normal tabular-nums text-ink2">
              {pinned.length}
            </span>
          </div>
          <div className={gridCls}>{pinned.map((s) => renderCard(s, s.categoryId, 'pinned'))}</div>
        </section>
      )}

      {activeCat === '__pinned__' && pinned.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong/60 py-16 text-center text-sm text-ink2">
          还没有置顶的网站，把鼠标移到卡片上点击 📌 即可置顶
        </div>
      )}

      {visibleCats.map((cat: Category) => {
        const items = data.sites.filter((s) => s.categoryId === cat.id && !s.hidden)
        if (drag.id && items.length === 0) {
          // 拖拽中显示空分类的投放区
          return (
            <section key={cat.id} className="mb-7">
              <SectionHeader cat={cat} count={0} onAdd={() => onAddToCategory(cat.id)} />
              {renderDropZone(cat.id)}
            </section>
          )
        }
        return (
          <section key={cat.id} className="mb-7">
            <SectionHeader cat={cat} count={items.length} onAdd={() => onAddToCategory(cat.id)} />
            {items.length === 0 ? (
              renderDropZone(cat.id)
            ) : (
              <div className={gridCls}>{items.map((s) => renderCard(s, cat.id, 'category'))}</div>
            )}
          </section>
        )
      })}
      {showHidden && (
        <section className="mb-7">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-ink2 shadow-sm">
              <IconEyeOff width={12} height={12} />
            </span>
            <h2 className="text-[15px] tracking-wide text-ink2">已隐藏</h2>
            <span className="rounded-full bg-hover px-1.5 py-px text-[11px] font-normal tabular-nums text-ink2">
              {hiddenSites.length}
            </span>
          </div>
          <div className={gridCls}>{hiddenSites.map((s) => renderCard(s, s.categoryId, 'category'))}</div>
        </section>
      )}
    </>
  )
}

function SectionHeader({ cat, count, onAdd }: { cat: Category; count: number; onAdd: () => void }) {
  const CatIcon = categoryIcon(cat.icon)
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-ink2 shadow-sm">
        <CatIcon width={12} height={12} />
      </span>
      <h2 className="text-[15px] tracking-wide">{cat.name}</h2>
      <span className="rounded-full bg-hover px-1.5 py-px text-[11px] font-normal tabular-nums text-ink2">
        {count}
      </span>
      <button
        onClick={onAdd}
        title={`添加到「${cat.name}」`}
        className="ml-auto rounded-full p-1.5 text-ink2/70 transition-all hover:bg-hover hover:text-accent"
      >
        <IconPlus width={14} height={14} />
      </button>
    </div>
  )
}
