import type { Todo } from '../types'

export const REPEAT_OPTS = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'ndays', label: '每 N 天' },
] as const

/** 循环待办完成后的重复角标文案（不循环返回 null） */
export function repeatBadgeText(t: Todo): string | null {
  if (t.repeat === 'daily') return '每天'
  if (t.repeat === 'weekly') return '每周'
  if (t.repeat === 'ndays') return `每${normalizeRepeatDays(t.repeatDays)}天`
  return null
}

export function normalizeRepeatDays(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 30
  return Math.min(365, Math.max(1, n))
}

/** 循环待办完成后，滚动到的下一个到期时刻（每天 +1 天 / 每周 +7 天 / 每 N 天 +N 天） */
export function nextRemindAt(t: Todo): number {
  const days =
    t.repeat === 'daily' ? 1 : t.repeat === 'weekly' ? 7 : normalizeRepeatDays(t.repeatDays)
  return t.remindAt + days * 86400_000
}
