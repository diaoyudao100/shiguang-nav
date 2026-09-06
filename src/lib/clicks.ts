/** 站点点击频率统计：仅存本机 localStorage，用于「智能常用」排序（不进云端同步） */

const KEY = 'shiguang.nav.v2.clicks'

export interface ClickStat {
  c: number // 点击次数
  t: number // 最近一次点击时间
}

export function getClicks(): Record<string, ClickStat> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ClickStat>
  } catch {
    return {}
  }
}

export function recordClick(siteId: string): void {
  try {
    const all = getClicks()
    const cur = all[siteId] ?? { c: 0, t: 0 }
    all[siteId] = { c: cur.c + 1, t: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
