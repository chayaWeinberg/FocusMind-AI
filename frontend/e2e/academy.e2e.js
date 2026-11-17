// FocusMind Academy end to end: real, original instructional lessons
// (backend/demo_assets, ~3 minutes each) installed with the real CLI and
// played inside FocusMind, with saved progress, the attention monitor and an
// exact ReplayAI replay. Camera: Chromium's synthetic device; the ReplayAI
// input is a controlled session. Neither measures real-webcam accuracy.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE, E2E_VIDEO_DIR } from '../playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const assetsDir = path.join(backendDir, 'demo_assets');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');
const backendEnv = { ...process.env, MONGO_DB_NAME: E2E_DATABASE, VIDEO_STORAGE_DIR: E2E_VIDEO_DIR };

const RUN = `a${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const learner = { name: 'לומד אקדמיה', email: `academy-${RUN}@example.com` };
const ACADEMY = ['Python בפועל', 'JavaScript לדפדפן', 'SQL לניתוח נתונים', 'אלגוריתמים בפועל', 'Docker למפתחים'];

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(learner.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${learner.name}`) })).toBeVisible();
}

const media = (page) => page.getByLabel(/^נגן וידאו: /).evaluate((video) => ({
  currentTime: video.currentTime, duration: video.duration, paused: video.paused,
}));

