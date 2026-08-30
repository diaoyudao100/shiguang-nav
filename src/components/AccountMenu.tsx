import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { navigate } from '../lib/router'
import { avatarColor } from '../lib/favicon'
import { Field, Modal, inputCls } from './Modal'
import { useToast } from './Toast'

export function AccountMenu() {
  const { user, setUser, refresh } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [nameModal, setNameModal] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) {
    return (
      <button onClick={() => navigate('/login')} className="btn-ghost">
        登录 / 注册
      </button>
    )
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      toast('已退出登录')
      navigate('/')
    }
  }

  const saveName = async () => {
    try {
      const r = await api.updateName(name.trim())
      setUser({ ...user, name: r.user.name })
      setNameModal(false)
      toast('昵称已更新')
      refresh()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line bg-surface transition-all hover:border-line-strong"
        title={user.name}
        aria-label="账户菜单"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${avatarColor(user.name)}, color-mix(in srgb, ${avatarColor(user.name)} 62%, black))`,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-panel anim-pop absolute right-0 top-11 z-50 w-56 rounded-2xl p-1.5 shadow-pop">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-ink2">{user.email ?? (user.role === 'admin' ? '管理员' : '成员')}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          {user.role === 'admin' && (
            <MenuItem
              onClick={() => {
                setOpen(false)
                navigate('/admin')
              }}
            >
              管理后台
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setName(user.name)
              setOpen(false)
              setNameModal(true)
            }}
          >
            修改昵称
          </MenuItem>
          <MenuItem danger onClick={logout}>
            退出登录
          </MenuItem>
        </div>
      )}

      <Modal open={nameModal} title="修改昵称" onClose={() => setNameModal(false)} width="max-w-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveName()
          }}
        >
          <Field label="昵称">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setNameModal(false)} className="rounded-lg px-4 py-2 text-sm text-ink2 hover:text-ink">
              取消
            </button>
            <button type="submit" className="btn-primary">
              保存
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-hover ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      {children}
    </button>
  )
}
