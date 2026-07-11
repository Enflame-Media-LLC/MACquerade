import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
// Side-effect type import: augments Vite's UserConfig with `ssgOptions`.
import 'vite-ssg'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    dirStyle: 'nested',
  },
})
