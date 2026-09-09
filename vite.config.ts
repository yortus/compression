import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Project-site Pages serves from /compression/; dev stays at / so the local
// workflow and hash routes are unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/compression/' : '/',
  plugins: [vue()],
}))
