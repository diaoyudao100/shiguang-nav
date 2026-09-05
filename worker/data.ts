/** 每用户导航数据：读取 / 保存（按会话用户隔离） */
import type { NavData } from '../src/types'
import { requireUser } from './auth'
import type { Env } from './util'
import { fail, json, readJson, sameOrigin } from './util'

export async function handleGetData(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env)
  if (user instanceof Response) return user
  const row = await env.DB
    .prepare('SELECT data, updated_at FROM user_data WHERE user_id = ?')
    .bind(user.id)
    .first<{ data: string; updated_at: number }>()
  if (!row) return json({ data: null, updatedAt: null })
  try {
    return json({ data: JSON.parse(row.data) as NavData, updatedAt: row.updated_at })
  } catch {
    return json({ data: null, updatedAt: null })
  }
}

export async function handlePutData(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env)
  if (user instanceof Response) return user
  if (!sameOrigin(req, env)) return fail('非法来源', 403)
  const body = await readJson<{ data?: NavData }>(req)
  if (!body?.data || !Array.isArray(body.data.categories) || !Array.isArray(body.data.sites)) {
    return fail('数据格式不正确')
  }
  const now = Date.now()
  await env.DB
    .prepare(
      `INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(user.id, JSON.stringify(body.data), now)
    .run()
  return json({ updatedAt: now })
}
