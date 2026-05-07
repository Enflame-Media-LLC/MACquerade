import { defineConfig } from 'vitest/config'

export default defineConfig({
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
        '**/*.d.ts'     // Type declaration files
      ],
      thresholds: {
        lines: 40  // Core library coverage threshold
      }
    },
    // Watch mode settings
    watch: false,
    testTimeout: 20000,
    // Environment
    environment: 'node'
  }
})
