import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Dev server uses an uncommon port so it can sit beside other local apps.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
    open: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
    open: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
