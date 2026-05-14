import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Node 19+ exposes the Web Crypto API on globalThis.crypto, so geomHash's
    // crypto.subtle.digest('SHA-256', ...) works without polyfills.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/_viewer/**', 'node_modules/**', '.next/**'],
  },
})
