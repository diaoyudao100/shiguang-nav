import { useCallback, useEffect, useRef, useState } from 'react'
import type { Todo } from '../types'
import { useStore } from './useStore'
import { useAuth } from './useAuth'
import { useToast } from '../components/Toast'

export interface TodoBannerItem {
  todo: Todo
  /** 到期状态文案，如「距到期还有 2 天」「已过期 · 今天 09:00」 */
  label: string
  overdue: boolean
}

const SNOOZE_MS = 5 * 60_000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtWhen(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const day = (offset: number) => {
    const x = new Date(now)
    x.setDate(now.getDate() + offset)
    return d.toDateString() === x.toDateString()
  }
  if (day(0)) return `今天 ${hm}`
  if (day(1)) return `明天 ${hm}`
  if (day(-1)) return `昨天 ${hm}`
  const sameYear = d.getFullYear() === now.getFullYear()
  return `${sameYear ? '' : d.getFullYear() + '/'}${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

function dueLabel(t: Todo, now: number): { label: string; overdue: boolean } {
  if (now >= t.remindAt) return { label: `已过期 · ${fmtWhen(t.remindAt)}`, overdue: true }
  const d = new Date(t.remindAt)
  const n = new Date(now)
  if (d.toDateString() === n.toDateString()) {
    return { label: `今天 ${pad(d.getHours())}:${pad(d.getMinutes())} 到期`, overdue: false }
  }
  const days = Math.max(1, Math.ceil((t.remindAt - now) / 86400_000))
  return { label: `距到期还有 ${days} 天`, overdue: false }
}

/** 提示音：双音轻响（Web Audio 合成，无音频资源）。
 *  AudioContext 需要用户手势解锁，首次点击/按键时预热。 */
let audioCtx: AudioContext | null = null
function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {
    /* 不支持则静默 */
  }
}
function playChime() {
  try {
    if (!audioCtx) return
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    if (audioCtx.state !== 'running') return
    const beepAt = (t0: number, freq: number) => {
      const o = audioCtx!.createOscillator()
      const g = audioCtx!.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
      o.connect(g)
      g.connect(audioCtx!.destination)
      o.start(t0)
      o.stop(t0 + 0.3)
    }
    const t = audioCtx.currentTime + 0.02
    beepAt(t, 880)
    beepAt(t + 0.22, 1174.7)
  } catch {
    /* 无声环境忽略，红条仍在 */
  }
}

/** 待办提醒调度：20 秒一轮 + 页面切回前台立即补扫。
 *  进入提醒期（到期前 N 天，见设置）后，每个节点弹一次横幅；多条到期在横幅里堆叠展示。
 *  「已提醒」标记在用户做出处理时才写入，刷新/重开页面后未处理的会重新弹出（补提醒）。 */
export function useTodoReminders() {
  const { data, updateTodo, toggleTodoDone, pullIfNewer } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<TodoBannerItem[]>([])
  const dataRef = useRef(data)
  dataRef.current = data
  const prevIdsRef = useRef<Set<string>>(new Set())

  /** 系统通知：仅在设置开启、已授权、且页面在后台时发（前台有红条，不双重打扰） */
  const notify = useCallback((t: Todo, label: string) => {
    if (!dataRef.current.settings.todoNotify) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!document.hidden) return
    try {
      const n = new Notification('⏰ 待办提醒', {
        body: `${t.title}\n${label}` + (t.note ? `\n${t.note}` : ''),
        tag: t.id,
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch {
      /* 通知构造失败（如非安全上下文）静默忽略，红条仍在 */
    }
  }, [])

  const tick = useCallback(() => {
    const now = Date.now()
    const todos = dataRef.current.todos ?? []
    // 提醒节点：到期前 N 天起每 24 小时一个（N=提前提醒天数设置）
    const adv = Number(dataRef.current.settings.todoAdvanceDays ?? '7')
    const stages = Array.from({ length: adv + 1 }, (_, i) => (adv - i) * 24)
    const isDue = (t: Todo) => {
      if (t.done || (t.snoozedUntil && t.snoozedUntil > now)) return false
      const reminded = t.remindedAt ?? 0
      return stages.some((h) => {
        const boundary = t.remindAt - h * 3600_000
        return boundary <= now && reminded < boundary
      })
    }
    const due = todos.filter(isDue).sort((a, b) => a.remindAt - b.remindAt)
    const next = due.map((t) => ({ todo: t, ...dueLabel(t, now) }))
    setItems(next)

    // 提示音只对「新出现」的条目响一次；已展示的不重复响
    const fresh = next.filter((i) => !prevIdsRef.current.has(i.todo.id))
    if (fresh.length && dataRef.current.settings.todoSound) playChime()
    prevIdsRef.current = new Set(next.map((i) => i.todo.id))
    next.forEach((i) => notify(i.todo, i.label))
  }, [notify])

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    const boot = setTimeout(tick, 1200) // 等首屏渲染完再补扫
    const iv = setInterval(tick, 20_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      clearTimeout(boot)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [tick])

  // 标签页标题闪烁：横幅展示期间在标题前交替 ⏰/🔔，处理完恢复
  const hasBanner = items.length > 0
  useEffect(() => {
    if (!hasBanner) return
    const base = document.title.replace(/^[🔔⏰]\s*/, '')
    let on = false
    const apply = () => {
      document.title = (on ? '🔔 ' : '⏰ ') + base
      on = !on
    }
    apply()
    const iv = setInterval(apply, 800)
    return () => {
      clearInterval(iv)
      document.title = base
    }
  }, [hasBanner])

  // 多设备缓解：横幅展示期间每 30 秒静默拉一次云端，
  // 若待办已在别的设备被处理（remindedAt/done 已同步），本机横幅会随之撤下
  const pullRef = useRef(pullIfNewer)
  pullRef.current = pullIfNewer
  useEffect(() => {
    if (!hasBanner || !user) return
    const iv = setInterval(() => pullRef.current(), 30_000)
    return () => clearInterval(iv)
  }, [hasBanner, user])

  const rerun = useCallback(() => setTimeout(tick, 150), [tick])

  const complete = useCallback(
    (id: string) => {
      const t = (dataRef.current.todos ?? []).find((x) => x.id === id)
      const cycling = t && !t.done && (t.repeat === 'daily' || t.repeat === 'weekly')
      toggleTodoDone(id)
      if (cycling && t) {
        const step = t.repeat === 'daily' ? 86400_000 : 7 * 86400_000
        toast(`已完成，下次到期 ${fmtWhen(t.remindAt + step)}`)
      }
      rerun()
    },
    [toggleTodoDone, rerun, toast],
  )

  const snooze = useCallback(
    (id: string) => {
      updateTodo(id, { snoozedUntil: Date.now() + SNOOZE_MS })
      rerun()
    },
    [updateTodo, rerun],
  )

  /** 仅收起：当天后续节点不再弹（下一个节点第二天照常提醒） */
  const dismiss = useCallback(
    (id: string) => {
      updateTodo(id, { remindedAt: Date.now() })
      rerun()
    },
    [updateTodo, rerun],
  )

  return { items, complete, snooze, dismiss }
}
