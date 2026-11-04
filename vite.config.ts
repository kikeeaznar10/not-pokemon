/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * Vite + Vitest configuration.
 * - `base: './'` keeps the build relocatable on any static host (M15 may set a sub-path).
 * - Vitest only runs unit tests under `tests/`; Playwright specs in `tests/e2e/` are excluded.
 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Phaser alone is ~1.5 MB minified; silence the default 500 kB warning.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/logic/**/*.ts', 'src/core/**/*.ts', 'src/i18n/**/*.ts'],
    },
  },
});
