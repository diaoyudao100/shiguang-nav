import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../hooks/useStore'
import { navigate } from '../lib/router'
import { Field, inputCls } from '../components/Modal'
import { useToast } from '../components/Toast'
import { IconGoogle, IconLinuxdo, IconMail, IconWechat } from '../components/icons'

type Mode = 'login' | 'register' | 'setup' | 'oauth'

interface AuthConfig {
  providers: Record<string, boolean>
  needsSetup: boolean
}

const PROVIDERS = [
  { id: 'wechat', label: '微信', icon: IconWechat },
  { id: 'google', label: 'Google', icon: IconGoogle },
  { id: 'linuxdo', label: 'Linux.do', icon: IconLinuxdo },
] as const

export function AuthPage() {
  const { user, setUser } = useAuth()
  const { data } = useStore()
  const brand = data.settings.siteTitle?.trim() || '拾光导航'
  const toast = useToast()
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', inviteCode: '' })
  const [oauthToken, setOauthToken] = useState('')
  const [oauthProvider, setOauthProvider] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('oauth_error')
    if (err) setError(err)
    const token = params.get('oauth')
    const invite = params.get('invite')
    setForm((f) => ({ ...f, inviteCode: invite ?? f.inviteCode }))
    api
      .config()
      .then((c) => {
        setConfig(c)
        if (token) {
          setOauthToken(token)
          setMode('oauth')
          try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            setOauthProvider(payload?.reg?.provider ?? '')
            setForm((f) => ({ ...f, name: payload?.reg?.name || f.name }))
          } catch {
            /* 忽略解码失败 */
          }
        } else if (c.needsSetup) {
          setMode('setup')
        }
      })
      .catch(() => setError('无法连接服务器'))
  }, [])

  const submitEmail = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const r = await api.login({ email: form.email, password: form.password })
        setUser(r.user)
      } else if (mode === 'register') {
        const r = await api.register({
          email: form.email,
          password: form.password,
          name: form.name,
          inviteCode: form.inviteCode,
        })
        setUser(r.user)
        toast(r.user.role === 'admin' ? '管理员账户创建成功' : '注册成功')
      } else {
        const r = await api.register({ email: form.email, password: form.password, name: form.name })
        setUser(r.user)
        toast('管理员账户创建成功')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitOauthComplete = async () => {
    setError('')
    setLoading(true)
    try {
      const r = await api.completeOAuth({ token: oauthToken, inviteCode: form.inviteCode })
      setUser(r.user)
      toast('注册成功，欢迎加入')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const providerName = PROVIDERS.find((p) => p.id === oauthProvider)?.label ?? oauthProvider
  const isSetup = mode === 'setup'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* 品牌 */}
      <button onClick={() => navigate('/')} className="mb-7 flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-lg font-semibold text-white shadow-[var(--shadow-glow)]">
          <span className="drop-shadow-sm">{brand.charAt(0)}</span>
          <span className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/25" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-lg font-semibold tracking-tight">{brand}</div>
          <div className="mt-0.5 text-[10px] tracking-[0.28em] text-ink2/75">个人网址导航</div>
        </div>
      </button>

      <div className="glass-panel w-full max-w-[400px] rounded-[20px] p-6 shadow-pop">
        {oauthToken ? (
          /* OAuth 补全注册 */
          <>
            <h1 className="text-center text-[15px] font-semibold tracking-tight">完善注册信息</h1>
            <p className="mt-1.5 text-center text-xs text-ink2">
              已通过 {providerName} 验证身份，填写邀请码即可完成注册
            </p>
            <form
              className="mt-5 flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault()
                submitOauthComplete()
              }}
            >
              <Field label="邀请码">
                <input
                  autoFocus
                  className={inputCls + ' font-mono tracking-widest uppercase'}
                  placeholder="SG-XXXXXXXX"
                  value={form.inviteCode}
                  onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                />
              </Field>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? '提交中…' : '完成注册'}
              </button>
            </form>
          </>
        ) : isSetup ? (
          /* 首次初始化：创建管理员 */
          <>
            <h1 className="text-center text-[15px] font-semibold tracking-tight">初始化站点</h1>
            <p className="mt-1.5 text-center text-xs text-ink2">当前还没有任何账户，第一个注册的账户将成为管理员</p>
            <EmailForm
              mode="setup"
              form={form}
              setForm={setForm}
              error={error}
              loading={loading}
              onSubmit={submitEmail}
              submitLabel="创建管理员账户"
            />
          </>
        ) : (
          <>
            {/* 登录 / 注册切换 */}
            <div className="mx-auto mb-5 flex w-fit rounded-xl bg-base p-0.5">
              {(
                [
                  ['login', '登录'],
                  ['register', '注册'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setMode(id)
                    setError('')
                  }}
                  className={`h-8 rounded-[10px] px-5 text-xs font-medium transition-all ${
                    mode === id ? 'bg-surface text-ink shadow-sm' : 'text-ink2 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 第三方登录 */}
            <div className="grid grid-cols-3 gap-2.5">
              {PROVIDERS.map((p) => {
                const enabled = config?.providers[p.id]
                return (
                  <button
                    key={p.id}
                    disabled={!enabled}
                    title={enabled ? `使用 ${p.label} 账号${mode === 'register' ? '注册' : '登录'}` : '管理员尚未配置该登录方式'}
                    onClick={() => {
                      window.location.href = `/api/auth/oauth/${p.id}?return=/`
                    }}
                    className={`flex h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface transition-all ${
                      enabled
                        ? 'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card'
                        : 'cursor-not-allowed opacity-40'
                    }`}
                  >
                    <p.icon width={20} height={20} />
                    <span className="text-[11px] text-ink2">{p.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] text-ink2/70">
              <span className="h-px flex-1 bg-line" />
              或使用邮箱
              <span className="h-px flex-1 bg-line" />
            </div>

            <EmailForm
              mode={mode === 'oauth' ? 'login' : mode}
              form={form}
              setForm={setForm}
              error={error}
              loading={loading}
              onSubmit={submitEmail}
              submitLabel={mode === 'login' ? '登录' : '注册'}
            />
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] leading-5 text-ink2/70">
        仅限受邀使用的内部导航站
        <br />
        <button onClick={() => navigate('/')} className="transition-colors hover:text-ink">
          先逛逛 →
        </button>
      </p>
    </div>
  )
}

function EmailForm({
  mode,
  form,
  setForm,
  error,
  loading,
  onSubmit,
  submitLabel,
}: {
  mode: 'login' | 'register' | 'setup'
  form: { email: string; password: string; name: string; inviteCode: string }
  setForm: (f: { email: string; password: string; name: string; inviteCode: string }) => void
  error: string
  loading: boolean
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {mode !== 'login' && (
        <Field label="昵称" hint="选填">
          <input
            className={inputCls}
            placeholder="怎么称呼你"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      )}
      <Field label="邮箱">
        <input
          type="email"
          autoComplete="email"
          className={inputCls}
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="密码" hint={mode === 'login' ? undefined : '至少 8 位'}>
        <input
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className={inputCls}
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </Field>
      {mode === 'register' && (
        <Field label="邀请码" hint="内部站点需要邀请码">
          <input
            className={inputCls + ' font-mono tracking-widest uppercase'}
            placeholder="SG-XXXXXXXX"
            value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
          />
        </Field>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        <IconMail width={14} height={14} />
        {loading ? '请稍候…' : submitLabel}
      </button>
    </form>
  )
}
