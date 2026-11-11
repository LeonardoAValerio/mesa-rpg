import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 3, // each test has its own Electron profile and port; only NET-02 uses the default port
  fullyParallel: false,
  globalSetup: './scripts/test-tmp.ts' // temp folders (profiles, campaigns) removed after the run
})
