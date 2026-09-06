/** Worker 入口：仅处理 /api/*，其余路径由静态资产（SPA fallback）服务 */

import {
  handleAuthConfig,
  handleLogin,
  handleLogout,
  handleMe,
  handleOAuthCallback,
  handleOAuthComplete,
  handleOAuthStart,
  handleRegister,
  handleUpdateName,
  handleUpdatePassword,
} from './auth'
import {
  handleAdminOverview,
  handleCreateInvite,
  handleDeleteInvite,
  handlePatchUser,
  handleResetPassword,
} from './admin'
import { handleGetData, handlePutData } from './data'
import { handleAiChat, handleAiModels } from './ai'
import {
  handleCategories,
  handleDeviceCheck,
  handleDeviceToken,
  handleQuickAdd,
  handleQuickNote,
  handleQuickSuggest,
  preflight,
} from './quickadd'
import { fail } from './util'
import type { Env } from './util'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    try {
      // 认证配置（公开）
      if (path === '/api/auth/config') return await handleAuthConfig(env)

      // 邮箱注册 / 登录 / 登出
      if (path === '/api/auth/register' && method === 'POST') return await handleRegister(req, env)
      if (path === '/api/auth/login' && method === 'POST') return await handleLogin(req, env)
      if (path === '/api/auth/logout' && method === 'POST') return await handleLogout()
      if (path === '/api/auth/complete' && method === 'POST') return await handleOAuthComplete(req, env)

      // OAuth
      const oauthMatch = path.match(/^\/api\/auth\/oauth\/(google|linuxdo|wechat)(\/callback)?$/)
      if (oauthMatch) {
        if (oauthMatch[2]) return await handleOAuthCallback(req, env, oauthMatch[1])
        return await handleOAuthStart(req, env, oauthMatch[1])
      }

      // 当前用户
      if (path === '/api/me' && method === 'GET') return await handleMe(req, env)
      if (path === '/api/me' && method === 'PUT') return await handleUpdateName(req, env)
      if (path === '/api/auth/password' && method === 'POST') return await handleUpdatePassword(req, env)

      // 导航数据
      if (path === '/api/data' && method === 'GET') return await handleGetData(req, env)
      if (path === '/api/data' && method === 'PUT') return await handlePutData(req, env)

      // AI 代理（同源 POST，仅转发到 https 的提供商接口）
      if (path === '/api/ai/chat' && method === 'POST') return await handleAiChat(req, env)
      if (path === '/api/ai/models' && method === 'POST') return await handleAiModels(req, env)

      // 浏览器扩展：一键收藏（Bearer 连接码或会话认证）
      if (path === '/api/device-token' && method === 'POST') return await handleDeviceToken(req, env)
      if (path === '/api/device-check' && method === 'GET') return await handleDeviceCheck(req, env)
      if (
        (path === '/api/quick-add' || path === '/api/quick-suggest' || path === '/api/quick-note' || path === '/api/categories') &&
        method === 'OPTIONS'
      ) {
        return preflight(req)
      }
      if (path === '/api/quick-add' && method === 'POST') return await handleQuickAdd(req, env)
      if (path === '/api/quick-suggest' && method === 'POST') return await handleQuickSuggest(req, env)
      if (path === '/api/quick-note' && method === 'POST') return await handleQuickNote(req, env)
      if (path === '/api/categories' && method === 'GET') return await handleCategories(req, env)

      // 管理后台
      if (path === '/api/admin/overview' && method === 'GET') return await handleAdminOverview(req, env)
      if (path === '/api/admin/invites' && method === 'POST') return await handleCreateInvite(req, env)
      const inviteMatch = path.match(/^\/api\/admin\/invites\/([A-Za-z0-9-]+)$/)
      if (inviteMatch && method === 'DELETE') return await handleDeleteInvite(req, env, inviteMatch[1])
      const resetMatch = path.match(/^\/api\/admin\/users\/([a-f0-9-]+)\/reset-password$/)
      if (resetMatch && method === 'POST') return await handleResetPassword(req, env, resetMatch[1])
      const userMatch = path.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/)
      if (userMatch && method === 'PATCH') return await handlePatchUser(req, env, userMatch[1])

      return fail('接口不存在', 404)
    } catch (e) {
      console.error('worker error:', e)
      return fail('服务器内部错误', 500)
    }
  },
}
