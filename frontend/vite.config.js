import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The browser always calls the API on the same origin (/api/...). In
// development Vite forwards those requests to the FastAPI backend, which keeps
// the session cookie first-party and removes the need for CORS.
// Override the target with VITE_API_PROXY_TARGET (Docker uses http://backend:8000).
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    // Local only by default (the camera page should not be exposed to the LAN).
    // Docker passes --host 0.0.0.0 explicitly.
    host: 'localhost',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
});