test.describe.serial('FocusMind Academy: full lessons inside FocusMind', () => {
  test.beforeAll(async ({ request }) => {
    const manifest = JSON.parse(readFileSync(path.join(assetsDir, 'manifest.json'), 'utf-8'));
    expect(manifest.videos.filter((entry) => entry.kind === 'academy')).toHaveLength(15);
    const output = execFileSync(python, ['-m', 'app.demo_videos', 'install', assetsDir, '--kind', 'academy'], { cwd: backendDir, env: backendEnv, encoding: 'utf-8' });
    expect(output.split('\n').filter((line) => /^(installed|unchanged)/.test(line))).toHaveLength(15);
    const response = await request.post('/api/auth/register', {
      data: { displayName: learner.name, email: learner.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  });

  test('the catalog shows the Academy first and every Academy lesson is a real playable video', async ({ page }) => {
    await login(page);
    await page.goto('/courses/catalog');
    const cards = page.locator('.course-card');
    for (let index = 0; index < ACADEMY.length; index += 1) {
      await expect(cards.nth(index).locator('.course-badge--academy')).toHaveText('FocusMind Academy · למידה חכמה מלאה');
    }
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    let lessons = 0;
    for (const title of ACADEMY) {
      const course = catalog.find((row) => row.title === title);
      expect(course?.academy, title).toBe(true);
      await page.request.post(`/api/courses/${course.id}/enroll`);
      const detail = await (await page.request.get(`/api/courses/${course.id}`)).json();
      expect(detail.lessons).toHaveLength(3);
      for (const lesson of detail.lessons) {
        expect(lesson.video, lesson.title).toMatchObject({ sourceType: 'upload', academy: true, demo: false, trackable: true });
        expect(lesson.durationSeconds, lesson.title).toBeGreaterThan(150);
        lessons += 1;
      }
      await page.goto(`/courses/${course.id}`);
      await expect(page.locator('.learning-mode--smart')).toHaveCount(3);
      // One at a time: several parallel media loads in one page can be cut off under load.
      const durations = await page.evaluate(async (urls) => {
        const result = [];
        for (const src of urls) {
          result.push(await new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => resolve(video.duration);
            video.onerror = () => resolve(-1);
            video.src = src;
          }));
        }
        return result;
      }, detail.lessons.map((lesson) => lesson.video.url));
      for (const duration of durations) expect(duration).toBeGreaterThan(150);
    }
    expect(lessons).toBe(15);
  });

  test('a complete learning journey on "JOIN: לחבר הזמנות ללקוחות"', async ({ page }) => {
    test.setTimeout(180_000);
    const problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await login(page);
    await page.goto('/courses/catalog');
    await page.getByRole('link', { name: 'SQL לניתוח נתונים' }).first().click();
    await page.getByRole('link', { name: 'JOIN: לחבר הזמנות ללקוחות', exact: true }).click();
    const lessonId = page.url().split('/').pop();
    const player = page.getByLabel(/^נגן וידאו: /);
    await expect(player).toHaveAttribute('src', /^\/api\/videos\/.+\/stream$/);
    await expect(page.locator('.lesson-mode-note')).toContainText('למידה חכמה מלאה');
    await expect(page.locator('.lesson-mode-note')).toContainText('שיעור מקורי של FocusMind Academy');

    // Attention monitor (synthetic camera) and the gaze timeline are offered.
    await page.getByRole('button', { name: 'הפעלת מצלמה' }).click();
    await expect(page.getByRole('status', { name: 'מצב הקשב' })).toContainText(/לא זוהו פנים|מתאימים את המעקב/, { timeout: 45_000 });
    await expect(page.getByRole('heading', { name: 'ציר זמן של כיוון המבט' })).toBeVisible();

    // Real playback with accurate time and duration, pause, resume, seek.
    await player.evaluate((video) => video.play());
    await expect.poll(async () => (await media(page)).currentTime, { timeout: 20_000 }).toBeGreaterThan(2);
    const playing = await media(page);
    expect(playing.duration).toBeGreaterThan(150);
    await player.evaluate((video) => video.pause());
    const paused = await media(page);
    await page.waitForTimeout(700);
    expect((await media(page)).currentTime).toBeCloseTo(paused.currentTime, 1);
    await player.evaluate((video) => { video.currentTime = 95; video.play(); });
    await expect.poll(async () => (await media(page)).currentTime, { timeout: 15_000 }).toBeGreaterThan(96);
    const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
    await player.evaluate((video) => video.pause());
    expect((await (await saved).json()).positionSeconds).toBeGreaterThan(95);

    // Resume after refresh.
    await page.reload();
    await expect(page.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeVisible();
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(95);

    // Attention events in video time -> a ReplayAI interval that plays and stops exactly.
    const session = await (await page.request.post('/api/learning-sessions', { data: { lessonId } })).json();
    const segment = (seq, s, start, seconds) => ({
      seq, state: s, videoStart: start, videoEnd: start + seconds, sessionStartMs: start * 1000,
      sessionEndMs: (start + seconds) * 1000, playbackRate: 1, durationMs: seconds * 1000,
    });
    await page.request.post(`/api/learning-sessions/${session.id}/segments`, {
      data: { segments: [segment(0, 'ON_SCREEN', 60, 40), segment(1, 'OFF_SCREEN', 100, 6), segment(2, 'ON_SCREEN', 106, 20)] },
    });
    await page.request.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 66_000, breakMs: 0 } });
    await page.reload();
    const card = page.getByRole('listitem', { name: /קטע מומלץ לחזרה 1:35–1:49/ });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /ניגון הקטע/ }).click();
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThanOrEqual(95);
    await expect.poll(async () => (await media(page)).paused, { timeout: 30_000 }).toBe(true);
    const stopped = await media(page);
    expect(stopped.currentTime).toBeGreaterThanOrEqual(108.5);
    expect(stopped.currentTime).toBeLessThan(111);

    // Analytics use the stored session of this lesson.
    await page.goto('/insights');
    await expect(page.getByRole('table').filter({ hasText: 'JOIN: לחבר הזמנות ללקוחות' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('an external library lesson is labelled honestly and offers no attention tracking', async ({ page }) => {
    await login(page);
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    const library = catalog.find((row) => row.externalLibrary);
    await page.request.post(`/api/courses/${library.id}/enroll`);
    await page.goto(`/courses/${library.id}`);
    await expect(page.locator('.learning-mode--smart')).toHaveCount(0);
    await expect(page.locator('.learning-mode').first()).toHaveText(/קישור חיצוני בלבד|חסום ברשת הנוכחית/);
    const detail = await (await page.request.get(`/api/courses/${library.id}`)).json();
    await page.goto(`/learning/lessons/${detail.lessons[0].id}`);
    await expect(page.getByRole('heading', { name: 'מעקב קשב אינו זמין בשיעור הזה' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'הפעלת מצלמה' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /לקורסי FocusMind Academy/ })).toBeVisible();
  });
});
