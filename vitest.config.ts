import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for pure helpers (GST, statements, bank statement matching…).
// Run with `npm test`; CI runs them on every pull request.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Dates in the app are Indian calendar days
    env: { TZ: 'Asia/Kolkata' },
  },
})
