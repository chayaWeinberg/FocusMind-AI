// The external-video path of FocusMind's own player, end to end.
//
// HONEST SCOPE: behind NetFree no external video host was reachable (see
// docs/catalog-library.md), so the network is SIMULATED here: Playwright
// answers requests for https://cdn.cs50.net/... with the local test video.
// Everything else is real: the catalog lessons are switched to their direct
// files with the real tool (python -m app.catalog_videos apply --mode direct),
// the browser loads the lesson's external URL in FocusMind's player, progress
// is saved and restored, and ReplayAI seeks inside that external video.
// This shows what happens once a network allows the host; it does not show
// that CS50's real file plays on this network.

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE } from '../playwright.config.js';
import { TEST_VIDEO } from './global-setup.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

const RUN = `x${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const user = { name: 'נגן חיצוני', email: `external-${RUN}@example.com` };

const media = (page) => page.getByLabel(/^נגן וידאו: /).evaluate((video) => ({
  currentTime: video.currentTime, paused: video.paused, src: video.currentSrc,
}));

test('a catalog lesson with an external direct video plays in FocusMind with progress and ReplayAI (simulated host)', async ({ page, context }) => {
  test.setTimeout(150_000);
  const output = execFileSync(python, ['-m', 'app.catalog_videos', 'apply', '--mode', 'direct'], {
    cwd: backendDir, env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE }, encoding: 'utf-8',
  });
  expect(output).toContain('algorithms-data-structures/linear-search: algorithms-data-structures/linear-search:direct');

  const video = await readFile(TEST_VIDEO);
  const served = [];
  // Behaves like a real CDN: byte ranges (206) as browsers request for media.
  await context.route('https://cdn.cs50.net/**', (route) => {
    served.push(route.request().url());
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
    if (!range) {
      return route.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'Accept-Ranges': 'bytes' }, body: video });
    }
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
    return route.fulfill({
      status: 206,
      contentType: 'video/mp4',
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${video.length}` },
      body: video.subarray(start, end + 1),
    });
  });

  await page.request.post('/api/auth/register', {
    data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
  });
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: /ברוך שובך/ })).toBeVisible();

  await page.goto('/courses/catalog');
  await page.getByRole('button', { name: 'הרשמה לקורס אלגוריתמים ומבני נתונים' }).click();
  await page.getByRole('article', { name: 'אלגוריתמים ומבני נתונים' }).getByRole('link', { name: 'אלגוריתמים ומבני נתונים' }).click();
  const row = page.locator('.lesson-row', { hasText: 'חיפוש לינארי' });
  await expect(row).toContainText('קישור לסרטון');
  await row.getByRole('link', { name: 'חיפוש לינארי', exact: true }).click();

  // FocusMind's own player loads the external file (not an embed, not a new tab).
  const player = page.getByLabel(/^נגן וידאו: /);
  await expect(player).toHaveAttribute('src', 'https://cdn.cs50.net/2017/fall/shorts/linear_search/linear_search-720p.mp4');
  await player.evaluate((element) => element.play());
  await expect.poll(async () => (await media(page)).currentTime, { timeout: 20_000 }).toBeGreaterThan(3);
  expect(served.length).toBeGreaterThan(0);
  const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
  await player.evaluate((element) => element.pause());
  expect((await (await saved).json()).positionSeconds).toBeGreaterThan(3);
  await page.reload();
  await expect(page.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeVisible({ timeout: 20_000 });

  // ReplayAI on the external video, from a controlled session (synthetic attention data).
  const lessonId = page.url().split('/').pop();
  const session = await (await page.request.post('/api/learning-sessions', { data: { lessonId } })).json();
  const segment = (seq, state, start, seconds, at) => ({
    seq, state, videoStart: start, videoEnd: start + seconds, sessionStartMs: at, sessionEndMs: at + seconds * 1000,
    playbackRate: 1, durationMs: seconds * 1000,
  });
  await page.request.post(`/api/learning-sessions/${session.id}/segments`, {
    data: { segments: [segment(0, 'ON_SCREEN', 0, 3, 0), segment(1, 'OFF_SCREEN', 3, 5, 3000), segment(2, 'ON_SCREEN', 8, 3, 8000)] },
  });
  await page.request.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 11_000, breakMs: 0 } });
  await page.reload();
  const card = page.getByRole('listitem', { name: /קטע מומלץ לחזרה 0:00–0:11/ });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /ניגון הקטע/ }).click();
  await expect.poll(async () => (await media(page)).paused, { timeout: 25_000 }).toBe(true);
  const stopped = await media(page);
  expect(stopped.currentTime).toBeGreaterThanOrEqual(10.5);
  expect(stopped.src).toContain('cdn.cs50.net');
});
