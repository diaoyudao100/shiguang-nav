/** 拾光导航 · 一键收藏 — MV3 service worker
 *
 *  触发：点扩展图标 / Alt+S / 右键菜单（页面或链接）。
 *  流程：取当前页 URL + 标题 → POST {站点}/api/quick-add（Bearer 连接码）
 *        → 服务端自动补全图标与 AI 简述并去重。
 *  未连接 / 断网时先暂存在扩展本地（chrome.storage.local），条件恢复后自动补传。
 */

const DEFAULT_SITE = 'https://shiguang-nav.diaoyudao110.workers.dev'
const BADGE_COLOR_OK = '#5b5ce2'
const BADGE_COLOR_WAIT = '#f59e0b'

/* ---------- 生命周期 ---------- */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'shiguang-page', title: '添加到拾光导航', contexts: ['page'] })
    chrome.contextMenus.create({ id: 'shiguang-link', title: '把链接添加到拾光导航', contexts: ['link'] })
  })
  flushQueue()
})

chrome.runtime.onStartup.addListener(() => flushQueue())

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'flush') flushQueue()
  if (msg?.type === 'queue-changed') refreshBadge()
})

chrome.action.onClicked.addListener((tab) => captureTab(tab))
chrome.commands.onCommand.addListener((_command, tab) => captureTab(tab))
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'shiguang-page' && info.pageUrl) {
    captureItem({ url: info.pageUrl, title: (info.selectionText || '').trim() })
  }
  if (info.menuItemId === 'shiguang-link' && info.linkUrl) {
    captureItem({ url: info.linkUrl, title: (info.selectionText || '').trim() })
  }
})

/* ---------- 收藏 ---------- */

function hostnameOf(u) {
  try {
    return new URL(u).hostname
  } catch {
    return ''
  }
}

async function captureTab(tab) {
  if (!tab?.url) {
    notify('无法读取该页面地址：浏览器内置页面（如设置页）不支持收藏')
    return
  }
  const title = (tab.title || '').trim()
  captureItem({ url: tab.url, title: title || hostnameOf(tab.url) })
}

async function captureItem(item) {
  if (!/^https?:\/\//i.test(item.url || '')) {
    notify('仅支持收藏 http/https 网页')
    return
  }
  try {
    const { status, data } = await sendToNav(item)
    if (status === 401 || status === 403) {
      await pushQueue(item)
      notify('还没有连接导航站：请在扩展「选项」里粘贴站点生成的连接码。本页已暂存，连接后自动同步。', '拾光导航 · 请先连接')
      return
    }
    if (status >= 500) {
      await pushQueue(item)
      notify('服务器暂时不可用，已暂存，稍后自动重试。', '拾光导航 · 已暂存')
      return
    }
    if (status >= 400) {
      notify(data.error || `保存失败（${status}）`)
      return
    }
    flash('✓')
    if (data.duplicate) {
      notify(`「${data.site?.name || item.url}」已在导航站中，未重复添加。`, '拾光导航 · 已存在')
    } else {
      const extra = data.descSource === 'ai' ? '，AI 简述已生成' : data.descSource === 'meta' ? '' : ''
      notify(`「${data.site?.name || item.url}」已加入导航站${extra}`, '拾光导航 · 收藏成功')
    }
    flushQueue() // 有暂存时顺带补传
  } catch {
    await pushQueue(item)
    notify('网络异常，已暂存；恢复后会自动同步。', '拾光导航 · 已暂存')
  }
}

/** POST quick-add；网络层异常直接抛出，由调用方决定暂存 */
async function sendToNav(item) {
  const { siteUrl, token } = await chrome.storage.local.get({ siteUrl: DEFAULT_SITE, token: '' })
  const base = String(siteUrl || DEFAULT_SITE).replace(/\/+$/, '')
  const res = await fetch(`${base}/api/quick-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url: item.url, title: item.title || '' }),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

/* ---------- 暂存队列 ---------- */

function urlKey(u) {
  return String(u || '').replace(/\/+$/, '').toLowerCase()
}

async function pushQueue(item) {
  const { queue = [] } = await chrome.storage.local.get('queue')
  if (!queue.some((q) => urlKey(q.url) === urlKey(item.url))) {
    queue.push({ url: item.url, title: item.title || '', ts: Date.now() })
    await chrome.storage.local.set({ queue })
  }
  await refreshBadge()
}

/** 依次补传暂存；认证失败 / 网络断开即停止（剩余原样保留） */
async function flushQueue() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  if (!queue.length) return
  const remaining = []
  let synced = 0
  let dropped = 0
  for (let i = 0; i < queue.length; i++) {
    try {
      const { status } = await sendToNav(queue[i])
      if (status === 401 || status === 403 || status >= 500) {
        remaining.push(...queue.slice(i))
        break
      }
      if (status >= 400) dropped++
      else synced++
    } catch {
      remaining.push(...queue.slice(i))
      break
    }
  }
  await chrome.storage.local.set({ queue: remaining })
  await refreshBadge()
  if (synced > 0) notify(`已同步暂存的 ${synced} 条收藏${dropped ? `（${dropped} 条被站点拒绝，已丢弃）` : ''}。`, '拾光导航 · 暂存已同步')
}

/* ---------- 角标与通知 ---------- */

function flash(text) {
  chrome.action.setBadgeText({ text })
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_OK })
  setTimeout(() => refreshBadge(), 1500)
}

async function refreshBadge() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  chrome.action.setBadgeText({ text: queue.length ? String(queue.length) : '' })
  if (queue.length) chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_WAIT })
}

async function notify(message, title = '拾光导航') {
  const { quiet } = await chrome.storage.local.get({ quiet: false })
  if (quiet) return
  try {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/128.png', title, message })
  } catch {
    /* 通知失败不影响收藏 */
  }
}
