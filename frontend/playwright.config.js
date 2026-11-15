// Real-browser end-to-end tests (Playwright).
//
// An isolated stack is started for the run, so real data is never touched:
// - backend: uvicorn on 127.0.0.1:8010 with the dedicated MongoDB database
//   `focusmind_e2e` (dropped after the run) and a temporary video folder;
// - frontend: Vite on localhost:3010, proxying /api to that backend.
// MongoDB itself must be running (docker compose up -d mongo).
//
// The browser is the installed Microsoft Edge (no browser download, works
// behind HTTPS-filtering networks). The camera is Chromium's synthetic fake
// device: it proves the attention pipeline runs in a real browser, but it
// shows no real face, so it says nothing about real-webcam accuracy.
//
// Run: npm run test:e2e

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

export const E2E_DATABASE = 'focusmind_e2e';
export const E2E_VIDEO_DIR = path.join(os.tmpdir(), 'focusmind-e2e-videos');
export const BACKEND_PORT = 8010;
export const FRONTEND_PORT = 3010;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  outputDir: './test-results/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    channel: process.env.E2E_BROWSER_CHANNEL || 'msedge',
    locale: 'he-IL',
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: backendDir,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        MONGO_DB_NAME: E2E_DATABASE,
        VIDEO_STORAGE_DIR: E2E_VIDEO_DIR,
        SEED_CATALOG: 'true',
        ENV: 'development',
        BCRYPT_ROUNDS: '4',
        MAX_VIDEO_UPLOAD_BYTES: String(50 * 1024 * 1024),
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: frontendDir,
      url: `http://localhost:${FRONTEND_PORT}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
    },
  ],
});
