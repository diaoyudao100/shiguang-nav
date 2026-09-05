import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Category, NavData, Note, Settings, Site } from '../types'
import { defaultData, loadData, migrate, saveData, STORAGE_KEY } from '../lib/storage'
import { uid } from '../lib/id'
import { normalizeUrl } from '../lib/favicon'
import { api } from '../lib/api'
import { registerAutoModelSaver } from '../lib/ai'
import { useAuth } from './useAuth'

export interface SyncStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  time: number
  cloud: boolean
}

interface StoreCtx {
  data: NavData
  sync: SyncStatus
  addSite: (s: Omit<Site, 'id' | 'addedAt'>) => void
  updateSite: (id: string, patch: Partial<Site>) => void
  deleteSite: (id: string) => void
  togglePin: (id: string) => void
  toggleHidden: (id: string) => void
  addCategory: (name: string, icon?: string) => Category | null
  renameCategory: (id: string, name: string) => void
  setCategoryIcon: (id: string, icon: string) => void
  deleteCategory: (id: string) => void
  moveCategory: (id: string, dir: -1 | 1) => void
  /** 拖拽落点：把站点移动到某个分类网格的 anchor 之前/之后（或末尾） */
  dropSite: (dragId: string, targetCategoryId: string, anchorId: string | null, after: boolean) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: NavData) => void
  mergeImport: (categories: Category[], sites: Site[]) => void
  resetAll: () => void
  addNote: () => Note
  updateNote: (id: string, text: string) => void
  updateNoteTitle: (id: string, title: string) => void
  toggleNotePin: (id: string) => void
  deleteNote: (id: string) => void
}

const Ctx = createContext<StoreCtx | null>(null)

const SYNC_META_KEY = 'shiguang.nav.v2.sync'

interface SyncMeta {
  lastCloudUpdatedAt: number
  dirty: boolean
}

function readSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { lastCloudUpdatedAt: 0, dirty: false }
}

function writeSyncMeta(m: SyncMeta): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(m))
}

function cacheKey(scope: string): string {
  return `shiguang.nav.v2.cache.${scope}`
}

