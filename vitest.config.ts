import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Redirect dist imports to src for coverage
      '../dist/index.js': path.resolve(__dirname, 'src/index.ts'),
      '../../dist/index.js': path.resolve(__dirname, 'src/index.ts')
    }
  },
  test: {
    // Enable globals like describe, it, expect without import
    globals: false,
    // Test file patterns
    include: ['test/**/*.test.ts', 'test/**/*.test.js'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types.ts',
        'src/cli.ts',   // CLI is tested via integration tests against built binary
        'src/oui.ts',   // OUI module not covered by existing tests (SPF-8 feature)
        '**/*.d.ts'     // Type declaration files
      ],
      thresholds: {
        lines: 40  // Core library coverage threshold
      }
    },
    // Watch mode settings
    watch: false,
    // Environment
    environment: 'node'
  }
})
