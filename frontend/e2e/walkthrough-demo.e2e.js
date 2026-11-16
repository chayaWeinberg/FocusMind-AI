// The ready-made catalog, end to end, with the locally generated
// demonstration videos ("סרטון הדגמה") served by the isolated backend.
//
// The videos are generated offline in Edge (scripts/demo-videos, cached in
// <repo>/demo-videos) and installed with the real CLI into the e2e database
// and its temporary video folder. Attention: the camera is Chromium's
// synthetic device (no face), and the ReplayAI check uses a controlled
// session sent through the API. Neither measures real-webcam accuracy.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE, E2E_VIDEO_DIR } from '../playwright.config.js';
import { DEFAULT_OUT_DIR, generateDemoVideos } from '../scripts/demo-videos/generate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');
const backendEnv = { ...process.env, MONGO_DB_NAME: E2E_DATABASE, VIDEO_STORAGE_DIR: E2E_VIDEO_DIR };

const RUN = `w${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const learner = { name: 'לומדת קטלוג', email: `walkthrough-${RUN}@example.com` };
const COURSES = ['Python למתחילים', 'יסודות SQL', 'מבוא לבינה מלאכותית'];
const REPRESENTATIVE = { 'Python למתחילים': 'משתנים וטיפוסי נתונים', 'יסודות SQL': 'שליפת נתונים עם SELECT', 'מבוא לבינה מלאכותית': 'רשתות נוירונים' };

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(learner.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${learner.name}`) })).toBeVisible();
}

const media = (page) => page.getByLabel(/^נגן וידאו: /).evaluate((video) => ({
  currentTime: video.currentTime, duration: video.duration, paused: video.paused, readyState: video.readyState,
}));

