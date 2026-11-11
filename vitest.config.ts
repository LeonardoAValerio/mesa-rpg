import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/*.test.ts'],
    environment: 'node',
    globalSetup: ['scripts/test-tmp.ts'] // temp folders removed after the run
  }
})
