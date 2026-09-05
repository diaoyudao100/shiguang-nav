import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../hooks/useStore'
import { navigate } from '../lib/router'
import { Field, inputCls } from '../components/Modal'
import { BrandLogo } from '../components/BrandLogo'
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* 场景光晕：柔和的主题色氛围 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-[18%] h-[440px] w-[440px] rounded-full bg-accent/15 blur-[130px] dark:bg-accent/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 right-[8%] h-[400px] w-[400px] rounded-full bg-accent2/15 blur-[120px] dark:bg-accent2/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[14%] left-[6%] h-[280px] w-[280px] rounded-full bg-sky-500/10 blur-[110px] dark:bg-sky-400/15"
      />

      {/* 品牌 */}
      <button onClick={() => navigate('/')} className="relative mb-8 flex items-center gap-3">
        <BrandLogo boxCls="h-12 w-12 rounded-[15px] shadow-[var(--shadow-glow)]" letterCls="text-xl" title={brand} />
        <div className="text-left leading-tight">
          <div className="text-xl font-semibold tracking-tight">{brand}</div>
          <div className="mt-1 text-[10px] tracking-[0.3em] text-ink2/70">个人网址导航</div>
        </div>
      </button>

      <div className="modal-card relative w-full max-w-[400px] rounded-[24px] p-7">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            {oauthToken ? '完善注册信息' : isSetup ? '初始化站点' : mode === 'login' ? '欢迎回来' : '创建账户'}
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-ink2">
            {oauthToken
              ? `已通过 ${providerName} 验证身份，填写邀请码即可完成注册`
              : isSetup
                ? '当前还没有任何账户，第一个注册的账户将成为管理员'
                : mode === 'login'
                  ? '登录后数据将实时同步到云端'
                  : '注册账户，多端数据实时同步'}
          </p>
        </div>
        {oauthToken ? (
          /* OAuth 补全注册 */
          <>
            <form
              className="flex flex-col gap-3.5"
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
              <button type="submit" className="btn-primary h-11 w-full text-sm" disabled={loading}>
                {loading ? '提交中…' : '完成注册'}
              </button>
            </form>
          </>
        ) : isSetup ? (
          /* 首次初始化：创建管理员 */
          <EmailForm
            mode="setup"
            form={form}
            setForm={setForm}
            error={error}
            loading={loading}
            onSubmit={submitEmail}
            submitLabel="创建管理员账户"
          />
        ) : (
          <>
            {/* 登录 / 注册切换 */}
            <div className="mx-auto mb-6 flex w-fit gap-1 rounded-full border border-line bg-base/60 p-1 shadow-sm">
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
                  className={`h-9 rounded-full px-6 text-xs font-medium transition-all ${
                    mode === id
                      ? 'bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent2)] text-white shadow-[0_2px_10px_-2px_color-mix(in_srgb,var(--c-accent)_60%,transparent)]'
                      : 'text-ink2 hover:text-ink'
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
                    className={`flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface transition-all ${
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

            <div className="my-6 flex items-center gap-3 text-[11px] text-ink2/70">
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

      <p className="relative mt-6 text-center text-[11px] text-ink2/60">
        仅限受邀使用的内部导航站 ·{' '}
        <button onClick={() => navigate('/')} className="font-medium text-accent transition-opacity hover:opacity-75">
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
      <button type="submit" className="btn-primary h-11 w-full text-sm" disabled={loading}>
        <IconMail width={14} height={14} />
        {loading ? '请稍候…' : submitLabel}
      </button>
    </form>
  )
}
