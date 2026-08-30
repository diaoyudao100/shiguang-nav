import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // 开发时把 API 转发给 wrangler（8787），保持与部署形态一致
      '/api': 'http://localhost:8787',
    },
  },
})
