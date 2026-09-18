import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api/* to the main Spring backend on :8080.
// Analysis-only calls use /analysis-api/* and proxy to :8082.
// This keeps the browser talking to Vite only, so there are no CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/analysis-api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/analysis-api/, '/api'),
      },
    },
  },
})
