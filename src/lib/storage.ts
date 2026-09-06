import type { Category, NavData, Note, Settings, Site, ThemeMode, TrashItem } from '../types'

/**
 * 存储键升级为 v2：与旧版标签页（仍在读写 v1 的旧代码）完全隔离，
 * 旧标签页的任何写入都无法再覆盖新版数据。首次加载自动从 v1 迁移。
 */
export const STORAGE_KEY = 'shiguang.nav.v2'
const LEGACY_KEY = 'shiguang.nav.v1'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'purple',
  accentCustom: '',
  bgStyle: 'zinc',
  bgImage: '',
  bgImageEnabled: false,
  siteTitle: '拾光导航',
  favicon: '',
  maskClosable: true,
  showSiteUrl: true,
  gridDensity: '6',
  sidebarCollapsed: false,
  autoCommon: false,
  searchEngine: 'bing',
  aiProvider: 'openai',
  aiBaseURL: '',
  aiKey: '',
  aiModel: 'gpt-4o-mini',
}

/** 旧版强调色 id → 新 id */
export const ACCENT_ALIAS: Record<string, string> = {
  indigo: 'purple',
  sky: 'blue',
  emerald: 'green',
  rose: 'red',
  amber: 'orange',
}

const SEED_CATEGORIES: Category[] = [
  { id: 'c-often', name: '常用推荐', icon: 'star' },
  { id: 'c-dev', name: '开发工具', icon: 'code' },
  { id: 'c-design', name: '设计资源', icon: 'palette' },
  { id: 'c-read', name: '阅读资讯', icon: 'book-open' },
  { id: 'c-fun', name: '休闲娱乐', icon: 'gamepad-2' },
  { id: 'c-ai', name: '人工智能', icon: 'bot' },
]

function site(
  name: string,
  url: string,
  desc: string,
  categoryId: string,
  pinned = false,
): Site {
  return {
    id: 's-' + Math.random().toString(36).slice(2, 10),
    name,
    url,
    desc,
    categoryId,
    pinned,
    hidden: false,
    iconUrl: '',
    iconColor: '',
    addedAt: Date.now(),
  }
}

function seedSites(): Site[] {
  return [
    site('GitHub', 'https://github.com', '全球最大的代码托管平台，开源项目集散地', 'c-often', true),
    site('V2EX', 'https://v2ex.com', '创意工作者们的社区', 'c-often', true),
    site('MDN Web Docs', 'https://developer.mozilla.org', 'Web 技术权威文档', 'c-dev'),
    site('Vite', 'https://vitejs.dev', '下一代前端构建工具', 'c-dev'),
    site('React', 'https://react.dev', '用于构建 Web 与原生用户界面的库', 'c-dev', true),
    site('Tailwind CSS', 'https://tailwindcss.com', '无需离开 HTML 的实用优先 CSS 框架', 'c-dev'),
    site('Figma', 'https://www.figma.com', '在线协同界面设计工具', 'c-design', true),
    site('Dribbble', 'https://dribbble.com', '设计师作品分享与灵感社区', 'c-design'),
    site('Coolors', 'https://coolors.co', '超快的配色方案生成器', 'c-design'),
    site('少数派', 'https://sspai.com', '高质量数字消费指南', 'c-read', true),
    site('阮一峰的网络日志', 'https://www.ruanyifeng.com/blog/', '科技爱好者周刊与技术随笔', 'c-read'),
    site('Bilibili', 'https://www.bilibili.com', '哔哩哔哩弹幕视频网', 'c-fun'),
    site('YouTube', 'https://www.youtube.com', '全球最大的视频平台', 'c-fun'),
    site('ChatGPT', 'https://chatgpt.com', 'OpenAI 的对话式 AI 助手', 'c-ai'),
    site('Gemini', 'https://gemini.google.com', 'Google 的 AI 助手', 'c-ai'),
  ]
}

export function defaultData(): NavData {
  return {
    version: 1,
    categories: SEED_CATEGORIES,
    sites: seedSites(),
    notes: [],
    trash: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

/** 读取本地数据，损坏/为空时回退到默认 */
export function loadData(): NavData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    return migrate(data)
  } catch {
    return defaultData()
  }
}

