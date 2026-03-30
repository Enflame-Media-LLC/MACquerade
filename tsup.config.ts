import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node24',
  splitting: false,
  shims: false,
  onSuccess: async () => {
    // Copy the OUI data file to dist
    const srcPath = join('src', 'data', 'oui.json')
    const destDir = join('dist', 'data')
    const destPath = join(destDir, 'oui.json')
    mkdirSync(destDir, { recursive: true })
    copyFileSync(srcPath, destPath)
    console.log('Copied oui.json to dist/data/')
  }
})
