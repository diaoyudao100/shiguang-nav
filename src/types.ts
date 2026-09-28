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
  showSiteUrl: boolean // 网址卡片是否显示网站网址（关闭时仅显示名称并垂直居中）
  gridDensity: '4' | '6' | '8' // 桌面端一行卡片数
  sidebarCollapsed: boolean // 桌面端分类目录折叠为图标条
  autoCommon: boolean // 智能常用：置顶区自动追加点击频率最高的站点（点击数据仅存本机）
  monoIcons: boolean // 单色图标：favicon 转灰阶，悬浮恢复彩色（触屏保持单色）
  oledBlack: boolean // OLED 纯黑：深色模式下背景压到纯黑
  searchEngine: string
  todoNotify: boolean // 待办进入提醒期后，页面在后台时同时弹系统通知（需浏览器授权）
  todoSound: boolean // 待办提醒弹出时播放提示音
  todoAdvanceDays: '1' | '3' | '7' | '15' // 到期前多少天开始提醒
  aiProvider: AiProvider
  aiBaseURL: string
  aiKey: string
  aiModel: string
}

export interface Note {
  id: string
  title: string // 单行标题（可选），空 = 无标题便签
  text: string
  pinned: boolean // 置顶便签排在最前
  updatedAt: number
}

export interface Todo {
  id: string
  title: string
  note: string // 备注可选
  remindAt: number // 到期时间戳（ms）：到期前 N 天开始每天提醒（N 见设置 todoAdvanceDays）
  done: boolean
  repeat?: 'none' | 'daily' | 'weekly' // 循环待办：完成后自动滚动到下一周期
  remindedAt?: number // 最近一次提醒条处理（关闭/到期）时间，用于推算下个提醒节点
  snoozedUntil?: number // 「稍后」暂停到的时间点，早于它不再弹
  createdAt: number
}

export interface TrashItem {
  kind: 'site' | 'category'
  data: Site | Category
  deletedAt: number
}

export interface NavData {
  version: number
  categories: Category[]
  sites: Site[]
  notes: Note[]
  todos?: Todo[] // 待办提醒：随账户云同步
  trash?: TrashItem[] // 最近删除：保留 30 天，可恢复
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
