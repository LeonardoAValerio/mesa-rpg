import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * In `electron-vite dev`, Vite injects CSS as inline <style> tags, which the strict CSP in
 * index.html blocks, leaving the app unstyled. Only the dev server gets 'unsafe-inline' styles;
 * the build links the CSS as a file and keeps the strict CSP.
 */
const devInlineStyles = (): Plugin => ({
  name: 'mesa-dev-inline-styles',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace("default-src 'self';", "default-src 'self'; style-src 'self' 'unsafe-inline';")
})

export default defineConfig({
  main: {},
  preload: {},
  renderer: { plugins: [devInlineStyles()] }
})
