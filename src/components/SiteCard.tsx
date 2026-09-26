import { useEffect, useRef, useState } from 'react'
import type { Site } from '../types'
import { useStore } from '../hooks/useStore'
import { avatarColor } from '../lib/favicon'
import { recordClick } from '../lib/clicks'
import { IconPin, IconSettings } from './icons'

/** 触屏长按时长：按住此时长唤起编辑弹窗（替代原触屏常显齿轮） */
const LONG_PRESS_MS = 480

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

/** 图标底座：自定义图标 > Google S2 > 备用源 favicon.im > 首字母渐变头像 */
export function Favicon({ site }: { site: Site }) {
  const [failed, setFailed] = useState(0) // 0=正常 1=Google 失败 2=备用源也失败
  const custom = site.iconUrl?.trim()
  const host = (() => {
    try {
      return new URL(site.url).hostname
    } catch {
      return ''
    }
  })()
  const sources = custom ? [custom] : host ? [`https://www.google.com/s2/favicons?domain=${host}&sz=64`, `https://favicon.im/${host}?larger=true`] : []
  const color = site.iconColor?.trim() || avatarColor(site.name)
  if (failed >= sources.length || !sources.length) {
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
        src={sources[failed]}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        onError={() => setFailed((i) => i + 1)}
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

  // ── 触屏长按 → 唤起编辑弹窗（方案 A：卡片上无常显齿轮）──────────
  const pressTimer = useRef<ReturnType<typeof setTimeout>>()
  const pressOrigin = useRef({ x: 0, y: 0 })
  const lastTouchAt = useRef(0)
  const fired = useRef(false) // 长按已触发：随后手指抬起产生的 click 需吞掉，避免误跳转
  const [pressing, setPressing] = useState(false)

  const cancelPress = () => {
    clearTimeout(pressTimer.current)
    setPressing(false)
  }
  useEffect(() => cancelPress, [])

  const onTouchStart = (e: React.TouchEvent) => {
    if (sortMode) return // 排序模式下走拖拽，不触发长按
    const t = e.touches[0]
    pressOrigin.current = { x: t.clientX, y: t.clientY }
    lastTouchAt.current = Date.now()
    fired.current = false
    setPressing(true)
    pressTimer.current = setTimeout(() => {
      fired.current = true
      setPressing(false)
      navigator.vibrate?.(15) // 触感反馈（不支持时静默）
      onEdit()
    }, LONG_PRESS_MS)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0]
    // 移动超过阈值视为滚动，取消长按
    if (Math.hypot(t.clientX - pressOrigin.current.x, t.clientY - pressOrigin.current.y) > 12) cancelPress()
  }
  // 吞掉长按触发后紧接着的 click，防止打开网站而不是停在编辑弹窗
  const onClickCapture = (e: React.MouseEvent) => {
    if (fired.current) {
      e.preventDefault()
      e.stopPropagation()
      fired.current = false
    }
  }
  // 长按会唤起系统的链接预览菜单（Android/iOS），触屏来源时阻止之；桌面右键菜单不受影响
  const onContextMenu = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchAt.current < 1200) e.preventDefault()
  }
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
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClickCapture={onClickCapture}
      onContextMenu={onContextMenu}
      className={`group card relative z-0 min-w-0 p-3 transition-[height] hover:z-30 ${
        sortMode ? 'cursor-grab border-accent/40 ring-1 ring-accent/25' : 'cursor-pointer'
      } ${isDragging || site.hidden ? 'opacity-60' : ''} ${dropEdge === 'top' ? 'drop-line-top' : ''} ${
        dropEdge === 'bottom' ? 'drop-line-bottom' : ''
      } ${pressing ? 'scale-[0.985] border-accent/60 shadow-glow' : ''}`}
    >
      <div className="flex items-center gap-3">
        <Favicon site={site} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => {
                e.stopPropagation()
                recordClick(site.id)
              }}
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
          onClick={(e) => {
            e.stopPropagation()
            recordClick(site.id)
          }}
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
