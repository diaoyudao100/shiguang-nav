import { lazy, Suspense, useEffect, useState } from 'react'
import { StoreProvider, useStore } from './hooks/useStore'
import { ThemeProvider } from './hooks/useTheme'
import { usePath } from './lib/router'
import { DEFAULT_FAVICON } from './lib/favicon'
import { ACCENT_ALIAS } from './lib/storage'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { Sections, type DragState } from './components/Sections'
import { LinkModal } from './components/LinkModal'
import { CategoryModal } from './components/CategoryModal'
import { DataModal } from './components/DataModal'
import { SettingsModal, type Tab } from './components/SettingsModal'
import { EmptyArt } from './components/EmptyArt'
import { AuthPage } from './pages/AuthPage'
import { useToast } from './components/Toast'
import type { Site } from './types'

// 管理后台按需加载：首屏用不到，拆出主包
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

interface LinkModalState {
  open: boolean
  site: Site | null
  defaultCategoryId: string | null
}

function Shell() {
  const { data, togglePin, dropSite } = useStore()
  const toast = useToast()
  const [scope, setScope] = useState<'in' | 'out'>('in')
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState>({ id: null, from: 'category', edge: null })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sortMode, setSortMode] = useState(false)
  const [linkModal, setLinkModal] = useState<LinkModalState>({ open: false, site: null, defaultCategoryId: null })
  const [catModal, setCatModal] = useState(false)
  const [dataModal, setDataModal] = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [settingsTab, setSettingsTab] = useState<Tab | null>(null)
  /** 滚动到底部时取消内容区底部渐隐 */
  const [atBottom, setAtBottom] = useState(true)

  // 滚动位置：未到底时给主内容区加底部渐隐 mask
  useEffect(() => {
    const onScroll = () =>
      setAtBottom(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const openAdd = (catId: string | null = null) =>
    setLinkModal({ open: true, site: null, defaultCategoryId: catId ?? activeCat })

  const openSettings = (tab: Tab | null) => {
    setSettingsTab(tab)
    setSettingsModal(true)
  }

  // 账户菜单「快速上手」里的跳转按钮（导入书签 / 配置 AI）
  useEffect(() => {
    const onOpenData = () => setDataModal(true)
    const onOpenSettings = (e: Event) => openSettings((e as CustomEvent<string>).detail as Tab)
    window.addEventListener('shiguang:open-data', onOpenData)
    window.addEventListener('shiguang:open-settings', onOpenSettings)
    return () => {
      window.removeEventListener('shiguang:open-data', onOpenData)
      window.removeEventListener('shiguang:open-settings', onOpenSettings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 触屏设备一次性提示：齿轮已改为「长按卡片」唤起编辑
  useEffect(() => {
    if (!window.matchMedia('(hover: none)').matches) return
    const KEY = 'shiguang.longpress.hint'
    if (localStorage.getItem(KEY)) return
    const t = setTimeout(() => {
      toast('提示：长按网站卡片可编辑 / 置顶 / 隐藏')
      localStorage.setItem(KEY, '1')
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dropToCategory = (catId: string) => {
    if (!drag.id) return
    if (catId === '__pinned__') {
      togglePin(drag.id)
      toast('已置顶')
    } else {
      dropSite(drag.id, catId, null, false)
      toast(`已移动到「${data.categories.find((c) => c.id === catId)?.name ?? catId}」`)
    }
    setDrag({ id: null, from: 'category', edge: null })
  }

  return (
    <div className="min-h-screen">
      <Header
        search={{ scope, setScope, query, setQuery }}
        onAdd={() => openAdd(null)}
        onSettings={() => openSettings(null)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sortMode={sortMode}
        onToggleSort={() => setSortMode((v) => !v)}
      />
      <div className="flex">
        <Sidebar
          activeCat={activeCat}
          onSelect={setActiveCat}
          onManage={() => setCatModal(true)}
          dragActiveId={drag.id}
          onDropToCategory={dropToCategory}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />
        <main
          className="min-w-0 flex-1 px-4 pb-6 pt-4 sm:px-5 sm:pt-6 md:px-7 md:pt-3.5"
          style={
            atBottom
              ? undefined
              : {
                  maskImage: 'linear-gradient(180deg, #000 calc(100% - 56px), transparent)',
                  WebkitMaskImage: 'linear-gradient(180deg, #000 calc(100% - 56px), transparent)',
                }
          }
        >
          {/* 移动端：顶栏不放搜索，正文顶部保留 */}
          <div className="mb-5 md:hidden">
            <SearchBar scope={scope} setScope={setScope} query={query} setQuery={setQuery} />
          </div>

          <div className="mt-1">
            <Sections
              drag={drag}
              setDrag={setDrag}
              query={scope === 'in' ? query.trim() : ''}
              activeCat={activeCat}
              sortMode={sortMode}
              onEditSite={(site) => setLinkModal({ open: true, site, defaultCategoryId: null })}
              onAddToCategory={(catId) => openAdd(catId)}
            />
          </div>

          {data.sites.length === 0 && !(scope === 'in' && query) && (
            <div className="mt-2 flex flex-col items-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-14 text-center">
              <EmptyArt kind="empty" />
              <p className="mt-4 text-[15px] font-medium text-ink">这里还是空的</p>
              <p className="mt-1.5 text-xs text-ink2">添加第一个网站，或从浏览器书签一键导入</p>
              <div className="mt-6 flex justify-center gap-2.5">
                <button onClick={() => openAdd(null)} className="btn-primary">
                  添加网站
                </button>
                <button onClick={() => setDataModal(true)} className="btn-ghost">
                  导入书签
                </button>
              </div>
            </div>
          )}

          <footer className="mt-14 border-t border-line pt-6 pb-10">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink2/80">
              <button onClick={() => setDataModal(true)} className="transition-colors hover:text-ink">
                导入 / 导出
              </button>
              <button onClick={() => setCatModal(true)} className="transition-colors hover:text-ink">
                管理分类
              </button>
              <a
                href="https://github.com/diaoyudao100/shiguang-nav"
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-ink"
              >
                GitHub 开源
              </a>
            </div>
            <p className="mt-4 text-center text-[11px] tracking-wide text-ink2/50">
              {data.settings.siteTitle?.trim() || '拾光导航'} · v2.5.0 · 本地优先，数据尽在掌控
            </p>
          </footer>
        </main>
      </div>

      <LinkModal
        open={linkModal.open}
        site={linkModal.site}
        defaultCategoryId={linkModal.defaultCategoryId}
        onClose={() => setLinkModal({ open: false, site: null, defaultCategoryId: null })}
      />
      <CategoryModal open={catModal} onClose={() => setCatModal(false)} />
      <DataModal open={dataModal} onClose={() => setDataModal(false)} />
      <SettingsModal
        open={settingsModal}
        onClose={() => setSettingsModal(false)}
        onOpenData={() => setDataModal(true)}
        initialTab={settingsTab}
      />
    </div>
  )
}

function Views() {
  const path = usePath()
  const { data } = useStore()
  const { siteTitle, favicon, accent, accentCustom, bgStyle, bgImage, bgImageEnabled, monoIcons, oledBlack } = data.settings

  // 网页标题、站点图标、强调色与背景跟随设置
  useEffect(() => {
    document.title = siteTitle?.trim() || '拾光 · 个人导航'
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = favicon?.trim() || DEFAULT_FAVICON

    const root = document.documentElement
    const a = ACCENT_ALIAS[accent ?? ''] ?? accent ?? 'purple'
    if (a === 'custom') {
      root.dataset.accent = 'custom'
      root.style.setProperty('--accent-custom', accentCustom || '#8b5cf6')
    } else if (a === 'purple') {
      root.removeAttribute('data-accent')
    } else {
      root.dataset.accent = a
    }

    if (bgStyle && bgStyle !== 'zinc') root.dataset.bg = bgStyle
    else root.removeAttribute('data-bg')

    // 单色图标模式：favicon 灰阶，悬浮恢复彩色
    if (monoIcons) root.dataset.mono = '1'
    else root.removeAttribute('data-mono')

    // OLED 纯黑：深色模式下底色压到纯黑
    if (oledBlack) root.dataset.oled = '1'
    else root.removeAttribute('data-oled')

    if (bgImageEnabled && bgImage?.trim()) {
      const scrim = 'color-mix(in srgb, var(--c-base) 60%, transparent)'
      root.style.setProperty(
        '--bg-custom',
        `linear-gradient(${scrim}, ${scrim}), url("${bgImage.trim().replace(/"/g, '%22')}")`,
      )
      root.style.setProperty('--bg-size', 'auto, cover')
    } else {
      root.style.removeProperty('--bg-custom')
      root.style.removeProperty('--bg-size')
    }
  }, [siteTitle, favicon, accent, accentCustom, bgStyle, bgImage, bgImageEnabled, monoIcons, oledBlack])

  if (path === '/login') return <AuthPage />
  if (path === '/admin')
    return (
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    )
  return <Shell />
}

export default function App() {
  const { data } = useStore()
  return (
    <ThemeProvider initial={data.settings.theme}>
      <Views />
    </ThemeProvider>
  )
}
