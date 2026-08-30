/** 拾光导航 · 一键收藏 — MV3 service worker
 *
 *  触发：点扩展图标 / Alt+S / 右键菜单（页面或链接）。
 *  流程：弹出「确认收藏」小窗 —— 自动读取导航站全部分类做下拉框，
 *        同时请求 AI 推荐分类与简介并预选，用户确认后才入库。
 */

const DEFAULT_SITE = 'https://shiguang-nav.diaoyudao110.workers.dev'
const WIN_WIDTH = 400
const WIN_HEIGHT = 480

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'shiguang-page', title: '添加到拾光导航', contexts: ['page'] })
    chrome.contextMenus.create({ id: 'shiguang-link', title: '把链接添加到拾光导航', contexts: ['link'] })
  })
})

chrome.action.onClicked.addListener((tab) => captureTab(tab))
chrome.commands.onCommand.addListener((_command, tab) => captureTab(tab))
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'shiguang-page' && info.pageUrl) {
    captureItem(info.pageUrl, (tab?.title || '').trim() || (info.selectionText || '').trim())
  }
  if (info.menuItemId === 'shiguang-link' && info.linkUrl) {
    captureItem(info.linkUrl, (info.selectionText || '').trim())
  }
})

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
  openConfirm(tab.url, (tab.title || '').trim() || hostnameOf(tab.url))
}

function captureItem(url, title) {
  if (!/^https?:\/\//i.test(url || '')) {
    notify('仅支持收藏 http/https 网页')
    return
  }
  openConfirm(url, (title || '').trim() || hostnameOf(url))
}

/** 在当前屏幕右上角弹出确认小窗 */
async function openConfirm(url, title) {
  const q = new URLSearchParams({ url, title })
  const createInfo = {
    url: `confirm.html?${q.toString()}`,
    type: 'popup',
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
  }
  try {
    const win = await chrome.windows.getLastFocused()
    if (win) {
      createInfo.left = Math.max(0, (win.left ?? 0) + (win.width ?? 900) - WIN_WIDTH - 28)
      createInfo.top = Math.max(0, (win.top ?? 0) + 72)
    }
  } catch {
    /* 定位失败就让系统摆放 */
  }
  try {
    await chrome.windows.create(createInfo)
  } catch {
    notify('无法打开确认窗口')
  }
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