/** 推送到云端的数据剥离本地性字段（主题跟随设备） */
function cloudPayload(data: NavData): NavData {
  return { ...data, settings: { ...data.settings, theme: 'system' } }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<NavData>(() => loadData())
  const [sync, setSync] = useState<SyncStatus>({ state: 'idle', time: 0, cloud: false })
  const localTimer = useRef<ReturnType<typeof setTimeout>>()
  const cloudTimer = useRef<ReturnType<typeof setTimeout>>()
  const applyingRemote = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data
  const prevScope = useRef('local')
  const lastLocalSaveAt = useRef(0)

  // 本地持久化（始终开启：离线可用 + 未登录本地模式）
  useEffect(() => {
    if (applyingRemote.current) return
    setSync((s) => (user ? s : { ...s, state: 'saving' }))
    clearTimeout(localTimer.current)
    localTimer.current = setTimeout(() => {
      try {
        const next = JSON.stringify(data)
        // 内容与存储一致时跳过写入，避免多标签页互相触发无限保存
        if (localStorage.getItem(STORAGE_KEY) === next) {
          if (!user) setSync({ state: 'saved', time: Date.now(), cloud: false })
          return
        }
        // 防回退保护：站点数变少时先把现有数据留一份快照
        try {
          const prev = localStorage.getItem(STORAGE_KEY)
          if (prev) {
            const p = JSON.parse(prev)
            if (Array.isArray(p?.sites) && p.sites.length > data.sites.length) {
              localStorage.setItem('shiguang.nav.backup', prev)
            }
          }
        } catch {
          /* ignore */
        }
        localStorage.setItem(STORAGE_KEY, next)
        lastLocalSaveAt.current = Date.now()
      } catch {
        /* 存储满等异常：忽略 */
      }
      if (!user) setSync({ state: 'saved', time: Date.now(), cloud: false })
    }, 150)
    return () => clearTimeout(localTimer.current)
  }, [data, user])

  // 跨标签页同步：其他标签写入且内容确实不同时才采用；采用的数据来自存储，无需再回写
  useEffect(() => {
    const adopt = (candidate: string | null) => {
      if (applyingRemote.current || !candidate) return
      if (candidate === JSON.stringify(dataRef.current)) return
      if (Date.now() - lastLocalSaveAt.current < 1000) return // 本标签刚写入过
      if (user && readSyncMeta().dirty) return // 已登录且有未同步修改时保留本地
      applyingRemote.current = true
      try {
        setData(JSON.parse(candidate) as NavData)
      } catch {
        /* ignore */
      }
      applyingRemote.current = false
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) adopt(e.newValue)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') adopt(localStorage.getItem(STORAGE_KEY))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user])

  // 用户发起的修改 → 标脏
  const mutate = useCallback((fn: (d: NavData) => NavData) => {
    if (!applyingRemote.current) writeSyncMeta({ ...readSyncMeta(), dirty: true })
    setData((d) => fn({ ...d, categories: [...d.categories], sites: [...d.sites] }))
  }, [])

  // 登录/登出：切换数据作用域（按用户隔离本地缓存 + 云端拉取/初始化）
  useEffect(() => {
    const scope = user?.id ?? 'local'
    if (prevScope.current === scope) return
    const from = prevScope.current
    prevScope.current = scope
    let cancelled = false
    ;(async () => {
      // 1. 把当前视图的数据存入上一个作用域的缓存
      try {
        localStorage.setItem(cacheKey(from), JSON.stringify({ data: dataRef.current, meta: readSyncMeta() }))
      } catch {
        /* ignore */
      }
      // 2. 取出新作用域的起始数据
      let base: NavData | null = null
      if (scope === 'local') {
        // 登出：保留登录期间看到的最新数据，避免界面“回退”到登录前的旧状态
        base = dataRef.current
        writeSyncMeta({ ...readSyncMeta(), dirty: false })
      } else {
        try {
          const raw = localStorage.getItem(cacheKey(scope))
          if (raw) {
            const c = JSON.parse(raw) as { data: NavData; meta: SyncMeta }
            base = c.data
            writeSyncMeta(c.meta)
          }
        } catch {
          /* ignore */
        }
        if (!base) {
          base = defaultData()
          writeSyncMeta({ lastCloudUpdatedAt: 0, dirty: false })
        }
      }

      // 3. 登录状态：与云端对齐（主题跟随本机）
      const keptTheme = dataRef.current.settings.theme
      if (user) {
        try {
          const r = await api.getData()
          if (cancelled) return
          const meta = readSyncMeta()
          if (r.data && r.updatedAt && r.updatedAt > meta.lastCloudUpdatedAt) {
            // 云端数据可能来自旧版本（缺 icon 等新字段）：过一遍字段修补再采用
            const normalized = migrate(r.data)
            base = { ...normalized, settings: { ...normalized.settings, theme: keptTheme } }
            writeSyncMeta({ lastCloudUpdatedAt: r.updatedAt, dirty: false })
          } else if (!r.data && !meta.dirty) {
            // 云端还没有数据且本地无未同步的修改：以默认示例数据初始化云端
            const pr = await api.putData(cloudPayload(base))
            if (cancelled) return
            writeSyncMeta({ lastCloudUpdatedAt: pr.updatedAt, dirty: false })
          }
          setSync({ state: 'saved', time: Date.now(), cloud: true })
        } catch {
          if (!cancelled) setSync({ state: 'error', time: Date.now(), cloud: true })
        }
      } else {
        setSync({ state: 'saved', time: Date.now(), cloud: false })
      }

      // 4. 应用（不标记脏）
      applyingRemote.current = true
      setData(base)
      try {
        saveData(base)
      } catch {
        /* ignore */
      }
      applyingRemote.current = false
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // 已登录且有改动 → 防抖推送云端
  useEffect(() => {
    if (!user || applyingRemote.current) return
    if (!readSyncMeta().dirty) return
    setSync((s) => ({ ...s, state: 'saving', cloud: true }))
    clearTimeout(cloudTimer.current)
    cloudTimer.current = setTimeout(async () => {
      try {
        const r = await api.putData(cloudPayload(data))
        writeSyncMeta({ lastCloudUpdatedAt: r.updatedAt, dirty: false })
        setSync({ state: 'saved', time: Date.now(), cloud: true })
      } catch {
        setSync({ state: 'error', time: Date.now(), cloud: true })
      }
    }, 2500)
    return () => clearTimeout(cloudTimer.current)
  }, [data, user])

  // 关闭/隐藏页面前：立即推送未保存的改动
  useEffect(() => {
    if (!user) return
    const flush = () => {
      if (!readSyncMeta().dirty) return
      // sendBeacon 自动携带同源 cookie；content-type 用 text/plain 触发不了预检
      const blob = new Blob([JSON.stringify({ data: cloudPayload(data) })], { type: 'text/plain' })
      navigator.sendBeacon('/api/data', blob)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [user, data])

  const api2 = useMemo<StoreCtx>(() => {
    return {
      data,
      sync,
      addSite: (s) =>
        mutate((d) => {
          d.sites.push({
            ...s,
            url: normalizeUrl(s.url),
            id: 's-' + uid(),
            addedAt: Date.now(),
          })
          return d
        }),
      updateSite: (id, patch) =>
        mutate((d) => {
          const i = d.sites.findIndex((x) => x.id === id)
          if (i >= 0) d.sites[i] = { ...d.sites[i], ...patch }
          return d
        }),
      deleteSite: (id) =>
        mutate((d) => {
          d.sites = d.sites.filter((x) => x.id !== id)
          return d
        }),
      togglePin: (id) =>
        mutate((d) => {
          const s = d.sites.find((x) => x.id === id)
          if (s) s.pinned = !s.pinned
          return d
        }),
      toggleHidden: (id) =>
        mutate((d) => {
          const s = d.sites.find((x) => x.id === id)
          if (s) {
            s.hidden = !s.hidden
            if (s.hidden) s.pinned = false
          }
          return d
        }),
      addCategory: (name, icon) => {
        const trimmed = name.trim()
        if (!trimmed) return null
        if (data.categories.some((c) => c.name === trimmed)) return null
        const cat: Category = { id: 'cat-' + uid(), name: trimmed, icon: icon || '' }
        mutate((d) => {
          d.categories.push(cat)
          return d
        })
        return cat
      },
      renameCategory: (id, name) =>
        mutate((d) => {
          const c = d.categories.find((x) => x.id === id)
          if (c && name.trim()) c.name = name.trim()
          return d
        }),
      setCategoryIcon: (id, icon) =>
        mutate((d) => {
          const c = d.categories.find((x) => x.id === id)
          if (c) c.icon = icon
          return d
        }),
      deleteCategory: (id) =>
        mutate((d) => {
          // 分类删除后其下站点归入第一个剩余分类；若无则新建「未分类」
          let fallback = d.categories.find((c) => c.id !== id)
          if (!fallback) {
            fallback = { id: 'cat-' + uid(), name: '未分类' }
            d.categories.push(fallback)
          }
          d.sites.forEach((s) => {
            if (s.categoryId === id) s.categoryId = fallback!.id
          })
          d.categories = d.categories.filter((c) => c.id !== id)
          return d
        }),
      moveCategory: (id, dir) =>
        mutate((d) => {
          const i = d.categories.findIndex((c) => c.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= d.categories.length) return d
          ;[d.categories[i], d.categories[j]] = [d.categories[j], d.categories[i]]
          return d
        }),
      dropSite: (dragId, targetCategoryId, anchorId, after) =>
        mutate((d) => {
          const from = d.sites.findIndex((x) => x.id === dragId)
          if (from < 0) return d
          const dragged = { ...d.sites[from] }
          d.sites.splice(from, 1)
          dragged.categoryId = targetCategoryId
          let insertAt: number
          if (anchorId && anchorId !== dragId) {
            const ai = d.sites.findIndex((x) => x.id === anchorId)
            insertAt = ai < 0 ? d.sites.length : after ? ai + 1 : ai
          } else {
            let last = -1
            d.sites.forEach((s, i) => {
              if (s.categoryId === targetCategoryId) last = i
            })
            insertAt = last >= 0 ? last + 1 : d.sites.length
          }
          d.sites.splice(insertAt, 0, dragged)
          return d
        }),
      setSettings: (patch) =>
        mutate((d) => {
          d.settings = { ...d.settings, ...patch }
          return d
        }),
      replaceAll: (next) => mutate(() => next),
      mergeImport: (categories, sites) =>
        mutate((d) => {
          const nameToId = new Map(d.categories.map((c) => [c.name, c.id]))
          const idMap = new Map<string, string>()
          for (const c of categories) {
            const exist = nameToId.get(c.name)
            if (exist) {
              idMap.set(c.id, exist)
            } else {
              const nc = { id: 'cat-' + uid(), name: c.name }
              d.categories.push(nc)
              nameToId.set(nc.name, nc.id)
              idMap.set(c.id, nc.id)
            }
          }
          const urls = new Set(d.sites.map((s) => normalizeUrl(s.url).replace(/\/+$/, '')))
          for (const s of sites) {
            const key = normalizeUrl(s.url).replace(/\/+$/, '')
            if (urls.has(key)) continue
            urls.add(key)
            d.sites.push({ ...s, id: 's-' + uid(), categoryId: idMap.get(s.categoryId) ?? d.categories[0]?.id ?? '' })
          }
          return d
        }),
      resetAll: () => mutate(() => defaultData()),
      addNote: () => {
        const now = Date.now()
        const note: Note = { id: 'n-' + uid(), title: '', text: '', pinned: false, updatedAt: now }
        mutate((d) => {
          d.notes.push(note)
          return d
        })
        return note
      },
      updateNote: (id, text) =>
        mutate((d) => {
          const n = d.notes.find((x) => x.id === id)
          if (n) {
            n.text = text.slice(0, 2000)
            n.updatedAt = Date.now()
          }
          return d
        }),
      updateNoteTitle: (id, title) =>
        mutate((d) => {
          const n = d.notes.find((x) => x.id === id)
          if (n) {
            n.title = title.slice(0, 60)
            n.updatedAt = Date.now()
          }
          return d
        }),
      toggleNotePin: (id) =>
        mutate((d) => {
          const n = d.notes.find((x) => x.id === id)
          if (n) n.pinned = !n.pinned
          return d
        }),
      deleteNote: (id) =>
        mutate((d) => {
          d.notes = d.notes.filter((x) => x.id !== id)
          return d
        }),
    }
  }, [data, sync, mutate])

  // AI 请求自动纠正模型后（提供商不支持所配模型），写回设置持久化
  const autoModelSaverRef = useRef<(m: string) => void>(() => {})
  autoModelSaverRef.current = (m) =>
    mutate((d) =>
      d.settings.aiModel === m ? d : { ...d, settings: { ...d.settings, aiModel: m } },
    )
  useEffect(() => {
    registerAutoModelSaver((m) => autoModelSaverRef.current(m))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/** 备份文件 → NavData（校验 + 兜底） */
export function backupToNavData(raw: unknown): NavData | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Partial<NavData> & { app?: string }
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.sites)) return null
  const fallback = defaultData()
  return {
    version: 1,
    categories: obj.categories,
    sites: obj.sites,
    settings: obj.settings ?? fallback.settings,
    notes: Array.isArray(obj.notes)
      ? obj.notes.map((x: Partial<Note>) => ({
          id: x.id ?? 'n-' + Math.random().toString(36).slice(2),
          title: typeof x.title === 'string' ? x.title.slice(0, 60) : '',
          text: typeof x.text === 'string' ? x.text : '',
          pinned: !!x.pinned,
          updatedAt: x.updatedAt ?? Date.now(),
        }))
      : fallback.notes,
  }
}
