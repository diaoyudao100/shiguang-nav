import { useState } from 'react'
import type { Site } from '../types'
import { useStore } from '../hooks/useStore'
import { avatarColor, faviconUrl } from '../lib/favicon'
import { IconPin, IconSettings } from './icons'

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/** 图标底座：自定义图标 > 自动获取 > 首字母渐变头像 */
export function Favicon({ site }: { site: Site }) {
  const [failed, setFailed] = useState(false)
  const custom = site.iconUrl?.trim()
  const url = custom || faviconUrl(site.url)
  const color = site.iconColor?.trim() || avatarColor(site.name)
  if (failed || !url) {
    return (
      <div
        className="icon-tile text-base font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 62%, black))`,
        }}
      >
        {(site.name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <div className="icon-tile">
      <img
        src={url}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-6 w-6 rounded-[7px] object-contain"
      />
    </div>
  )
}

interface CardProps {
  site: Site
  query?: string
  categoryChip?: string
  sortMode?: boolean
  isDragging?: boolean
  dropEdge?: 'top' | 'bottom' | null
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOverCard?: (e: React.DragEvent, site: Site) => void
  onDropCard?: (e: React.DragEvent, site: Site) => void
  onEdit: () => void
}

export function SiteCard({
  site,
  query = '',
  categoryChip,
  sortMode,
  isDragging,
  dropEdge,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  onEdit,
}: CardProps) {
  const { data } = useStore()
  const showUrl = data.settings.showSiteUrl !== false
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', site.id)
        onDragStart?.()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOverCard?.(e, site)}
      onDrop={(e) => onDropCard?.(e, site)}
      className={`group card relative z-0 p-3 transition-[height] hover:z-30 ${
        sortMode ? 'cursor-grab border-accent/40 ring-1 ring-accent/25' : 'cursor-pointer'
      } ${isDragging || site.hidden ? 'opacity-60' : ''} ${dropEdge === 'top' ? 'drop-line-top' : ''} ${
        dropEdge === 'bottom' ? 'drop-line-bottom' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Favicon site={site} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[15px] font-medium leading-6 transition-colors hover:text-accent"
              title={site.name}
            >
              <Highlight text={site.name} query={query} />
            </a>
            {site.pinned && <IconPin width={11} height={11} className="shrink-0 text-accent" />}
          </div>
          {showUrl && (
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs leading-5 text-ink2/85" title={site.url}>
              {categoryChip && (
                <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-normal text-accent">
                  {categoryChip}
                </span>
              )}
              <span className="truncate">{hostOf(site.url)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 悬浮注释：简介以毛玻璃气泡形式出现在卡片下方 */}
      {site.desc && (
        <div className="pointer-events-none absolute inset-x-2.5 top-[calc(100%+8px)] z-30 rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 text-xs leading-5 text-ink2 opacity-0 shadow-pop backdrop-blur-md translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
          <Highlight text={site.desc} query={query} />
        </div>
      )}

      {/* 悬浮齿轮：置顶 / 隐藏 / 编辑 / 删除 收纳进编辑弹窗（z-20 压过整卡链接浮层） */}
      <div className="card-actions absolute right-2 top-1/2 z-20 -translate-y-1/2">
        <button
          title="设置（置顶 · 隐藏 · 编辑 · 删除）"
          aria-label={`管理 ${site.name}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink2 transition-colors hover:bg-hover hover:text-accent"
        >
          <IconSettings width={13} height={13} />
        </button>
      </div>

      {/* 排序模式下隐藏整卡跳转层，避免与拖拽冲突 */}
      {!sortMode && (
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer noopener"
          className="absolute inset-0"
          aria-label={`打开 ${site.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
