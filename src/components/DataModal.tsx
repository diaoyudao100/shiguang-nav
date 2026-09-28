import { useRef, useState } from 'react'
import { useStore, backupToNavData } from '../hooks/useStore'
import { downloadFile, exportBookmarksHtml, importBookmarksHtml } from '../lib/bookmarks'
import { Modal, btnGhost, btnPrimary } from './Modal'
import { IconDownload, IconUpload } from './icons'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import type { NavData } from '../types'

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}

export function DataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, mergeImport, replaceAll, resetAll } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const bookmarkInput = useRef<HTMLInputElement>(null)
  const jsonInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [dedupe, setDedupe] = useState(true)

  const dateTag = new Date().toISOString().slice(0, 10)

  const exportJson = () => {
    const backup = {
      app: 'shiguang-nav',
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: data.categories,
      sites: data.sites,
      notes: data.notes,
      todos: data.todos ?? [],
    }
    downloadFile(`nav-backup-${dateTag}.json`, JSON.stringify(backup, null, 2), 'application/json')
    toast('JSON 备份已导出')
  }

  const exportBookmarks = () => {
    downloadFile(`bookmarks-${dateTag}.html`, exportBookmarksHtml(data.categories, data.sites), 'text/html')
    toast('书签 HTML 已导出，可直接导入浏览器')
  }

  const handleBookmarks = async (file: File) => {
    const html = await readText(file)
    const existing = dedupe ? data.sites.map((s) => s.url) : []
    const result = importBookmarksHtml(html, existing)
    if (result.importedCount === 0) {
      toast(`没有可导入的书签（跳过 ${result.skippedCount} 个重复项）`)
      return
    }
    if (mode === 'replace') {
      const next: NavData = {
        version: 1,
        categories: result.categories,
        sites: result.sites,
        notes: data.notes,
        todos: data.todos,
        trash: data.trash,
        settings: data.settings,
      }
      replaceAll(next)
    } else {
      mergeImport(result.categories, result.sites)
    }
    toast(`已导入 ${result.importedCount} 个站点、${result.categoryCount} 个分类`)
    onClose()
  }

  const handleJson = async (file: File) => {
    try {
      const raw = JSON.parse(await readText(file))
      const nav = backupToNavData(raw)
      if (!nav) {
        toast('文件格式不正确，请选择本应用导出的 JSON 备份')
        return
      }
      if (mode === 'replace') {
        replaceAll({ ...nav, trash: data.trash, settings: nav.settings ?? data.settings })
        toast('已从备份恢复')
        onClose()
      } else {
        mergeImport(nav.categories, nav.sites)
        toast('备份已合并')
        onClose()
      }
    } catch {
      toast('JSON 解析失败')
    }
  }

  const row =
    'flex flex-col gap-2 rounded-xl border border-line bg-base p-4 sm:flex-row sm:items-center sm:justify-between'

  return (
    <Modal open={open} title="导入 / 导出" onClose={onClose} width="max-w-xl">
      {/* 模式选择 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft px-4 py-3 text-xs text-ink">
        <span className="font-medium">导入方式：</span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} className="accent-[var(--c-accent)]" />
          合并（保留现有数据，按网址去重）
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-[var(--c-accent)]" />
          替换（覆盖全部数据）
        </label>
      </div>

      {/* 导入 */}
      <h3 className="mb-2 text-sm font-semibold">导入</h3>
      <div className="mb-5 flex flex-col gap-2.5">
        <div className={row}>
          <div>
            <div className="text-sm font-medium">浏览器书签 HTML</div>
            <div className="text-xs text-ink2">支持 Chrome / Edge / Firefox / Safari 导出的书签文件，文件夹自动转为分类</div>
          </div>
          <label className={`${btnPrimary} shrink-0 cursor-pointer`}>
            <IconUpload width={14} height={14} /> 选择书签文件
            <input
              ref={bookmarkInput}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleBookmarks(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div className={row}>
          <div>
            <div className="text-sm font-medium">JSON 备份</div>
            <div className="text-xs text-ink2">本应用导出的 JSON 备份文件，可完整恢复分类与站点</div>
          </div>
          <label className={`${btnGhost} shrink-0 cursor-pointer`}>
            <IconUpload width={14} height={14} /> 选择 JSON 文件
            <input
              ref={jsonInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleJson(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink2">
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="accent-[var(--c-accent)]" />
          导入书签时跳过已存在的网址（按 URL 去重）
        </label>
      </div>

      {/* 导出 */}
      <h3 className="mb-2 text-sm font-semibold">导出</h3>
      <div className="flex flex-col gap-2.5">
        <div className={row}>
          <div>
            <div className="text-sm font-medium">浏览器书签 HTML</div>
            <div className="text-xs text-ink2">分类转为书签文件夹，可直接导入 Chrome / Edge / Firefox</div>
          </div>
          <button onClick={exportBookmarks} className={`${btnPrimary} shrink-0`}>
            <IconDownload width={14} height={14} /> 导出书签
          </button>
        </div>
        <div className={row}>
          <div>
            <div className="text-sm font-medium">JSON 备份</div>
            <div className="text-xs text-ink2">包含分类、站点与设置，适合换机迁移或再导入</div>
          </div>
          <button onClick={exportJson} className={`${btnGhost} shrink-0`}>
            <IconDownload width={14} height={14} /> 导出 JSON
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-line p-3 text-xs leading-5 text-ink2">
        当前共 {data.categories.length} 个分类、{data.sites.length} 个站点。所有数据保存在浏览器 localStorage，换浏览器/清缓存前请先导出备份。
        <button
          className="ml-1 text-danger underline underline-offset-2"
          onClick={async () => {
            const ok = await confirm({
              danger: true,
              title: '重置全部数据',
              message: '确定清空所有数据并恢复为初始示例吗？此操作不可撤销。',
              okText: '清空并恢复',
            })
            if (ok) {
              resetAll()
              toast('已恢复初始数据')
              onClose()
            }
          }}
        >
          重置全部数据
        </button>
      </div>
    </Modal>
  )
}