export function saveData(data: NavData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** 常见分类名 → 建议图标（首次迁移补 icon 字段时套用，之后用户改动不再覆盖） */
const CAT_ICON_SUGGEST: Record<string, string> = {
  常用推荐: 'star', 常用: 'star',
  开发工具: 'code', 开发: 'code', 编程: 'code',
  设计资源: 'palette', 设计: 'palette',
  阅读资讯: 'book-open', 阅读: 'book-open', 资讯: 'book-open', 新闻: 'newspaper',
  休闲娱乐: 'gamepad-2', 娱乐: 'gamepad-2', 游戏: 'gamepad-2',
  人工智能: 'bot', AI: 'bot',
  学习教育: 'graduation-cap', 学习: 'graduation-cap', 教育: 'graduation-cap',
  工具: 'wrench', 影视: 'film', 音乐: 'music', 购物: 'shopping-cart',
  社交: 'message-circle', 办公: 'briefcase', 金融: 'credit-card', 邮箱: 'mail',
  导航: 'compass', 网盘: 'cloud', 搜索: 'search', 生活: 'coffee', 健康: 'heart-pulse',
}

/** 宽松的字段修补，保证结构完整（云端同步等外部数据入口必须过一遍，兼容旧格式） */
export function migrate(data: Partial<NavData>): NavData {
  const base = defaultData()
  const categories = Array.isArray(data.categories)
    ? data.categories
        .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
        .map((c) => ({
          ...c,
          // 旧数据没有 icon 字段：按常见分类名补一个建议图标
          icon: typeof c.icon === 'string' ? c.icon : (CAT_ICON_SUGGEST[c.name.trim()] ?? ''),
        }))
    : base.categories
  // 分类 id 合法性修复：历史版本曾把「分类名」当成 categoryId 存进站点（站点会落到
  // 不存在的分类下，页面上任何区块都不渲染）。这里把名称重新映射回 id，
  // 完全未知的分类归入第一个分类，保证每个站点都可见。
  const catIds = new Set(categories.map((c) => c.id))
  const catIdByName = new Map(categories.map((c) => [c.name.trim(), c.id]))
  const fixCategoryId = (raw: string | undefined): string => {
    if (raw && catIds.has(raw)) return raw
    const byName = raw ? catIdByName.get(raw.trim()) : undefined
    return byName || categories[0]?.id || 'c-often'
  }
  const sites = Array.isArray(data.sites)
    ? data.sites
        .filter((s: Site) => s && typeof s.url === 'string')
        .map((s: Partial<Site>, i: number) => ({
          id: s.id || 's-' + i,
          name: s.name || s.url || '未命名',
          url: s.url!,
          desc: s.desc || '',
          categoryId: fixCategoryId(s.categoryId),
          pinned: !!s.pinned,
          hidden: !!s.hidden,
          iconUrl: s.iconUrl || '',
          iconColor: s.iconColor || '',
          addedAt: s.addedAt || Date.now(),
        }))
    : base.sites
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
  settings.accent = ACCENT_ALIAS[settings.accent] ?? settings.accent
  settings.theme = (['light', 'dark', 'system'] as ThemeMode[]).includes(settings.theme)
    ? settings.theme
    : 'system'
  settings.showSiteUrl = settings.showSiteUrl !== false
  settings.gridDensity = (['4', '6', '8'] as const).includes(settings.gridDensity as '4' | '6' | '8')
    ? settings.gridDensity
    : '6'
  settings.sidebarCollapsed = !!settings.sidebarCollapsed
  settings.autoCommon = !!settings.autoCommon
  const notes: Note[] = Array.isArray(data.notes)
    ? data.notes
        .filter((n) => n && typeof n.text === 'string')
        .map((n: Partial<Note>, i: number) => ({
          id: n.id || 'n-' + i,
          title: typeof n.title === 'string' ? n.title.slice(0, 60) : '',
          text: n.text || '',
          pinned: !!n.pinned,
          updatedAt: n.updatedAt || Date.now(),
        }))
    : []
  // 回收站：结构修补 + 30 天自动过期
  const TRASH_TTL = 30 * 86400_000
  const trash: TrashItem[] = Array.isArray(data.trash)
    ? data.trash
        .filter(
          (t: Partial<TrashItem>) =>
            (t.kind === 'site' || t.kind === 'category') && t.data && typeof t.data === 'object',
        )
        .map((t: Partial<TrashItem>) => ({
          kind: t.kind as 'site' | 'category',
          data: t.data as Site | Category,
          deletedAt: t.deletedAt || Date.now(),
        }))
        .filter((t) => Date.now() - t.deletedAt < TRASH_TTL)
    : []
  return { version: 1, categories, sites, settings, notes, trash }
}
