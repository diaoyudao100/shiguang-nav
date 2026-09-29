# 拾光导航 · 多用户个人网址导航

参考 [元启导航 (ggffnet.ggff.net)](https://ggffnet.ggff.net) 功能对齐实现的**多用户**网址导航站，部署在 **Cloudflare Workers + D1** 上，内置账户系统与邀请码注册，每个用户拥有独立、隔离的导航数据。

## ✨ 功能

### 导航核心
- 时钟问候、每日一言、站内/站外双模式搜索（⌘K 聚焦）、必应/Google/百度/DuckDuckGo/GitHub 切换
- 网站/分类管理、拖拽排序（跨分类、拖到侧栏即移动）、置顶
- 浏览器书签 HTML 导入/导出、JSON 备份导入/导出（合并/替换）
- 主题：浅色 / 深色 / 跟随系统；精致玻璃拟态 + 极光渐变视觉

### 便签随记 · 回收站 · 体验增强（v2.2–v2.4 新增）
- **便签随记**：账户菜单打开，双栏布局（左列表 / 右编辑·预览），标题 + 正文打字即存、云端同步、置顶、搜索与只看置顶过滤；空白未写完的便签自动清理
- **回收站**：删除的站点 / 分类保留 30 天，可一键恢复或彻底删除（过期自动清除）
- **卡片显示开关**：可隐藏网址让名称垂直居中；**网格密度** 4 / 6 / 8 列可调；**分类目录可折叠**为图标条
- **智能常用**：置顶区自动加入点击最多的站点（点击数据仅存本机，不上传）
- **站内搜索覆盖便签**：搜索结果同时命中便签标题与内容，点击直达
- **PWA**：可安装到桌面 / 手机主屏，静态资源缓存、离线打开壳页面
- **新手引导**：首次使用显示三步上手清单（导入书签 / 装扩展 / 配 AI）
- **问候语**：按时间段显示「早上好 / 下午好…」，昵称可在设置里自定义

### 视觉质感（v2.5 新增）
- **单色图标**：卡片 favicon 一键转灰阶，PC 悬浮时恢复彩色——解决第三方图标五颜六色、质量参差的视觉噪音（触屏保持单色）
- **卡片入场动画**：页面加载 / 切换分类时卡片按序淡入上浮（系统「减弱动态效果」下自动关闭）
- **背景细噪点**：渐变底色上叠加极淡的 grain 纹理，消除"塑料感"，暗色模式更显质感
- **移动端适配**：弹窗按移动浏览器真实可视高度（dvh）自适应，关闭 / 保存在小屏上恒定可见；触摸不再唤出卡片悬浮齿轮，改为**长按卡片**编辑（含震动反馈与防误触）

### AI 工作台（v2.9 新增）
- **万能框（Q 或 Ctrl/Cmd+K）**：一个框搞定 搜收藏 / 开网站 / 一句话加待办（AI 识别时间）/ 直接问 AI（回答可复制）
- **待办自然语言解析**：待办弹窗点 ✨ 按钮，"下周五下午3点复诊"自动填充标题与到期时间，确认后添加
- **便签划词 AI**：正文选中文字后 润色 / 总结 / 翻译 / 续写，结果写回原文（走你自配的 AI 通道，Key 不出后端）

### 省心细节（v2.6 新增）
- **待办提醒（v2.8）**：顶栏铃铛管理待办（标题 + 到期时间 + 备注 + 重复），到期前 N 天开始每天提醒（天数可选 1/3/7/15，默认 7），多条到期在顶部红色提醒条中堆叠展示（完成 / 稍后 5 分钟 / 关闭），弹出时可选提示音、标签页标题闪烁；页面在后台可加弹系统通知（需授权，可关），错过即时提醒的下次打开自动补提，展示期间静默拉取云端避免多设备重复弹；支持循环待办：每天 / 每周 / 每 N 天（1-365 自定义，如 34/61/90/365 天，完成后自动滚动下一周期）、便签一键转待办、快捷键 N 新建、铃铛悬停预览、一键清空已完成；数据随账户云同步
- **全站下拉美化（v2.7）**：7 处原生下拉替换为统一的毛玻璃弹层（键盘可达、上下翻转、选项带图标），消灭系统灰框
- **手机端排序**：编辑弹窗内置「前移 / 后移」，触屏也能调整卡片顺序（与拖拽排序同序）
- **PC 右键菜单**：卡片右键直达 打开 / 编辑 / 置顶 / 隐藏 / 删除（删除进回收站可恢复）
- **回收站批量操作**：全部恢复 / 清空回收站（清空需二次确认）
- **便签移动端**：列表 ↔ 编辑器单屏切换，左上角返回
- **OLED 纯黑**：深色模式下背景压到纯黑，更护眼省电（外观页开关）
- **视觉细节**：卡片入场按序淡入、空状态轻插画、列表底部渐隐、顶栏滚动加深投影、主包拆分按需加载

### 账户系统（v2.0 新增）
- **四种注册/登录方式**：微信扫码（开放平台网站应用）、Google、Linux.do Connect、邮箱 + 密码
- **邀请码注册**：所有注册方式均需邀请码；管理员在后台生成（可设有效期与可用次数），防重用、防过期
- **首次部署初始化**：第一个注册的账户自动成为管理员（之后注册一律需要邀请码）
- **管理后台** `/admin`：生成/删除邀请码、用户列表、启用/禁用、设为管理员、重置密码
- **云端同步**：每用户数据存 D1（`user_data` 表按用户隔离），本地改动防抖 2.5s 推送、登录时自动拉取、关页面前 sendBeacon 兜底；未登录仍可纯本地使用，同一浏览器按账户隔离本地缓存
- 会话为 HttpOnly Cookie + HS256 JWT（30 天），密码 PBKDF2-SHA256 哈希，写操作校验 SameSite/Origin

### AI 助手
- 支持 **OpenAI Compatible / Gemini** 提供商：BASE URL 留空或只填域名即自动补全版本段，可一键测试连接、从提供商**拉取模型列表**选择
- 添加链接时 **AI 一键生成简介**；设置里可**批量补全**所有缺失描述
- AI 请求经 Worker 同源代理转发（Key 仅透传不落库，不受浏览器跨域限制）；所选模型不被提供商支持时**自动拉模型列表换用轻量对话模型重试并回写**，推理模型的 `<think>` / reasoning_content 均做了兼容

### 浏览器扩展 · 一键收藏（v2.1 新增）
在任意网页**一键收藏到导航站**：点扩展图标、按 `Alt+S` 或右键菜单，会弹出**确认小窗**——

- **确认窗**：自动读取导航站全部分类做下拉框（可自选）；同时请求 AI 推荐分类与一句简介并预选（未配置/失败时可手动填写，留空则服务端兜底）；确认后才入库，不会静默添加
- **服务端链路**：标题/简介/分类可由确认窗回传（省一次 AI 调用）→ 去重（忽略大小写与结尾斜杠）→ AI 未覆盖时服务端抓取页面 `<title>` / meta description 兜底 → 图标按域名自动获取
- **v1.3**：网页上**选中文字右键 → 存入便签随记**（划词直达便签，无需弹窗）；收藏确认窗新增「↩ 上次分类」快捷按钮，连续收藏同类网站更顺手
- **无需保持导航站打开**：扩展与后端通过「连接码」（`设置 → 数据 → 浏览器扩展` 里生成，**可自定义（≥8 位、易记）或系统随机**，服务端只存 SHA-256 指纹）通信，`Authorization: Bearer` 认证；时长可选 1 / 5 / 10 / 20 年或长期，再次生成即作废旧码；已登录的浏览器甚至无需连接码（会话 Cookie 自动认证）；站点地址可在扩展选项里更改

安装（免上架，本地加载）：
1. 打开 `chrome://extensions`（Edge / Comet 等 Chromium 内核同理）→ 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本项目的 `extension/` 目录
3. 打开扩展「选项」→ 确认站点地址、粘贴连接码 → 保存，点「测试连接」验证

扩展换域名 / 打包 zip / 上架 Chrome 商店（含可粘贴的商品文案）见 [extension/README.md](extension/README.md)；扩展代码更新后需在 `chrome://extensions` 点刷新（或重启浏览器）重新加载。

## 🚀 部署到 Cloudflare

```bash
npm install

# 1. 创建 D1 数据库，把输出的 database_id 填入 wrangler.jsonc
npx wrangler d1 create shiguang-nav

# 2. 初始化远程数据库表结构
npm run cf:db:init

# 2b. 老库升级（2026-08-30 前建过表的执行一次；新库跳过）
npx wrangler d1 execute shiguang-nav --remote --command "ALTER TABLE users ADD COLUMN device_token_ver INTEGER NOT NULL DEFAULT 0; ALTER TABLE users ADD COLUMN device_code_hash TEXT; ALTER TABLE users ADD COLUMN device_code_expires_at INTEGER; CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device_code_hash ON users(device_code_hash);"

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
├── worker/          # Cloudflare Worker：index(路由) auth(会话/OAuth/连接码认证)
│                    # oauth(提供商) admin(后台) data(同步) ai(AI代理+模型自动纠正)
│                    # quickadd(一键收藏/连接码) crypto(JWT/PBKDF2/码指纹) util
├── extension/       # 浏览器扩展（MV3）：确认收藏窗 + 选项页，见 extension/README.md
├── schema.sql       # D1 表结构：users / oauth_identities / invite_codes / user_data
├── src/
│   ├── pages/       # AuthPage(登录注册) AdminPage(管理后台)
│   ├── hooks/       # useStore(状态+同步) useAuth useTheme
│   ├── lib/         # api storage bookmarks(书签导入导出) search favicon ai quotes router
│   └── components/  # Header Sidebar Hero Sections SiteCard AccountMenu 各弹窗
├── wrangler.jsonc
└── scripts/         # 书签解析单测 / mock LLM(测试AI链路) / 扩展图标生成
```

## 🔐 安全说明

- 仅供内部小范围使用：邀请码是唯一准入门槛，请勿用于公开服务
- 扩展连接码只存 SHA-256 指纹（掺站点密钥），明码不落库；支持自定义或随机，随时重新生成作废。自定义码强度由自己负责（≥8 位，建议用别人猜不到的短语）
- AI KEY 仅在请求中透传给提供商，不写入数据库；页面数据仅存你自己的 D1 与浏览器本地
- 密码哈希迭代次数为兼容 Workers 免费版 10ms CPU 限制设为 12,000，付费版可调高（`worker/crypto.ts`）
- 同一浏览器多账户共享 localStorage 空间，本应用已按账户隔离本地缓存，但对隐私要求高时建议不同账户使用不同浏览器配置

## 自动部署

推送到 main 分支后，Cloudflare Workers Builds 会自动构建并部署（构建命令 `npm run build`，部署命令 `npx wrangler deploy`）。
