export interface Category {
  id: string
  name: string
  icon?: string // lucide 图标名（kebab-case），空/未设置 = 回退 Folder
}

export interface Site {
  id: string
  name: string
  url: string
  desc: string
  categoryId: string
  pinned: boolean
  hidden: boolean // 隐藏后不在列表显示，可在「已隐藏」区恢复
  iconUrl: string // 自定义图标（http 或 data URL），空 = 自动获取
  iconColor: string // 字母头像颜色 #RRGGBB，空 = 按名称自动
  addedAt: number
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type AiProvider = 'openai' | 'gemini'

/** 登录用户（Worker 与前端共用） */
export interface AuthUser {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: 'admin' | 'user'
}

export interface Settings {
  theme: ThemeMode
  accent: string // 强调色预设 id：purple / blue / pink / red / orange / green / slate / custom
  accentCustom: string // 自定义强调色 #RRGGBB
  bgStyle: 'zinc' | 'slate' | 'neutral' // 背景灰调
  bgImage: string // 自定义背景图 URL / data URL
  bgImageEnabled: boolean
  siteTitle: string // 网页标题（浏览器标签 + 站点名）
  favicon: string // 站点图标（data URL / http URL），空 = 内置默认
  maskClosable: boolean // 点击遮罩关闭弹窗
  searchEngine: string
  greetingName: string
  aiProvider: AiProvider
  aiBaseURL: string
  aiKey: string
  aiModel: string
}

export interface NavData {
  version: number
  categories: Category[]
  sites: Site[]
  settings: Settings
}

/** 导出文件里的结构（不含敏感信息） */
export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  categories: Category[]
  sites: Site[]
}
