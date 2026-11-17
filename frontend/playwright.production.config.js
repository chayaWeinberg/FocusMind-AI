// End-to-end journey against a running PRODUCTION build (one container
// serving the built React app and the API), e.g. the local rehearsal:
//
//   docker compose -f docker-compose.prod.yml --env-file <env> up -d --build
//   $env:PROD_BASE_URL='http://localhost:8088'; npx playwright test -c playwright.production.config.js
//
// No dev server is started. PROD_COMPOSE_PROJECT names the compose project so
// the admin test can grant the role with the real CLI inside the container.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-production',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: process.env.PROD_BASE_URL || 'http://localhost:8088',
    channel: process.env.E2E_BROWSER_CHANNEL || 'msedge',
    locale: 'he-IL',
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
    trace: 'retain-on-failure',
  },
});
