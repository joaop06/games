import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendPort = parseInt(process.env.FRONTEND_PORT ?? '5173', 10)
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    host: true,
    ...(allowedHosts?.length ? { allowedHosts } : {}),
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
