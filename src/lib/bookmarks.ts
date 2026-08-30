import type { Category, Site } from '../types'
import { normalizeUrl } from './favicon'
import { uid } from './id'

/* ---------------- 导出：生成 Netscape 书签 HTML（Chrome/Edge/Firefox 均可直接导入） ---------------- */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function exportBookmarksHtml(categories: Category[], sites: Site[], title = '拾光导航'): string {
  const secs = Math.floor(Date.now() / 1000)
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>${esc(title)}</TITLE>`,
    `<H1>${esc(title)}</H1>`,
    '<DL><p>',
  ]
  const catIds = new Set(categories.map((c) => c.id))
  // 属于已删除分类的站点挂在根目录下
  const loose = sites.filter((s) => !catIds.has(s.categoryId))
  for (const cat of categories) {
    const items = sites.filter((s) => s.categoryId === cat.id)
    if (items.length === 0) continue
    lines.push(`    <DT><H3 ADD_DATE="${secs}">${esc(cat.name)}</H3>`)
    lines.push('    <DL><p>')
    for (const s of items) {
      lines.push(`        <DT><A HREF="${esc(s.url)}" ADD_DATE="${Math.floor(s.addedAt / 1000)}">${esc(s.name)}</A>`)
      if (s.desc) lines.push(`        <DD>${esc(s.desc)}`)
    }
    lines.push('    </DL><p>')
  }
  for (const s of loose) {
    lines.push(`    <DT><A HREF="${esc(s.url)}" ADD_DATE="${Math.floor(s.addedAt / 1000)}">${esc(s.name)}</A>`)
  }
  lines.push('</DL><p>')
  return lines.join('\n')
}

/* ---------------- 导入：解析浏览器导出的书签 HTML ---------------- */

export interface ParsedBookmark {
  name: string
  url: string
  desc: string
}

interface FolderNode {
  name: string
  items: ParsedBookmark[]
  children: FolderNode[]
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseBookmarksHtml(html: string): FolderNode {
  const root: FolderNode = { name: '', items: [], children: [] }
  const stack: FolderNode[] = [root]
  let pending: FolderNode | null = null
  const tokenRe =
    /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DT><A\s([^>]*)>([\s\S]*?)<\/A>|<DL[^>]*>|<\/DL>/gi
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(html))) {
    const tag = m[0]
    if (/^<DT><H3/i.test(tag)) {
      pending = { name: decodeEntities(m[1] || ''), items: [], children: [] }
    } else if (/^<DT><A/i.test(tag)) {
      const attrs = m[2] || ''
      const href = attrs.match(/HREF\s*=\s*"?([^"\s>]*)/i)?.[1] ?? ''
      const text = decodeEntities(m[3] || '')
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        stack[stack.length - 1].items.push({ name: text || href, url: href, desc: '' })
      }
    } else if (/^<DL/i.test(tag)) {
      if (pending) {
        stack[stack.length - 1].children.push(pending)
        stack.push(pending)
        pending = null
      }
      // 根 <DL> 或没有对应 <H3> 的 <DL>：忽略层级
    } else if (/^<\/DL/i.test(tag)) {
      if (stack.length > 1) stack.pop()
    }
  }
  return root
}

export interface BookmarkImportResult {
  categories: Category[]
  sites: Site[]
  importedCount: number
  skippedCount: number
  categoryCount: number
}

/**
 * 把书签树拍平为「分类 + 站点」：
 * - 顶层每个文件夹 → 一个分类；子文件夹拍平为「父 · 子」分类
 * - 顶层的散落链接归入「导入书签」分类
 * - 同一文件内按 URL 去重
 */
export function importBookmarksHtml(html: string, existingUrls: string[] = []): BookmarkImportResult {
  const tree = parseBookmarksHtml(html)
  const result: BookmarkImportResult = {
    categories: [],
    sites: [],
    importedCount: 0,
    skippedCount: 0,
    categoryCount: 0,
  }
  const seen = new Set(existingUrls.map((u) => normalizeUrl(u).replace(/\/+$/, '')))
  const catIdByName = new Map<string, string>()

  const ensureCategory = (name: string): string => {
    let key = name.trim()
    if (!key) key = '未分类'
    let id = catIdByName.get(key)
    if (!id) {
      id = 'cat-' + uid()
      result.categories.push({ id, name: key })
      catIdByName.set(key, id)
    }
    return id
  }

  const addSite = (item: ParsedBookmark, categoryId: string) => {
    const url = normalizeUrl(item.url)
    const key = url.replace(/\/+$/, '')
    if (seen.has(key)) {
      result.skippedCount++
      return
    }
    seen.add(key)
    result.sites.push({
      id: 's-' + uid(),
      name: item.name || url,
      url,
      desc: item.desc || '',
      categoryId,
      pinned: false,
      hidden: false,
      iconUrl: '',
      iconColor: '',
      addedAt: Date.now(),
    })
    result.importedCount++
  }

  // 扁平化：只有“根 + 顶层文件夹”两层时，文件夹名直接作为分类；更深的层级用「父 · 子」拼接
  const walkFolder = (folder: FolderNode, catName: string, depth: number) => {
    const name = depth === 0 ? catName : `${catName} · ${folder.name}`.replace(/^ · /, '')
    const categoryId = ensureCategory(name)
    for (const item of folder.items) addSite(item, categoryId)
    for (const child of folder.children) walkFolder(child, name, depth + 1)
  }

  let looseId: string | null = null
  for (const child of tree.children) {
    walkFolder(child, child.name || '导入书签', 0)
  }
  if (tree.items.length > 0) {
    looseId = ensureCategory('导入书签')
    for (const item of tree.items) addSite(item, looseId)
  }

  // 过滤掉空分类
  const used = new Set(result.sites.map((s) => s.categoryId))
  result.categories = result.categories.filter((c) => used.has(c.id))
  result.categoryCount = result.categories.length
  return result
}

/* ---------------- 通用下载 ---------------- */

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
