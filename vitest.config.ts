import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary', 'json'],
      thresholds: {
        statements: 36,
        branches: 22,
        functions: 28,
        lines: 39,
      },
    },
  },
});
