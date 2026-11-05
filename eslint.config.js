// ESLint flat config (ESLint 9+). Replaces the plan's `.eslintrc.cjs`; see docs/PROGRESS.md M0.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-*/',
      'coverage/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'public/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Only src/core/log.ts may touch the console.
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/log.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // src/logic/ must stay engine-free so it can be unit-tested without a browser.
    files: ['src/logic/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: 'src/logic/ must not import Phaser.' }] },
      ],
    },
  },
  prettier,
);
