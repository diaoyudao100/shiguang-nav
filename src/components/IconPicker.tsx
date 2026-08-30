/** 分类图标选择器：lucide 图标库网格 + 中英文搜索 + 当前选择预览（参考元启导航交互） */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { CATEGORY_ICONS, categoryIcon, categoryIconLabel } from '../lib/categoryIcons'
import { Modal, btnPrimary } from './Modal'

interface IconPickerProps {
  open: boolean
  /** 当前值（'' = 未设置） */
  value: string
  /** 点「确定选择」后回传；'' 表示清除图标 */
  onPick: (icon: string) => void
  onClose: () => void
}

export function IconPicker({ open, value, onPick, onClose }: IconPickerProps) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(value)
  const searchRef = useRef<HTMLInputElement>(null)

  // 每次打开重置为当前值；聚焦搜索框但禁止滚动（矮窗口下 autoFocus 会把弹窗内容顶出视野）
  useEffect(() => {
    if (open) {
      setSelected(value)
      setQ('')
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
    }
  }, [open, value])

  const list = useMemo(() => {
    const raw = q.trim()
    const s = raw.toLowerCase()
    if (!s) return CATEGORY_ICONS
    return CATEGORY_ICONS.filter(
      (d) => d.name.includes(s) || d.label.toLowerCase().includes(s) || d.tags.toLowerCase().includes(s) || d.tags.includes(raw),
    )
  }, [q])

  const SelIcon = categoryIcon(selected)

  // Portal 到 body：本选择器常被嵌在其它弹窗（如管理分类）里渲染，而那些弹窗的
  // 入场动画带 transform，会把 fixed 定位基准劫持成弹窗盒子，导致选择器被裁剪
  return createPortal(
    <Modal open={open} title="选择图标" onClose={onClose} width="max-w-[520px]">
      {/* 搜索 */}
      <div className="relative mb-2">
        <Search width={14} height={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2/60" />
        <input
          ref={searchRef}
          className="w-full rounded-[10px] border border-line bg-base/60 py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-all placeholder:text-ink2/50 hover:border-line-strong focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10"
          placeholder="搜索图标：星 / 代码 / 游戏 / star / code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* 当前选择 */}
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-base px-3.5 py-2">
        <span className="shrink-0 text-xs text-ink2">当前选择：</span>
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink">
          <SelIcon width={13} height={13} className="shrink-0" />
          <span className="truncate">{categoryIconLabel(selected) || '未设置（默认文件夹）'}</span>
        </span>
        <button
          type="button"
          onClick={() => setSelected('')}
          className="ml-auto shrink-0 text-xs text-ink2 transition-colors hover:text-danger"
        >
          清除图标
        </button>
      </div>

      {/* 图标网格：矮窗口下按视口高度收缩，保证标题和底部按钮始终可见 */}
      <div className="grid max-h-[min(288px,30vh)] grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-line bg-base/50 p-2 sm:grid-cols-8">
        {list.map((d) => {
          const active = selected === d.name
          return (
            <button
              key={d.name}
              type="button"
              title={`${d.label} · ${d.tags}`}
              aria-label={d.label}
              onClick={() => setSelected(d.name)}
              onDoubleClick={() => {
                onPick(d.name)
                onClose()
              }}
              className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-all ${
                active
                  ? 'bg-accent-soft text-accent ring-2 ring-accent/30'
                  : 'text-ink2 hover:bg-hover hover:text-ink'
              }`}
            >
              <d.Icon width={17} height={17} />
              <span className="w-full truncate text-center text-[9px] leading-3">{d.label}</span>
            </button>
          )
        })}
        {list.length === 0 && (
          <p className="col-span-full py-8 text-center text-xs text-ink2">
            没有匹配的图标，试试「星 / 代码 / 游戏 / AI」等中文词
          </p>
        )}
      </div>

      {/* 底部：提示 + 确定 */}
      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[11px] leading-4 text-ink2/70">
          可以输入 Lucide 图标名称或用中文关键词搜索；双击图标可直接选定
        </p>
        <button
          type="button"
          onClick={() => {
            onPick(selected)
            onClose()
          }}
          className={btnPrimary + ' h-9 shrink-0 px-4 text-xs'}
        >
          确定选择
        </button>
      </div>
    </Modal>,
    document.body,
  )
}
