import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview:{
    cors: true,
  },
  test: {
    // jsdom 27's bundled @asamuzakjp/css-color pulls in an ESM-only
    // @csstools/css-calc that jsdom's CJS require() can't load on this
    // Node version (ERR_REQUIRE_ESM) — happy-dom avoids that entirely and
    // is the more common Vitest pairing anyway.
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
