import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// Self-contained single-file build for the hosted demo:
// all JS/CSS/fonts inlined; images come from src/shared/assetData.ts (data URIs).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base: './',
  build: {
    outDir: 'dist-demo',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 20_000,
  },
})
