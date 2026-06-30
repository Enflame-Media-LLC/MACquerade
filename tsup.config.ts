import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
  onSuccess: () => {
    // Copy the OUI data file to dist
    const srcPath = join('src', 'data', 'oui.json')
    const destDir = join('dist', 'data')
    const destPath = join(destDir, 'oui.json')
    mkdirSync(destDir, { recursive: true })
    copyFileSync(srcPath, destPath)
    console.log('Copied oui.json to dist/data/')
    return Promise.resolve()
  }
})
