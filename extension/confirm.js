/** 拾光导航 · 收藏确认窗：读取分类列表 + AI 推荐分类/简介，确认后入库 */

const DEFAULT_SITE = 'https://shiguang-nav.diaoyudao110.workers.dev'
const $ = (id) => document.getElementById(id)

const params = new URLSearchParams(location.search)
const pageUrl = params.get('url') || ''
let userTouchedCategory = false
let userTouchedDesc = false

async function api(path, init = {}) {
  const { siteUrl, token } = await chrome.storage.local.get({ siteUrl: DEFAULT_SITE, token: '' })
  const base = String(siteUrl || DEFAULT_SITE).replace(/\/+$/, '')
  const res = await fetch(base + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function setHint(text, cls = '') {
  $('hint').textContent = text
  $('hint').className = `hint ${cls}`
}

function fillSelect(categories, preferredId) {
  const sel = $('category')
  const current = sel.value
  sel.innerHTML = ''
  for (const c of categories) {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.name
    sel.appendChild(opt)
  }
  // 优先级：AI 推荐 → 用户已选 → 第一项
  const target = categories.some((c) => c.id === preferredId)
    ? preferredId
    : categories.some((c) => c.id === current)
      ? current
      : categories[0]?.id
  if (target) sel.value = target
}

function needConnect() {
  $('form').hidden = true
  $('connect').hidden = false
}

function showDone(text) {
  $('form').hidden = true
  $('done').hidden = false
  $('doneText').textContent = text
  setTimeout(() => window.close(), 1400)
}

async function init() {
  $('url').textContent = pageUrl
  $('url').title = pageUrl
  $('name').value = params.get('title') || ''
  $('name').focus()
  load()
}

async function load() {
  const cats = await api('/api/categories')
  if (cats.status === 401 || cats.status === 403) return needConnect()
  if (cats.status === 200 && Array.isArray(cats.data.categories)) {
    fillSelect(cats.data.categories, undefined)
  } else {
    setHint('分类列表加载失败，仍可直接收藏（归入第一个分类）', 'err')
  }

  const sug = await api('/api/quick-suggest', {
    method: 'POST',
    body: JSON.stringify({ url: pageUrl, title: $('name').value.trim() }),
  })
  if (sug.status === 401 || sug.status === 403) return needConnect()
  if (sug.status === 200) {
    const { desc, descSource, categoryId, category } = sug.data
    if (desc && !userTouchedDesc) $('desc').value = desc
    fillSelect(cats.status === 200 ? cats.data.categories : [], categoryId)
    if (descSource === 'ai' && category) {
      setHint(`AI 推荐分类：${category}${desc ? '，简介已生成' : ''}`, 'ok')
    } else {
      setHint('AI 未返回推荐（未配置或调用失败），可手动选择分类')
    }
  } else {
    setHint('AI 推荐失败，可手动选择分类后收藏', 'err')
  }
}

$('category').addEventListener('change', () => {
  userTouchedCategory = true
})
$('desc').addEventListener('input', () => {
  userTouchedDesc = true
})
$('cancelBtn').addEventListener('click', () => window.close())
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close()
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('saveBtn').click()
})
$('openOptionsBtn').addEventListener('click', () => {
  chrome.tabs.create({ active: true, url: chrome.runtime.getURL('options.html') })
  window.close()
})

$('saveBtn').addEventListener('click', async () => {
  const btn = $('saveBtn')
  btn.disabled = true
  btn.textContent = '收藏中…'
  const { status, data } = await api('/api/quick-add', {
    method: 'POST',
    body: JSON.stringify({
      url: pageUrl,
      title: $('name').value.trim(),
      categoryId: $('category').value || undefined,
      desc: $('desc').value.trim(),
    }),
  })
  if (status === 200) {
    if (data.duplicate) {
      showDone(`「${data.site?.name || ''}」已在导航站中，未重复添加`)
    } else {
      showDone(`已收藏${data.category ? `到「${data.category}」` : ''}`)
    }
    return
  }
  if (status === 401 || status === 403) return needConnect()
  btn.disabled = false
  btn.textContent = '收藏'
  setHint(data.error || `收藏失败（${status}）`, 'err')
})

init()
