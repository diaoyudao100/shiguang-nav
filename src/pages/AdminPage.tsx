import { useEffect, useState } from 'react'
import { api, type AdminOverview } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { navigate } from '../lib/router'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { btnGhost, btnPrimary, inputCls, Modal } from '../components/Modal'
import { IconArrowUp, IconCopy, IconPlus, IconTrash } from '../components/icons'

const PROVIDER_LABEL: Record<string, string> = {
  wechat: '微信',
  google: 'Google',
  linuxdo: 'Linux.do',
}

function fmtTime(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts: number | null): string {
  if (!ts) return '永久'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export function AdminPage() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [resetResult, setResetResult] = useState<{ name: string; temp: string } | null>(null)
  const [newCode, setNewCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [expireDays, setExpireDays] = useState('7')
  const [maxUses, setMaxUses] = useState('1')

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [loading, user])

  const load = () => {
    api.admin
      .overview()
      .then(setOverview)
      .catch((e) => setError((e as Error).message))
  }
  useEffect(() => {
    if (user?.role === 'admin') load()
  }, [user?.role])

  const createInvite = async () => {
    setCreating(true)
    setError('')
    try {
      const r = await api.admin.createInvite({
        maxUses: Number(maxUses) || 1,
        expiresInDays: expireDays === 'never' ? null : Number(expireDays),
      })
      setNewCode(r.invite.code)
      toast('邀请码已生成')
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制')
    } catch {
      toast('复制失败，请手动选择')
    }
  }

  const patchUser = async (id: string, patch: { status?: 'active' | 'disabled'; role?: 'admin' | 'user' }) => {
    try {
      await api.admin.patchUser(id, patch)
      toast('已更新')
      load()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const genTemp = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    return [...bytes].map((b) => alphabet[b % alphabet.length]).join('') + 'Aa1'
  }

  const resetPassword = async (id: string, name: string) => {
    const ok = await confirm({
      danger: true,
      title: '重置密码',
      message: (
        <>
          确定重置 <span className="font-medium text-ink">{name}</span> 的密码吗？
          <br />
          将生成随机临时密码，请复制后告知对方。
        </>
      ),
      okText: '重置',
    })
    if (!ok) return
    try {
      const temp = genTemp()
      await api.admin.resetPassword(id, temp)
      setResetResult({ name, temp })
      toast('密码已重置')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-ink2">加载中…</div>

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-lg font-semibold">需要管理员权限</h1>
        <p className="text-sm text-ink2">当前账户无权访问管理后台</p>
        <button onClick={() => navigate('/')} className="btn-ghost mt-2">
          返回导航
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 头部 */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="btn-ghost" title="返回导航">
          <IconArrowUp width={14} height={14} className="-rotate-90" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">管理后台</h1>
          <p className="text-xs text-ink2">邀请码与用户管理 · 仅管理员可见</p>
        </div>
      </div>

      {/* 概览 */}
      <div className="mb-6 grid grid-cols-3 gap-3.5">
        {[
          ['用户总数', overview?.stats.users],
          ['可用邀请码', overview?.stats.activeInvites],
          ['你的身份', '管理员'],
        ].map(([label, value]) => (
          <div key={label as string} className="card p-4">
            <div className="text-xl font-semibold tabular-nums">{value as string | number}</div>
            <div className="mt-0.5 text-[11px] text-ink2">{label as string}</div>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl bg-danger/10 px-4 py-2.5 text-xs text-danger">{error}</p>}

      {/* 邀请码 */}
      <section className="card mb-5 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">邀请码</h2>
          <span className="text-xs text-ink2">注册（含第三方登录）均需邀请码</span>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1.5 text-xs text-ink2">
            有效期
            <select className={inputCls + ' w-32'} value={expireDays} onChange={(e) => setExpireDays(e.target.value)}>
              <option value="1">1 天</option>
              <option value="7">7 天</option>
              <option value="30">30 天</option>
              <option value="never">永久</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-ink2">
            可用次数
            <select className={inputCls + ' w-32'} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              <option value="1">1 次</option>
              <option value="5">5 次</option>
              <option value="10">10 次</option>
            </select>
          </label>
          <button onClick={createInvite} disabled={creating} className="btn-primary h-[42px]">
            <IconPlus width={14} height={14} /> {creating ? '生成中…' : '生成邀请码'}
          </button>
        </div>

        {newCode && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-accent-soft px-4 py-3">
            <span className="font-mono text-base font-semibold tracking-[0.2em] text-accent">{newCode}</span>
            <button onClick={() => copy(newCode)} className="btn-ghost ms-auto !px-3 !py-1.5 text-xs">
              <IconCopy width={13} height={13} /> 复制
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-col">
          {overview?.invites.length === 0 && (
            <p className="py-6 text-center text-xs text-ink2">还没有邀请码，生成一个分享给小伙伴吧</p>
          )}
          {overview?.invites.map((inv) => {
            const usedUp = inv.used_count >= inv.max_uses
            const expired = !!inv.expires_at && inv.expires_at < Date.now()
            const status = expired ? '已过期' : usedUp ? '已用完' : '可用'
            return (
              <div
                key={inv.code}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-2.5 text-xs first:border-t-0"
              >
                <span className="font-mono text-[13px] font-medium tracking-wider">{inv.code}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    status === '可用' ? 'bg-accent-soft text-accent' : 'bg-hover text-ink2'
                  }`}
                >
                  {status}
                </span>
                <span className="text-ink2">
                  已用 {inv.used_count}/{inv.max_uses}
                </span>
                <span className="text-ink2">有效期至 {fmtDate(inv.expires_at)}</span>
                <span className="text-ink2/70">创建于 {fmtTime(inv.created_at)}</span>
                <span className="ml-auto flex gap-1">
                  <button onClick={() => copy(inv.code)} className="rounded-md p-1.5 text-ink2 transition-colors hover:bg-hover hover:text-ink" title="复制">
                    <IconCopy width={13} height={13} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        danger: true,
                        title: '删除邀请码',
                        message: (
                          <>
                            确定删除邀请码 <span className="font-mono font-medium text-ink">{inv.code}</span> 吗？
                          </>
                        ),
                        okText: '删除',
                      })
                      if (!ok) return
                      await api.admin.deleteInvite(inv.code)
                      toast('已删除')
                      load()
                    }}
                    className="rounded-md p-1.5 text-ink2 transition-colors hover:bg-hover hover:text-danger"
                    title="删除"
                  >
                    <IconTrash width={13} height={13} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 用户 */}
      <section className="card p-5">
        <h2 className="mb-4 text-[15px] font-semibold tracking-tight">用户（{overview?.users.length ?? 0}）</h2>
        <div className="flex flex-col">
          {overview?.users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent2))' }}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{u.name}</span>
                  {u.id === user.id && <span className="rounded bg-accent-soft px-1.5 text-[10px] text-accent">我</span>}
                </div>
                <div className="truncate text-[11px] text-ink2">{u.email ?? '未绑定邮箱'}</div>
              </div>
              <div className="flex gap-1">
                {u.providers.length > 0 ? (
                  u.providers.map((p) => (
                    <span key={p} className="rounded-full bg-hover px-2 py-0.5 text-[10px] text-ink2">
                      {PROVIDER_LABEL[p] ?? p}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-hover px-2 py-0.5 text-[10px] text-ink2">邮箱</span>
                )}
              </div>
              <span className="text-[11px] text-ink2">
                {u.role === 'admin' ? '管理员' : '成员'} · 最近活跃 {fmtTime(u.lastLoginAt)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  u.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-danger/10 text-danger'
                }`}
              >
                {u.status === 'active' ? '正常' : '已禁用'}
              </span>
              <span className="ml-auto flex gap-1.5">
                {u.id !== user.id && (
                  <>
                    <button onClick={() => patchUser(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })} className="btn-ghost !px-3 !py-1 text-xs">
                      {u.status === 'active' ? '禁用' : '启用'}
                    </button>
                    <button
                      onClick={() => patchUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                      className="btn-ghost !px-3 !py-1 text-xs"
                    >
                      {u.role === 'admin' ? '取消管理' : '设为管理'}
                    </button>
                  </>
                )}
                {u.email && (
                  <button onClick={() => resetPassword(u.id, u.name)} className="btn-ghost !px-3 !py-1 text-xs">
                    重置密码
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-ink2/70">邀请码注册链接：{location.origin}/login?invite=邀请码</p>

      {/* 临时密码展示 */}
      <Modal open={!!resetResult} title="密码已重置" onClose={() => setResetResult(null)} width="max-w-xs">
        {resetResult && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs leading-5 text-ink2">
              已为 <span className="font-medium text-ink">{resetResult.name}</span> 重置密码，请复制临时密码告知对方，登录后可在账户菜单自行修改：
            </p>
            <div className="rounded-xl border border-line bg-base px-3 py-2.5 text-center font-mono text-base font-semibold tracking-wider text-ink">
              {resetResult.temp}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(resetResult.temp)
                  toast('临时密码已复制')
                }}
                className="btn-ghost h-9 px-4 text-xs"
              >
                <IconCopy width={13} height={13} /> 复制
              </button>
              <button type="button" onClick={() => setResetResult(null)} className="btn-primary h-9 px-4 text-xs">
                完成
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
