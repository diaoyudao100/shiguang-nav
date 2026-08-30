import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeMode } from '../types'

interface ThemeCtx {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
}

const Ctx = createContext<ThemeCtx>({ mode: 'system', resolved: 'light', setMode: () => {} })

function apply(mode: ThemeMode): 'light' | 'dark' {
  const dark =
    mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  return dark ? 'dark' : 'light'
}

export function ThemeProvider({ children, initial }: { children: ReactNode; initial: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initial)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => apply(initial))

  useEffect(() => {
    setResolved(apply(mode))
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(apply('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const value = useMemo(
    () => ({ mode, resolved, setMode: (m: ThemeMode) => setMode(m) }),
    [mode, resolved],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  return useContext(Ctx)
}
