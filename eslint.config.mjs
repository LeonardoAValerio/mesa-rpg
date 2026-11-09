import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Release scripts run under plain Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } }
  },
  {
    // AD-002: core is pure TypeScript - no Node, Electron or DOM access.
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*', 'electron', 'fs', 'path', 'os', 'crypto', 'ws', 'pixi.js'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'process']
    }
  }
)
