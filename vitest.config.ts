import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use global test API (describe, it, expect) without imports
    globals: true,

    // Environment for testing
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/cli.ts', // CLI entry point
        'src/index.ts', // Main entry point
        'vitest.config.ts'
      ]
    },

    // Test file patterns
    include: ['src/**/*.{test,spec}.ts'],

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test'),
    }
  }
});