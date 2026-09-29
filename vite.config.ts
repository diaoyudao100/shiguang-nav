import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // 开发时把 API 转发给 wrangler。本机 8787 落在 Windows 保留端口段（8772-8871，
      // wrangler 绑定报 #10013），因此本地后端固定用 8900：npx wrangler dev --port 8900
      '/api': 'http://localhost:8900',
    },
  },
})