test.describe.serial('ready-made catalog with playable demonstration videos', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(20 * 60_000);
    const { videos } = await generateDemoVideos({ outDir: DEFAULT_OUT_DIR, log: () => {} }); // cached after the first run
    expect(videos).toHaveLength(16);
    execFileSync(python, ['-m', 'app.catalog_videos', 'apply', '--mode', 'page'], { cwd: backendDir, env: backendEnv });
    const output = execFileSync(python, ['-m', 'app.demo_videos', 'install', DEFAULT_OUT_DIR], { cwd: backendDir, env: backendEnv, encoding: 'utf-8' });
    expect(output.split('\n').filter((line) => /^(installed|unchanged)/.test(line))).toHaveLength(16);
    const response = await request.post('/api/auth/register', {
      data: { displayName: learner.name, email: learner.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  });

  test('every catalog lesson has a playable demonstration video served by the local backend', async ({ page }) => {
    await login(page);
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    let lessons = 0;
    for (const title of COURSES) {
      const course = catalog.find((row) => row.title === title);
      expect(course, title).toBeTruthy();
      await page.request.post(`/api/courses/${course.id}/enroll`);
      const detail = await (await page.request.get(`/api/courses/${course.id}`)).json();
      for (const lesson of detail.lessons) {
        expect(lesson.video, lesson.title).toMatchObject({ sourceType: 'upload', demo: true, trackable: true });
        const stream = await page.request.get(lesson.video.url, { headers: { Range: 'bytes=0-1023' } });
        expect(stream.status(), lesson.title).toBe(206);
        expect(stream.headers()['content-type']).toBe('video/mp4');
        lessons += 1;
      }
      // The browser can decode each one: real duration from the media itself.
      await page.goto(`/courses/${course.id}`);
      const durations = await page.evaluate(async (urls) => Promise.all(urls.map((src) => new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => resolve(-1);
        video.src = src;
      }))), detail.lessons.map((lesson) => lesson.video.url));
      for (const duration of durations) expect(duration).toBeGreaterThan(85);
    }
    expect(lessons).toBe(16);
  });

  for (const courseTitle of COURSES) {
    test(`${courseTitle}: open, play, pause, resume, seek, save and restore progress`, async ({ page }) => {
      await login(page);
      await page.getByRole('link', { name: 'קטלוג קורסים' }).click();
      await page.getByRole('link', { name: courseTitle }).first().click();
      const lessonTitle = REPRESENTATIVE[courseTitle];
      const row = page.locator('.lesson-row', { hasText: lessonTitle });
      await expect(row).toContainText('סרטון הדגמה (מתנגן כאן)');
      await expect(row.getByRole('link', { name: /ההרצאה המלאה באתר המקור/ })).toBeVisible();
      await row.getByRole('link', { name: lessonTitle, exact: true }).click();

      await expect(page.getByRole('heading', { name: lessonTitle, level: 1 })).toBeVisible();
      await expect(page.locator('.lesson-demo-badge')).toHaveText('סרטון הדגמה');
      const player = page.getByLabel(/^נגן וידאו: /);
      await expect(player).toBeVisible();
      await expect(player).toHaveAttribute('src', /^\/api\/videos\/.+\/stream$/);

      // Smart Learning with the attention monitor (synthetic camera: no face).
      await page.getByRole('button', { name: 'הפעלת מצלמה' }).click();
      await expect(page.getByRole('status', { name: 'מצב הקשב' })).toContainText(/לא זוהו פנים|מתאימים את המעקב/, { timeout: 30_000 });

      // Play: the media clock really advances.
      await player.evaluate((video) => video.play());
      await expect.poll(async () => (await media(page)).currentTime, { timeout: 20_000 }).toBeGreaterThan(3);
      await expect(page.getByRole('region', { name: 'שעון למידה חכם' })).toContainText('הסשן פעיל');
      // Pause and resume.
      await player.evaluate((video) => video.pause());
      const paused = await media(page);
      expect(paused.paused).toBe(true);
      await page.waitForTimeout(800);
      expect((await media(page)).currentTime).toBeCloseTo(paused.currentTime, 1);
      await player.evaluate((video) => video.play());
      await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(paused.currentTime + 1);
      // Seek forward, keep playing a moment, then pause (saves progress).
      await player.evaluate((video) => { video.currentTime = 40; });
      await expect.poll(async () => (await media(page)).currentTime, { timeout: 15_000 }).toBeGreaterThan(41);
      const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
      await player.evaluate((video) => video.pause());
      const progress = await (await saved).json();
      expect(progress.positionSeconds).toBeGreaterThan(40);
      expect(progress.completed).toBe(false);

      // Refresh: the position is restored.
      await page.reload();
      await expect(page.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(40);
    });
  }

  test('ReplayAI: controlled attention events, replay of the exact interval, analytics', async ({ page }) => {
    await login(page);
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    const ai = catalog.find((row) => row.title === 'מבוא לבינה מלאכותית');
    const lesson = (await (await page.request.get(`/api/courses/${ai.id}`)).json()).lessons.find((row) => row.title === 'למידת מכונה');
    const session = await (await page.request.post('/api/learning-sessions', { data: { lessonId: lesson.id } })).json();
    const segment = (seq, state, start, seconds, at) => ({
      seq, state, videoStart: start, videoEnd: start + seconds, sessionStartMs: at, sessionEndMs: at + seconds * 1000,
      playbackRate: 1, durationMs: seconds * 1000,
    });
    await page.request.post(`/api/learning-sessions/${session.id}/segments`, {
      data: { segments: [segment(0, 'ON_SCREEN', 0, 30, 0), segment(1, 'OFF_SCREEN', 30, 6, 30_000), segment(2, 'ON_SCREEN', 36, 20, 36_000)] },
    });
    await page.request.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 56_000, breakMs: 0 } });

    await page.goto(`/learning/lessons/${lesson.id}`);
    const card = page.getByRole('region', { name: 'ReplayAI – קטעים לחזרה' }).getByRole('listitem', { name: /קטע מומלץ לחזרה 0:25–0:39/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText('המבט הופנה מהמסך ברצף (כ-6 שניות).');
    await card.getByRole('button', { name: /ניגון הקטע/ }).click();
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThanOrEqual(25);
    await expect.poll(async () => (await media(page)).paused, { timeout: 30_000 }).toBe(true);
    const stopped = await media(page);
    expect(stopped.currentTime).toBeGreaterThanOrEqual(38.5);
    expect(stopped.currentTime).toBeLessThan(41);
    await expect(page.getByText(/הקטע הסתיים/)).toBeVisible();
    await page.locator('.replay-banner').getByRole('button', { name: 'סימון כנבדק' }).click();
    await expect(card.locator('.replay-status')).toHaveText(/נבדק/);

    await page.goto('/insights');
    // The main value (not the "breaks: 0 min" hint) is non-zero: real persisted session time.
    await expect(page.locator('article', { hasText: 'זמן למידה פעיל בסך הכול' }).locator('strong')).not.toHaveText('0 דק׳');
    await expect(page.getByRole('table').filter({ hasText: 'למידת מכונה' })).toBeVisible();
    await expect(page.locator('article', { hasText: 'קטעים לחזרה (ReplayAI)' })).toContainText('נבדקו 1');
  });
});
