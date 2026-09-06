/** storage/migrate 回归测试：node scripts/test-storage.mts（tsx 零配置运行） */
import assert from 'node:assert/strict'
import { migrate, defaultData } from '../src/lib/storage'

const DAY = 86400_000
const now = Date.now()

// 1. 空数据 → 全默认
{
  const d = migrate({})
  assert.equal(d.notes.length, 0)
  assert.equal(d.trash.length, 0)
  assert.equal(d.settings.showSiteUrl, true)
  assert.equal(d.settings.gridDensity, '6')
  assert.equal(d.settings.sidebarCollapsed, false)
  assert.equal(d.settings.autoCommon, false)
  assert.equal(d.settings.searchEngine, 'bing')
}

// 2. 旧分类补建议图标
{
  const d = migrate({ categories: [{ id: 'c1', name: '常用推荐' }, { id: 'c2', name: '自定义' }] })
  assert.equal(d.categories[0].icon, 'star')
  assert.equal(d.categories[1].icon, '')
}

// 3. 强调色别名 + 非法主题回退
{
  const d = migrate({ settings: { accent: 'indigo', theme: 'blue' } })
  assert.equal(d.settings.accent, 'purple')
  assert.equal(d.settings.theme, 'system')
}

// 4. 旧便签补 title 字段
{
  const d = migrate({ notes: [{ id: 'n1', text: 'hello' }] })
  assert.equal(d.notes[0].title, '')
  assert.equal(d.notes[0].text, 'hello')
}

// 5. 回收站：30 天过期清理
{
  const d = migrate({
    trash: [
      { kind: 'site', data: { id: 's1', name: '旧', url: 'https://a.com' }, deletedAt: now - 31 * DAY },
      { kind: 'site', data: { id: 's2', name: '新', url: 'https://b.com' }, deletedAt: now - 1 * DAY },
      { kind: 'category', data: { id: 'c9', name: '旧分类' }, deletedAt: now - 40 * DAY },
    ],
  })
  assert.equal(d.trash.length, 1)
  assert.equal(d.trash[0].data.id, 's2')
}

// 6. showSiteUrl: 显式 false 保留，undefined → true
{
  const a = migrate({ settings: { showSiteUrl: false } })
  const b = migrate({ settings: {} })
  assert.equal(a.settings.showSiteUrl, false)
  assert.equal(b.settings.showSiteUrl, true)
}

// 7. defaultData 完整性
{
  const d = defaultData()
  assert.ok(Array.isArray(d.notes) && d.notes.length === 0)
  assert.ok(Array.isArray(d.trash) && d.trash.length === 0)
  assert.ok(d.sites.length > 0 && d.categories.length > 0)
}

console.log('storage/migrate tests: all passed ✓')
