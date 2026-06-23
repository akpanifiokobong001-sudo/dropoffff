import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5417,
    strictPort: true,
    open: true,
    // Forward API calls to the Express backend so the frontend can use relative /api/... paths.
    proxy: {
      '/api': {
        target: 'http://localhost:5418',
        changeOrigin: true,
      },
    },
  },
})
