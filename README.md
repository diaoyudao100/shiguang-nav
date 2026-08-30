# 拾光导航 · 多用户个人网址导航

参考 [元启导航 (ggffnet.ggff.net)](https://ggffnet.ggff.net) 功能对齐实现的**多用户**网址导航站，部署在 **Cloudflare Workers + D1** 上，内置账户系统与邀请码注册，每个用户拥有独立、隔离的导航数据。

## ✨ 功能

### 导航核心
- 时钟问候、每日一言、站内/站外双模式搜索（⌘K 聚焦）、必应/Google/百度/DuckDuckGo/GitHub 切换
- 网站/分类管理、拖拽排序（跨分类、拖到侧栏即移动）、置顶
- 浏览器书签 HTML 导入/导出、JSON 备份导入/导出（合并/替换）
- 主题：浅色 / 深色 / 跟随系统；精致玻璃拟态 + 极光渐变视觉

### 账户系统（v2.0 新增）
- **四种注册/登录方式**：微信扫码（开放平台网站应用）、Google、Linux.do Connect、邮箱 + 密码
- **邀请码注册**：所有注册方式均需邀请码；管理员在后台生成（可设有效期与可用次数），防重用、防过期
- **首次部署初始化**：第一个注册的账户自动成为管理员（之后注册一律需要邀请码）
- **管理后台** `/admin`：生成/删除邀请码、用户列表、启用/禁用、设为管理员、重置密码
- **云端同步**：每用户数据存 D1（`user_data` 表按用户隔离），本地改动防抖 2.5s 推送、登录时自动拉取、关页面前 sendBeacon 兜底；未登录仍可纯本地使用，同一浏览器按账户隔离本地缓存
- 会话为 HttpOnly Cookie + HS256 JWT（30 天），密码 PBKDF2-SHA256 哈希，写操作校验 SameSite/Origin

### 浏览器扩展 · 一键收藏（v2.1 新增）
在任意网页**一键收藏到导航站**：点扩展图标、按 `Alt+S` 或右键菜单，整条链路自动完成——

- **自动补全**：带上页面标题 → 服务端去重（忽略大小写与结尾斜杠）→ 服务端抓取页面 `<title>` / meta description 兜底 → 用你配置的 AI 生成一句简介（复用模型自动纠正并回写）→ 图标按域名自动获取
- **无需保持导航站打开**：扩展与后端通过「连接码」（`设置 → 数据 → 浏览器扩展` 里生成的一年期设备令牌，`Authorization: Bearer`）通信，站点地址可在扩展选项里更改
- **离线暂存**：未连接 / 断网时自动暂存在扩展本地并显示角标，连接恢复后自动补传；重复 URL 提示已存在、不重复添加

安装（免上架，本地加载）：
1. 打开 `chrome://extensions`（Edge / Comet 等 Chromium 内核同理）→ 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本项目的 `extension/` 目录
3. 打开扩展「选项」→ 确认站点地址、粘贴连接码 → 保存，点「测试连接」验证

## 🚀 部署到 Cloudflare

```bash
npm install

# 1. 创建 D1 数据库，把输出的 database_id 填入 wrangler.jsonc
npx wrangler d1 create shiguang-nav

# 2. 初始化远程数据库表结构
npm run cf:db:init

# 3. 配置会话密钥（必填）
npx wrangler secret put JWT_SECRET   # 输入一串长随机字符

# 4. 构建并部署（前端 dist + Worker API 一起发布）
npm run deploy
```

部署完成后**立即访问 `/login` 注册第一个账户**（自动成为管理员），再在 `/admin` 生成邀请码邀请其他人。

### 登录方式配置（可选，不配置则按钮置灰）

| 方式 | 去哪申请 | 回调地址 |
|---|---|---|
| Google | [console.cloud.google.com](https://console.cloud.google.com) → 凭据 → OAuth 客户端 | `https://你的域名/api/auth/oauth/google/callback` |
| Linux.do | [connect.linux.do](https://connect.linux.do) 应用设置 | `https://你的域名/api/auth/oauth/linuxdo/callback` |
| 微信 | [open.weixin.qq.com](https://open.weixin.qq.com) 「网站应用」（需企业资质） | 授权域名设为你的域名（扫码页回跳 `/api/auth/oauth/wechat/callback`） |

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put LINUXDO_CLIENT_ID
npx wrangler secret put LINUXDO_CLIENT_SECRET
npx wrangler secret put WECHAT_CLIENT_ID
npx wrangler secret put WECHAT_CLIENT_SECRET
```

## 💻 本地开发

```bash
npm run dev                 # 仅前端（纯本地模式，无账户）
npm run cf:db:init:local    # 初始化本地 D1（首次）
cp .dev.vars.example .dev.vars  # 本地密钥
npm run cf:dev              # 构建并启动 Worker（http://localhost:8787，含账户系统）
```

## 🧱 技术栈

前端 Vite + React 18 + TypeScript + Tailwind CSS v4；后端 Cloudflare Workers（零依赖路由）+ D1 + 静态资产托管；认证为自实现 JWT 会话 + OAuth2 授权码流程 + PBKDF2 密码哈希。

## 📁 结构

```
├── worker/          # Cloudflare Worker：index(路由) auth(会话/OAuth) oauth(提供商)
│                    # admin(后台) data(同步) crypto(JWT/PBKDF2) util
├── schema.sql       # D1 表结构：users / oauth_identities / invite_codes / user_data
├── src/
│   ├── pages/       # AuthPage(登录注册) AdminPage(管理后台)
│   ├── hooks/       # useStore(状态+同步) useAuth useTheme
│   ├── lib/         # api storage bookmarks(书签导入导出) search favicon ai quotes router
│   └── components/  # Header Sidebar Hero Sections SiteCard AccountMenu 各弹窗
├── wrangler.jsonc
└── scripts/         # 书签解析单测
```

## 🔐 安全说明

- 仅供内部小范围使用：邀请码是唯一准入门槛，请勿用于公开服务
- 密码哈希迭代次数为兼容 Workers 免费版 10ms CPU 限制设为 12,000，付费版可调高（`worker/crypto.ts`）
- 同一浏览器多账户共享 localStorage 空间，本应用已按账户隔离本地缓存，但对隐私要求高时建议不同账户使用不同浏览器配置

## 自动部署

推送到 main 分支后，Cloudflare Workers Builds 会自动构建并部署（构建命令 `npm run build`，部署命令 `npx wrangler deploy`）。
