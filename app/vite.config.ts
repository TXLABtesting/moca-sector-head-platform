import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
// The demo is hosted as a GitHub Pages *project* site, served from
// https://<owner>.github.io/moca-sector-head-platform/ — hence the base path.
// Override with VITE_BASE (e.g. "/" for local root serving) when needed.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/moca-sector-head-platform/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5180, host: true },
})
