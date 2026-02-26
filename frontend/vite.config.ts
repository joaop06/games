import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendPort = parseInt(process.env.FRONTEND_PORT ?? '5173', 10)
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
  : undefined
// Sempre permitir localhost para acesso local; hosts adicionais vêm de ALLOWED_HOSTS (ex.: túnel)
const serverAllowedHosts =
  allowedHosts?.length
    ? ['localhost', '127.0.0.1', ...allowedHosts]
    : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    host: true,
    ...(serverAllowedHosts ? { allowedHosts: serverAllowedHosts } : {}),
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        ws: true,
      },
      '/health': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
