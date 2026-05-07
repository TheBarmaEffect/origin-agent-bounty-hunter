import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: assets must be served under /origin-agent-bounty-hunter/
// Set GH_PAGES=1 (or detect CI) to enable.
const isGhPages = process.env.GH_PAGES === '1' || process.env.GITHUB_PAGES === '1'

export default defineConfig({
  base: isGhPages ? '/origin-agent-bounty-hunter/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/paid-data': 'http://localhost:3001'
    }
  }
})
