import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port & target proxy bisa di-override lewat env supaya beberapa instance
// bisa jalan berdampingan di satu server (lihat scripts/run-instance.mjs).
const vitePort = Number(process.env.ORKAY_VITE_PORT) || 5173
const apiTarget = process.env.ORKAY_API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: vitePort,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
