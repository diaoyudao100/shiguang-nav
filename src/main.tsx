import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StoreProvider } from './hooks/useStore'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <StoreProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </StoreProvider>
    </AuthProvider>
  </React.StrictMode>,
)

// PWA：生产环境注册 Service Worker（离线壳 + 静态资源缓存）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 注册失败不影响使用 */
    })
  })
}
