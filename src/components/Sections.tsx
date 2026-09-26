import { useState } from 'react'
import type { Category, Site } from '../types'
import { useStore } from '../hooks/useStore'
import { SiteCard, Favicon } from './SiteCard'
import { categoryIcon } from '../lib/categoryIcons'
import { getClicks } from '../lib/clicks'
import { IconEyeOff, IconPin, IconPlus, IconSearch, IconStickyNote, IconTrash } from './icons'
import { EmptyArt } from './EmptyArt'
import { useConfirm } from './Confirm'
import { useToast } from './Toast'

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
  sortMode?: boolean
  onEditSite: (site: Site) => void
  onAddToCategory: (catId: string) => void
}

export function Sections({ drag, setDrag, query, activeCat, sortMode, onEditSite, onAddToCategory }: SectionsProps) {
  const { data, dropSite, restoreTrash, purgeTrashItem, restoreAllTrash, emptyTrash } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '未分类'
  const hiddenSites = data.sites.filter((s) => s.hidden)
  const trash = data.trash ?? []
  const restore = restoreTrash
  const restoreAll = restoreAllTrash
  const empty = emptyTrash
  const purge = purgeTrashItem

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

  // 一行卡片数跟随外观设置（4 / 6 / 8）；密度字面量映射保证 Tailwind JIT 生成
  const density = data.settings.gridDensity ?? '6'
  const gridCls = `grid grid-cols-2 gap-4 md:grid-cols-3 ${
    density === '8' ? 'gap-3 lg:grid-cols-8' : density === '4' ? 'lg:grid-cols-4' : 'lg:grid-cols-6'
  }`

  const renderCard = (site: Site, catId: string, from: 'pinned' | 'category', chip?: string, i?: number) => (
    <SiteCard
      key={site.id}
      site={site}
      query={query}
      categoryChip={chip}
      enterIndex={i}
      sortMode={sortMode}
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

  /* 搜索结果（站点 + 便签随记） */
  if (query) {
    const q = query.toLowerCase()
    const hits = data.sites.filter(
      (s) =>
        !s.hidden &&
        (s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)),
    )
    const noteHits = (data.notes ?? [])
      .filter((n) => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q))
      .slice(0, 8)
    const openNote = (id: string) => window.dispatchEvent(new CustomEvent('shiguang:open-note', { detail: id }))
    return (
      <>
        <PanelSection header={<SectionHeader icon={<IconSearch width={14} height={14} />} label="搜索结果" count={hits.length} />}>
          {hits.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-12 text-center">
              <EmptyArt kind="search" />
              <p className="mt-3 text-sm text-ink2">没有找到匹配的站点，试试切换到「站外」用搜索引擎查找</p>
            </div>
          ) : (
            <div className={gridCls}>{hits.map((s, i) => renderCard(s, s.categoryId, 'category', catName(s.categoryId), i))}</div>
          )}
        </PanelSection>
        {noteHits.length > 0 && (
          <PanelSection
            header={
              <SectionHeader
                icon={<IconStickyNote width={14} height={14} />}
                label="便签随记"
                count={noteHits.length}
              />
            }
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {noteHits.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNote(n.id)}
                  className="rounded-xl border border-line bg-base/40 px-3.5 py-2.5 text-left transition-all hover:border-accent/40"
                >
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {n.title.trim() || '无标题'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink2/75">
                    {n.text.replace(/\s+/g, ' ').trim() || '空便签'}
                  </span>
                </button>
              ))}
            </div>
          </PanelSection>
        )}
      </>
    )
  }

  const pinnedBase = data.sites.filter((s) => s.pinned && !s.hidden)
  let pinned = pinnedBase
  if (data.settings.autoCommon) {
    // 智能常用：置顶之外，点击次数最高的前 6 个站点自动进入「置顶 / 常用」区（点击数据仅存本机）
    const clicks = getClicks()
    const extra = data.sites
      .filter((s) => !s.pinned && !s.hidden && (clicks[s.id]?.c ?? 0) > 0)
      .sort(
        (a, b) =>
          (clicks[b.id]?.c ?? 0) - (clicks[a.id]?.c ?? 0) || (clicks[b.id]?.t ?? 0) - (clicks[a.id]?.t ?? 0),
      )
      .slice(0, 6)
    const ids = new Set(pinnedBase.map((s) => s.id))
    pinned = [...pinnedBase, ...extra.filter((s) => !ids.has(s.id))]
  }
  const visibleCats =
    activeCat === '__pinned__' ? [] : activeCat ? data.categories.filter((c) => c.id === activeCat) : data.categories
  const showPinned = pinned.length > 0 && (activeCat === null || activeCat === '__pinned__')
  const showHidden = hiddenSites.length > 0 && activeCat === null && !drag.id
  const showTrash = trash.length > 0 && activeCat === null && !query && !drag.id

  return (
    <>
      {sortMode && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-ink2">
          <IconPin width={12} height={12} className="shrink-0 text-accent" />
          <span>
            排序模式：拖拽卡片调整顺序，也可拖到左侧分类换组；点击右上角
            <span className="mx-1 font-medium text-accent">排序按钮</span>
            退出
          </span>
        </div>
      )}
      {showPinned && (
        <PanelSection
          header={
            <SectionHeader
              icon={<IconPin width={13} height={13} />}
              label="置顶 / 常用"
              count={pinned.length}
              tint
            />
          }
        >
          <div className={gridCls}>{pinned.map((s, i) => renderCard(s, s.categoryId, 'pinned', undefined, i))}</div>
        </PanelSection>
      )}

      {activeCat === '__pinned__' && pinned.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-14 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <IconPin width={19} height={19} />
          </span>
          <p className="text-sm text-ink2">还没有置顶的网站，把鼠标移到卡片上点击 📌 即可置顶</p>
        </div>
      )}

      {visibleCats.map((cat: Category) => {
        const items = data.sites.filter((s) => s.categoryId === cat.id && !s.hidden)
        const CatIcon = categoryIcon(cat.icon)
        if (drag.id && items.length === 0) {
          // 拖拽中显示空分类的投放区
          return (
            <PanelSection
              key={cat.id}
              header={
                <SectionHeader
                  icon={<CatIcon width={14} height={14} />}
                  label={cat.name}
                  count={0}
                  onAdd={() => onAddToCategory(cat.id)}
                />
              }
            >
              {renderDropZone(cat.id)}
            </PanelSection>
          )
        }
        return (
          <PanelSection
            key={cat.id}
            header={
              <SectionHeader
                icon={<CatIcon width={14} height={14} />}
                label={cat.name}
                count={items.length}
                onAdd={() => onAddToCategory(cat.id)}
              />
            }
          >
            {items.length === 0 ? (
              renderDropZone(cat.id)
            ) : (
              <div className={gridCls}>{items.map((s, i) => renderCard(s, cat.id, 'category', undefined, i))}</div>
            )}
          </PanelSection>
        )
      })}
      {showHidden && (
        <PanelSection
          header={
            <SectionHeader
              icon={<IconEyeOff width={13} height={13} />}
              label="已隐藏"
              count={hiddenSites.length}
            />
          }
        >
          <div className={gridCls}>{hiddenSites.map((s, i) => renderCard(s, s.categoryId, 'category', undefined, i))}</div>
        </PanelSection>
      )}

      {/* 回收站：删除的站点/分类保留 30 天，可恢复 */}
      {showTrash && (
        <PanelSection
          header={<SectionHeader icon={<IconTrash width={13} height={13} />} label="回收站" count={trash.length} />}
        >
          {/* 批量操作 */}
          <div className="mb-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                restoreAll()
                toast('已恢复全部项目')
              }}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink2 transition-colors hover:border-accent/45 hover:text-accent"
            >
              全部恢复
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  danger: true,
                  title: '清空回收站',
                  message: `将彻底删除回收站里的 ${trash.length} 项，无法恢复，确定吗？`,
                  okText: '清空',
                })
                if (!ok) return
                emptyTrash()
                toast('回收站已清空')
              }}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink2 transition-colors hover:border-danger/45 hover:text-danger"
            >
              清空回收站
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {trash.map((t) => {
              const isSite = t.kind === 'site'
              const site = t.data as Site
              const cat = t.data as Category
              return (
                <div
                  key={t.data.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-base/40 px-3 py-2"
                >
                  {isSite ? (
                    <Favicon site={site} />
                  ) : (
                    <span className="icon-tile text-ink2">
                      {(() => {
                        const CatIcon = categoryIcon(cat.icon)
                        return <CatIcon width={18} height={18} />
                      })()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">
                      {isSite ? site.name : cat.name}
                    </div>
                    <div className="truncate text-[11px] text-ink2/70">
                      {isSite ? '站点' : '分类'} · 删除于 {new Date(t.deletedAt).toLocaleDateString('zh-CN')} · 30 天后自动清除
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      restore(t.data.id)
                      toast(isSite ? '已恢复站点' : '已恢复分类')
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        danger: true,
                        title: '彻底删除',
                        message: '彻底删除后无法恢复，确定吗？',
                        okText: '彻底删除',
                      })
                      if (!ok) return
                      purge(t.data.id)
                      toast('已彻底删除')
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-ink2 transition-colors hover:bg-hover hover:text-danger"
                  >
                    彻底删除
                  </button>
                </div>
              )
            })}
          </div>
        </PanelSection>
      )}
    </>
  )
}

/** 分区面板：整组卡片放进毛玻璃容器，形成清晰的分组层次 */
function PanelSection({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="panel-section p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2.5">{header}</div>
        {children}
      </div>
    </section>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  onAdd,
  tint,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  onAdd?: () => void
  tint?: boolean
}) {
  return (
    <>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface shadow-sm ${
          tint ? 'text-accent' : 'text-ink2'
        }`}
      >
        {icon}
      </span>
      <h2 className="text-[15px] font-semibold tracking-wide">{label}</h2>
      {typeof count === 'number' && (
        <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-normal tabular-nums text-ink2">
          {count}
        </span>
      )}
      {onAdd && (
        <button
          onClick={onAdd}
          title="添加到该分类"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink2/70 transition-all hover:bg-hover hover:text-accent"
        >
          <IconPlus width={14} height={14} />
        </button>
      )}
    </>
  )
}
