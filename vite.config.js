import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api'),
        secure: true,
      },
    },
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
})