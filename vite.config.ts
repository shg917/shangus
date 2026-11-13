import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: 'frontend',
  envDir: '..',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true },
  resolve: { dedupe: ['react', 'react-dom'] },
})
