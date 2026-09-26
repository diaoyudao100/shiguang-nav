import { useEffect, useRef, useState } from 'react'
import type { Site } from '../types'
import { useStore } from '../hooks/useStore'
import { aiConfigured, aiDescribeSite } from '../lib/ai'
import { faviconUrl, hostOf, isLikelyUrl, normalizeUrl } from '../lib/favicon'
import { Field, Modal, compactCls, inputCls } from './Modal'
import { SelectMenu } from './SelectMenu'
import { IconChevronDown, IconChevronUp, IconEyeOff, IconImage, IconPin, IconSparkles, IconTrash, IconUpload } from './icons'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'

interface LinkModalProps {
  open: boolean
  site: Site | null // null = 新增
  defaultCategoryId?: string | null
  presetCategoryName?: string | null
  onClose: () => void
}

const MAX_ICON_BYTES = 150 * 1024

/** 表单里的图标预览解析结果 */
function previewIcon(url: string, iconUrl: string, autoIcon: boolean): string {
  if (autoIcon) return isLikelyUrl(url) ? faviconUrl(url) : ''
  return iconUrl.trim()
}

function PillToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border text-xs font-medium transition-all sm:w-auto sm:px-2 ${
        active
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export function LinkModal({ open, site, defaultCategoryId, presetCategoryName, onClose }: LinkModalProps) {
  const { data, addSite, updateSite, deleteSite, moveSite } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    name: '',
    url: '',
    desc: '',
    categoryId: '',
    pinned: false,
    hidden: false,
    iconUrl: '',
    iconColor: '',
    autoIcon: true,
  })
  const [isBatch, setIsBatch] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit = !!site
  const aiReady = aiConfigured(data.settings)

  useEffect(() => {
    if (!open) return
    setError('')
    setAiLoading(false)
    setIsBatch(false)
    setBatchText('')
    if (site) {
      setForm({
        name: site.name,
        url: site.url,
        desc: site.desc,
        categoryId: site.categoryId,
        pinned: site.pinned,
        hidden: site.hidden,
        iconUrl: site.iconUrl,
        iconColor: site.iconColor,
        autoIcon: !site.iconUrl,
      })
    } else {
      // 预设分类必须解析成真实分类 id：外层传的是 id，旧的按名称预设入口在这里兜底转换。
      // 若把分类名直接存进 categoryId，站点会落进不存在的分类，页面上任何区块都不渲染，
      // 表现为「点保存链接没反应/添加不了」。
      const wantedId =
        (defaultCategoryId && data.categories.some((c) => c.id === defaultCategoryId) && defaultCategoryId) ||
        data.categories.find((c) => c.name === presetCategoryName)?.id ||
        ''
      setForm({
        name: '',
        url: '',
        desc: '',
        categoryId: wantedId,
        pinned: false,
        hidden: false,
        iconUrl: '',
        iconColor: '',
        autoIcon: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, site])

  if (!open) return null

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const saveSingle = () => {
    const url = normalizeUrl(form.url)
    if (!isLikelyUrl(form.url)) {
      setError('请输入有效的网址，例如 github.com')
      return
    }
    const name = form.name.trim() || hostOf(url)
    let categoryId = form.categoryId.trim()
    // 兜底：分类被删或历史表单值非法时归入第一个分类，绝不让站点落到渲染不出来的悬空分类
    if (!data.categories.some((c) => c.id === categoryId)) categoryId = data.categories[0]?.id ?? ''
    const payload = {
      name,
      url,
      desc: form.desc.trim(),
      categoryId,
      pinned: form.pinned,
      hidden: form.hidden,
      iconUrl: form.autoIcon ? '' : form.iconUrl.trim(),
      iconColor: form.iconColor.trim(),
    }
    if (isEdit) {
      updateSite(site!.id, payload)
      if (payload.hidden !== site.hidden) {
        toast(payload.hidden ? '已隐藏，可在页面底部「已隐藏」区恢复' : '已取消隐藏')
      } else if (payload.pinned !== site.pinned) {
        toast(payload.pinned ? '已置顶' : '已取消置顶')
      } else {
        toast('已保存')
      }
    } else {
      addSite(payload)
      toast(form.hidden ? '已添加（隐藏状态）' : '已添加')
    }
    onClose()
  }

  const remove = async () => {
    if (!site) return
    const ok = await confirm({
      danger: true,
      title: '删除链接',
      message: (
        <>
          确定删除「<span className="font-medium text-ink">{form.name || site.name}</span>」吗？
          <br />
          此操作不可撤销。
        </>
      ),
      okText: '删除',
    })
    if (!ok) return
    deleteSite(site.id)
    toast('已删除')
    onClose()
  }

  const saveBatch = () => {
    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setError('请粘贴至少一行链接')
      return
    }
    let categoryId = form.categoryId.trim()
    if (!data.categories.some((c) => c.id === categoryId)) categoryId = data.categories[0]?.id ?? ''
    const existing = new Set(data.sites.map((s) => normalizeUrl(s.url).replace(/\/+$/, '')))
    let added = 0
    let skipped = 0
    for (const line of lines) {
      let url = ''
      let name = ''
      for (const token of line.split(/\s+/)) {
        if (!url && isLikelyUrl(token)) url = normalizeUrl(token)
        else name = name ? `${name} ${token}` : token
      }
      if (!url) {
        skipped++
        continue
      }
      const key = url.replace(/\/+$/, '')
      if (existing.has(key)) {
        skipped++
        continue
      }
      existing.add(key)
      addSite({
        name: name || hostOf(url),
        url,
        desc: '',
        categoryId,
        pinned: form.pinned,
        hidden: form.hidden,
        iconUrl: '',
        iconColor: form.iconColor.trim(),
      })
      added++
    }
    toast(`已批量添加 ${added} 个链接${skipped ? `，跳过 ${skipped} 行` : ''}`)
    onClose()
  }

  const save = () => (isBatch && !isEdit ? saveBatch() : saveSingle())

  const runAiDesc = async () => {
    if (!isLikelyUrl(form.url)) {
      setError('请先填写有效网址，AI 才能识别网站')
      return
    }
    if (!aiReady) {
      toast('请先在「设置 → AI 助手」中配置接口和 KEY')
      return
    }
    setAiLoading(true)
    const name = form.name.trim() || hostOf(normalizeUrl(form.url))
    try {
      const desc = await aiDescribeSite(form.url, name, data.settings)
      set({ desc })
      toast('已生成简述')
    } catch (e) {
      toast((e as Error).message || '生成失败，请检查接口配置')
    } finally {
      setAiLoading(false)
    }
  }

  const onPickIconFile = (file: File) => {
    if (file.size > MAX_ICON_BYTES) {
      setError('图标文件过大，请控制在 150KB 内')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      set({ iconUrl: String(reader.result), autoIcon: false })
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const iconPreview = previewIcon(form.url, form.iconUrl, form.autoIcon)
  const color = form.iconColor.trim()
  const batchLines = batchText.split('\n').filter((l) => l.trim()).length

  // 排序位置：以「已保存」的分类为准（表单里未保存的改分类不影响前后移判断）
  const storedCatId = isEdit ? data.sites.find((s) => s.id === site!.id)?.categoryId : undefined
  const sameCat = isEdit ? data.sites.filter((s) => s.categoryId === storedCatId) : []
  const catPos = sameCat.findIndex((s) => s.id === site!.id)
  const canMoveUp = catPos > 0
  const canMoveDown = catPos >= 0 && catPos < sameCat.length - 1

  return (
    <Modal
      open={open}
      title={isEdit ? '编辑链接' : '添加新链接'}
      onClose={onClose}
      width="max-w-md"
      headerExtra={
        !isEdit ? (
          <button
            type="button"
            onClick={() => {
              setIsBatch((v) => !v)
              setError('')
            }}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all ${
              isBatch
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isBatch ? 'bg-accent' : 'bg-ink2/50'}`} />
            批量模式
          </button>
        ) : undefined
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {/* 操作组卡：置顶 / 隐藏 / 删除 / 前移 / 后移 / 分类
            手机端：全部图标化 + 分类下拉占据剩余宽度（显示全名），恒定单行
            PC 端：文字胶囊 + 下拉收窄（w-92），同样单行 */}
        <div className="rounded-2xl border border-line bg-base/40 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PillToggle
              active={form.pinned}
              onClick={() => set({ pinned: !form.pinned, hidden: form.pinned ? form.hidden : false })}
              icon={<IconPin width={13} height={13} />}
              label="置顶"
            />
            <PillToggle
              active={form.hidden}
              onClick={() => set({ hidden: !form.hidden, pinned: form.hidden ? form.pinned : false })}
              icon={<IconEyeOff width={13} height={13} />}
              label="隐藏"
            />
            {isEdit && (
              <button
                type="button"
                onClick={remove}
                aria-label="删除"
                title="删除"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-all hover:border-danger/40 hover:text-danger sm:h-9 sm:w-auto sm:px-2.5"
              >
                <IconTrash width={13} height={13} />
                <span className="hidden sm:inline">删除</span>
              </button>
            )}
            {isEdit && (
              <>
                <button
                  type="button"
                  title="前移一位（在本分类内的位置）"
                  aria-label="前移"
                  disabled={!canMoveUp}
                  onClick={() => {
                    moveSite(site!.id, -1)
                    toast('已前移')
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-all hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconChevronUp width={13} height={13} />
                </button>
                <button
                  type="button"
                  title="后移一位（在本分类内的位置）"
                  aria-label="后移"
                  disabled={!canMoveDown}
                  onClick={() => {
                    moveSite(site!.id, 1)
                    toast('已后移')
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-all hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconChevronDown width={13} height={13} />
                </button>
              </>
            )}
            <SelectMenu
              variant="compact"
              ariaLabel="分类"
              value={form.categoryId}
              onChange={(v) => set({ categoryId: v })}
              className="ms-auto h-8 min-w-[90px] flex-1 text-xs sm:h-9"
              options={[
                ...data.categories.map((c) => ({ value: c.id, label: c.name })),
                // 历史数据兜底：categoryId 不在现有分类里时保住显示
                ...(form.categoryId && !data.categories.some((c) => c.id === form.categoryId)
                  ? [{ value: form.categoryId, label: form.categoryId }]
                  : []),
              ]}
            />
          </div>
        </div>

        {isBatch && !isEdit ? (
          <div className="rounded-2xl border border-line bg-base/40 p-3.5">
            <Field label="批量链接" hint={`每行一个，支持「名称 链接」成对填写`}>
              <textarea
                autoFocus
                className={inputCls + ' min-h-[180px] resize-y font-mono text-xs leading-5'}
                placeholder={'https://github.com\nV2EX https://v2ex.com\nbilibili.com'}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
              />
            </Field>
            <p className="mt-2 text-[11px] text-ink2/70">
              将添加 {batchLines} 行 · 重复网址自动跳过 · 名称留空时取自域名
            </p>
          </div>
        ) : (
          <>
            {/* 链接信息卡 */}
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-base/40 p-3.5">
              <input
                autoFocus={!isEdit}
                className={inputCls}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="网站标题"
              />
              <div className="relative">
                <input
                  className={inputCls + ' pr-10 font-mono text-xs'}
                  value={form.url}
                  onChange={(e) => set({ url: e.target.value })}
                  onBlur={() => {
                    if (form.url && !form.name.trim()) set({ name: hostOf(form.url) })
                  }}
                  placeholder="https://example.com"
                />
                {isLikelyUrl(form.url) && (
                  <img
                    src={previewIcon(form.url, form.iconUrl, form.autoIcon) || faviconUrl(form.url)}
                    alt=""
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-sm"
                  />
                )}
              </div>
            </div>

            {/* 图标设置卡 */}
            <div className="rounded-2xl border border-line bg-base/40 p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink2">
                  <IconImage width={13} height={13} />
                  图标
                </span>
                <span className="text-[10px] text-ink2/60">支持 SVG、PNG、ICO</span>
              </div>
              <div className="flex items-start gap-2.5">
                <div
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface"
                  title="图标预览"
                >
                  {iconPreview ? (
                    <img
                      src={iconPreview}
                      alt=""
                      className="h-7 w-7 rounded-md object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.visibility = 'hidden'
                      }}
                    />
                  ) : (
                    <IconImage width={18} height={18} className="text-ink2/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-1.5">
                    <input
                      className={compactCls + ' h-9 min-w-0 flex-1 text-xs'}
                      value={form.autoIcon ? '' : form.iconUrl}
                      disabled={form.autoIcon}
                      onChange={(e) => set({ iconUrl: e.target.value })}
                      placeholder={form.autoIcon ? '自动获取图标' : '图标链接…'}
                    />
                    <button
                      type="button"
                      title="自动获取"
                      onClick={() => set({ autoIcon: true, iconUrl: '' })}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                        form.autoIcon
                          ? 'border-accent/40 bg-accent-soft text-accent'
                          : 'border-line bg-surface text-ink2 hover:text-ink'
                      }`}
                    >
                      <IconSparkles width={14} height={14} />
                    </button>
                    <button
                      type="button"
                      title="上传图标（SVG / PNG / ICO）"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink2 transition-all hover:text-ink"
                    >
                      <IconUpload width={14} height={14} />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".svg,.png,.ico,image/svg+xml,image/png,image/x-icon"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onPickIconFile(f)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-ink2">
                    <input
                      type="checkbox"
                      checked={form.autoIcon}
                      onChange={(e) => set({ autoIcon: e.target.checked, iconUrl: e.target.checked ? '' : form.iconUrl })}
                      className="accent-[var(--c-accent)]"
                    />
                    输入链接时自动获取
                  </label>
                </div>
              </div>

              {/* 图标颜色 */}
              <div className="mt-3.5 flex items-center gap-2 border-t border-line/70 pt-3.5">
                <span className="text-xs text-ink2">图标颜色</span>
                <label
                  className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line"
                  style={{
                    background: color
                      ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 62%, black))`
                      : `linear-gradient(135deg, var(--c-hover), var(--c-line))`,
                  }}
                  title="选择颜色"
                >
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#5b5ce2'}
                    onChange={(e) => set({ iconColor: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <input
                  className={compactCls + ' h-8 w-28 font-mono text-xs'}
                  value={color}
                  onChange={(e) => set({ iconColor: e.target.value })}
                  placeholder="#RRGGBB"
                />
                <button
                  type="button"
                  onClick={() => set({ iconColor: '' })}
                  className="whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink2 transition-all hover:border-line-strong hover:text-ink"
                >
                  自动
                </button>
              </div>
            </div>

            {/* 简述卡 */}
            <div className="rounded-2xl border border-line bg-base/40 p-3.5">
              <Field label="添加简述" hint="悬浮卡片时显示">
                <div className="relative">
                  <textarea
                    className={inputCls + ' min-h-[72px] resize-y pb-8'}
                    value={form.desc}
                    onChange={(e) => set({ desc: e.target.value })}
                    placeholder="添加简述…"
                  />
                  <button
                    type="button"
                    onClick={runAiDesc}
                    disabled={aiLoading}
                    title="AI 生成一句话简述"
                    className="absolute bottom-2.5 right-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-opacity hover:opacity-75 disabled:opacity-50"
                  >
                    <IconSparkles width={12} height={12} />
                    {aiLoading ? '生成中…' : 'AI 填写'}
                  </button>
                </div>
              </Field>
            </div>
          </>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <button type="submit" className="btn-primary h-11 w-full text-sm">
          {isBatch && !isEdit ? `批量添加${batchLines ? `（${batchLines}）` : ''} →` : isEdit ? '保存修改 →' : '保存链接 →'}
        </button>
      </form>
    </Modal>
  )
}
