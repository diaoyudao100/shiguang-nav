/** 认证状态上下文 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { api } from '../lib/api'

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (u: AuthUser | null) => void
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: async () => {}, setUser: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await api.me()
      setUser(r.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <Ctx.Provider value={{ user, loading, refresh, setUser }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
