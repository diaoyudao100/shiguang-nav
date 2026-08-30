import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
}

const Ctx = createContext<{ toast: (text: string) => void }>({ toast: () => {} })

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback((text: string) => {
    const id = nextId++
    setItems((arr) => [...arr, { id, text }])
    setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), 2400)
  }, [])
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="anim-pop glass-panel flex items-center gap-2 rounded-full px-4 py-2 text-[13px] text-ink shadow-pop"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-b from-[var(--c-accent)] to-[var(--c-accent2)]" />
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx).toast
}
