/* 书签导入/导出的 Node 端测试：模拟 Chrome 导出的 Netscape 书签文件 */
import { importBookmarksHtml, exportBookmarksHtml } from '../src/lib/bookmarks'
import type { Category, Site } from '../src/types'

const chromeExport = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1690000000" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>
    <DL><p>
        <DT><A HREF="https://github.com/" ADD_DATE="1690000001">GitHub</A>
        <DT><H3 ADD_DATE="1690000002">学习</H3>
        <DL><p>
            <DT><A HREF="https://developer.mozilla.org/" ADD_DATE="1690000003">MDN Web Docs</A>
            <DT><A HREF="https://developer.mozilla.org/zh-CN/" ADD_DATE="1690000004">MDN 中文</A>
        </DL><p>
        <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1690000005">Hacker News</A>
    </DL><p>
    <DT><H3 ADD_DATE="1690000006">其他书签</H3>
    <DL><p>
        <DT><A HREF="javascript:void(0)" ADD_DATE="1690000007">坏书签</A>
        <DT><A HREF="https://github.com/" ADD_DATE="1690000008">GitHub 重复</A>
        <DT><A HREF="v2ex.com" ADD_DATE="1690000009">V2EX 无协议</A>
    </DL><p>
</DL><p>`

const result = importBookmarksHtml(chromeExport)
console.log('--- 导入结果 ---')
console.log('分类:', result.categories.map((c) => c.name))
for (const s of result.sites) console.log(`  [${result.categories.find((c) => c.id === s.categoryId)?.name}] ${s.name} -> ${s.url}`)
console.log('导入:', result.importedCount, '跳过:', result.skippedCount)

// 断言
const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('PASS:', msg)
  }
}

assert(result.importedCount === 5, '应导入 5 个有效书签（去掉 javascript: 与重复项）')
assert(result.skippedCount === 1, '重复的 GitHub 应被跳过 1 次')
assert(result.categories.length === 3, '应生成 3 个非空分类')
assert(result.sites.some((s) => s.url === 'https://v2ex.com'), '无协议网址应补全 https://')
assert(!result.sites.some((s) => s.url.startsWith('javascript')), 'javascript: 书签应被过滤')
assert(result.categories.some((c) => c.name === '书签栏 · 学习'), '子文件夹应拍平为「父 · 子」分类')

// 再走一遍导出 → 重新导入的闭环
const cats: Category[] = result.categories
const sites: Site[] = result.sites
const html = exportBookmarksHtml(cats, sites)
const re = importBookmarksHtml(html)
console.log('--- 导出再导入 ---')
console.log('重新导入:', re.importedCount, '分类:', re.categories.map((c) => c.name))
assert(re.importedCount === 5, '导出的书签 HTML 应能无损重新导入')
assert(
  [...re.sites].sort((a, b) => a.url.localeCompare(b.url)).map((s) => s.url).join() ===
    [...sites].sort((a, b) => a.url.localeCompare(b.url)).map((s) => s.url).join(),
  '往返导入后的网址集合一致',
)
assert(html.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>'), '导出含 Netscape 头，浏览器可直接导入')

// 与现有数据合并时的去重
const again = importBookmarksHtml(chromeExport, sites.map((s) => s.url))
console.log('再次导入: 导入', again.importedCount, '跳过', again.skippedCount)
assert(again.importedCount === 0 && again.skippedCount === 6, '全部重复时导入 0 个、6 个有效书签全部跳过')

console.log(process.exitCode ? '测试未通过' : '全部测试通过 ✅')
