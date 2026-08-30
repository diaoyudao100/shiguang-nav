/** 拾光导航 · 一键收藏 — 选项页 */

const DEFAULT_SITE = 'https://shiguang-nav.diaoyudao110.workers.dev'
const $ = (id) => document.getElementById(id)

function baseOf() {
  return ($('siteUrl').value.trim() || DEFAULT_SITE).replace(/\/+$/, '')
}

function setStatus(text, cls = '') {
  $('status').textContent = text
  $('status').className = `status ${cls}`
}

async function refreshPermission() {
  const granted = await chrome.permissions.contains({ origins: [`${baseOf()}/*`] })
  $('permRow').hidden = granted
}

async function init() {
  const { siteUrl, token, quiet } = await chrome.storage.local.get({ siteUrl: DEFAULT_SITE, token: '', quiet: false })
  $('siteUrl').value = siteUrl
  $('token').value = token
  $('quiet').checked = quiet
  await refreshPermission()
}

$('saveBtn').addEventListener('click', async () => {
  const base = baseOf()
  if (!/^https?:\/\//i.test(base)) {
    setStatus('站点地址必须以 http(s):// 开头', 'err')
    return
  }
  const granted = await chrome.permissions.contains({ origins: [`${base}/*`] })
  if (!granted) {
    try {
      await chrome.permissions.request({ origins: [`${base}/*`] })
    } catch {
      /* 用户拒绝授权：仍然保存，保存时提示 */
    }
  }
  await chrome.storage.local.set({
    siteUrl: base,
    token: $('token').value.trim(),
    quiet: $('quiet').checked,
  })
  await refreshPermission()
  const ok = await chrome.permissions.contains({ origins: [`${base}/*`] })
  setStatus(ok ? '已保存 ✓' : '已保存，但尚未授权访问该域名', ok ? 'ok' : 'err')
  chrome.runtime.sendMessage({ type: 'flush' })
})

$('testBtn').addEventListener('click', async () => {
  const base = baseOf()
  const token = $('token').value.trim()
  setStatus('检测中…')
  try {
    const res = await fetch(`${base}/api/device-check`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user) {
      setStatus(`已连接：${data.user.name}${data.user.email ? `（${data.user.email}）` : ''}`, 'ok')
    } else if (res.ok) {
      setStatus('站点可达，但连接码无效或未填写', 'err')
    } else {
      setStatus(data.error || `检测失败（${res.status}）`, 'err')
    }
  } catch {
    setStatus('无法连接站点：请检查地址是否正确、网络是否可达', 'err')
  }
})

$('grantBtn').addEventListener('click', async () => {
  try {
    await chrome.permissions.request({ origins: [`${baseOf()}/*`] })
  } catch {
    /* 拒绝则保持提示 */
  }
  await refreshPermission()
})

init()
