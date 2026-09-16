import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const API_TARGET = process.env.GHDASH_DEV_API ?? 'http://127.0.0.1:4270'

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/web', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 4271,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
})
