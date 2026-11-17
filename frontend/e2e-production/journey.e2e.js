// The complete user journey on the production build (real Edge, real backend,
// real MongoDB of the rehearsal stack). Camera: Chromium's synthetic device;
// ReplayAI input: a controlled session. Neither measures real-webcam accuracy.

import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { TEST_VIDEO } from '../e2e/global-setup.js';

const RUN = `p${Date.now().toString(36)}`;
const PASSWORD = 'prod-journey-pass-123';
const learner = { name: 'לומדת הדגמה', email: `journey-${RUN}@example.com` };
const manager = { name: 'מנהלת קטלוג', email: `manager-${RUN}@example.com` };
const PROJECT = process.env.PROD_COMPOSE_PROJECT || 'focusmind-rehearsal';
const state = {};

// Harmless browser messages: MediaPipe's WASM prints INFO lines on stderr,
// and /api/auth/me answers 401 before signing in.
const harmless = (text) => /TensorFlow Lite|XNNPACK|INFO:|Failed to load resource: the server responded with a status of 401/.test(text);

function watch(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' && !harmless(message.text())) problems.push(`console: ${message.text()}`); });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 500 || (response.status() >= 400 && url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/me')) {
      problems.push(`HTTP ${response.status()} ${response.request().method()} ${url.pathname}`);
    }
  });
  return problems;
}

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

async function register(page, user) {
  await page.goto('/register');
  await page.getByLabel('שם מלא').fill(user.name);
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByLabel('אימות סיסמה').fill(PASSWORD);
  await page.getByRole('button', { name: /יצירת חשבון/ }).click();
  await expect(page.getByRole('heading', { name: 'איזה כיף, נרשמת!' })).toBeVisible();
}

const media = (page) => page.getByLabel(/^נגן וידאו: /).evaluate((video) => ({
  currentTime: video.currentTime, duration: video.duration, paused: video.paused, src: video.currentSrc,
}));

test.describe.serial('production journey', () => {
  test('register, log in, browse and filter the catalog, enroll', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/courses');
    await expect(page).toHaveURL(/\/login$/); // protected route
    await register(page, learner);
    await login(page, learner);
    await page.getByRole('link', { name: 'קטלוג קורסים' }).click();
    await expect(page.locator('.course-card')).toHaveCount(13);
    await page.getByRole('searchbox').fill('SQL');
    await expect(page.locator('.course-card')).toHaveCount(2);
    await page.getByRole('searchbox').fill('');
    await page.getByLabel('רמה').selectOption('intermediate');
    await expect(page.locator('.course-card')).toHaveCount(5);
    await page.getByLabel('רמה').selectOption('');
    await page.getByRole('button', { name: 'הרשמה לקורס יסודות SQL' }).click();
    await expect(page.getByRole('article', { name: 'יסודות SQL' }).getByText('✓ רשומים לקורס')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('play a demonstration lesson: pause, resume, seek, save, restore; camera and Smart Timer', async ({ page }) => {
    const problems = watch(page);
    await login(page, learner);
    await page.goto('/courses');
    await page.getByRole('region', { name: 'קורסים מהקטלוג' }).getByRole('link', { name: 'יסודות SQL' }).click();
    await page.locator('.lesson-row', { hasText: 'חיבור טבלאות' }).getByRole('link', { name: 'חיבור טבלאות', exact: true }).click();
    state.lessonId = page.url().split('/').pop();
    const player = page.getByLabel(/^נגן וידאו: /);
    await expect(player).toHaveAttribute('src', /^\/api\/videos\/.+\/stream$/);
    await expect(page.locator('.lesson-demo-badge')).toHaveText('סרטון הדגמה');

    await page.getByRole('button', { name: 'הפעלת מצלמה' }).click();
    await expect(page.getByRole('status', { name: 'מצב הקשב' })).toContainText(/לא זוהו פנים|מתאימים את המעקב/, { timeout: 45_000 });

    await player.evaluate((video) => video.play());
    await expect.poll(async () => (await media(page)).currentTime, { timeout: 20_000 }).toBeGreaterThan(3);
    const timer = page.getByRole('region', { name: 'שעון למידה חכם' });
    await expect(timer).toContainText('הסשן פעיל');
    await player.evaluate((video) => video.pause());
    const paused = await media(page);
    await page.waitForTimeout(800);
    expect((await media(page)).currentTime).toBeCloseTo(paused.currentTime, 1);
    await player.evaluate((video) => video.play());
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(paused.currentTime + 1);
    await player.evaluate((video) => { video.currentTime = 40; });
    await expect.poll(async () => (await media(page)).currentTime, { timeout: 15_000 }).toBeGreaterThan(41);
    const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
    await player.evaluate((video) => video.pause());
    expect((await (await saved).json()).positionSeconds).toBeGreaterThan(40);

    await timer.getByRole('button', { name: 'התחלת הפסקה' }).click();
    await expect(timer.getByText('בהפסקה')).toBeVisible();
    await timer.getByRole('button', { name: 'סיום ההפסקה' }).click();

    await page.reload();
    await expect(page.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeVisible();
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });

  test('ReplayAI replays the exact interval; insights, coach, study plan and quiz use stored data', async ({ page }) => {
    const problems = watch(page);
    await login(page, learner);
    const session = await (await page.request.post('/api/learning-sessions', { data: { lessonId: state.lessonId } })).json();
    const segment = (seq, s, start, seconds, at) => ({
      seq, state: s, videoStart: start, videoEnd: start + seconds, sessionStartMs: at, sessionEndMs: at + seconds * 1000,
      playbackRate: 1, durationMs: seconds * 1000,
    });
    await page.request.post(`/api/learning-sessions/${session.id}/segments`, {
      data: { segments: [segment(0, 'ON_SCREEN', 0, 60, 0), segment(1, 'OFF_SCREEN', 60, 5, 60_000), segment(2, 'ON_SCREEN', 65, 10, 65_000)] },
    });
    await page.request.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 75_000, breakMs: 0 } });

    await page.goto(`/learning/lessons/${state.lessonId}`);
    const card = page.getByRole('listitem', { name: /קטע מומלץ לחזרה 0:55–1:08/ });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /ניגון הקטע/ }).click();
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThanOrEqual(55);
    await expect.poll(async () => (await media(page)).paused, { timeout: 30_000 }).toBe(true);
    const stopped = await media(page);
    expect(stopped.currentTime).toBeGreaterThanOrEqual(67.5);
    expect(stopped.currentTime).toBeLessThan(70);
    await page.locator('.replay-banner').getByRole('button', { name: 'סימון כנבדק' }).click();
    await expect(card.locator('.replay-status')).toHaveText(/נבדק/);

    // Quiz on the lesson.
    const quiz = page.getByRole('region', { name: 'QuizFlow – שאלות חזרה' });
    await quiz.getByRole('button', { name: 'הוספת שאלה ראשונה' }).click();
    await quiz.getByLabel('השאלה').fill('מה עושה JOIN?');
    await quiz.getByLabel('תשובה א', { exact: true }).fill('מחבר טבלאות');
    await quiz.getByLabel('תשובה ב', { exact: true }).fill('מוחק שורות');
    await quiz.getByRole('button', { name: 'שמירת השאלה' }).click();
    await quiz.getByRole('button', { name: 'סיום עריכה' }).click();
    await quiz.getByRole('button', { name: 'מענה על השאלות' }).click();
    await quiz.getByRole('radio', { name: 'מחבר טבלאות' }).check();
    await quiz.getByRole('button', { name: 'בדיקת התשובות' }).click();
    await expect(quiz.getByText(/ענית נכון על/)).toContainText('1 מתוך 1');

    await page.goto('/insights');
    await expect(page.locator('article', { hasText: 'זמן למידה פעיל בסך הכול' }).locator('strong')).not.toHaveText('0 דק׳');
    await expect(page.getByRole('table').filter({ hasText: 'חיבור טבלאות' })).toBeVisible();
    await expect(page.locator('article', { hasText: 'קטעים לחזרה (ReplayAI)' })).toContainText('נבדקו 1');
    await expect(page.locator('article', { hasText: 'שאלות חזרה' })).toContainText('100%');

    await page.goto('/study');
    await expect(page.getByRole('region', { name: 'FocusCoach – המלצות אישיות' })).toBeVisible();
    const form = page.getByRole('form', { name: 'מטרת לימוד' });
    await form.getByLabel('קורס להתמקד בו').selectOption({ label: 'יסודות SQL' });
    await form.getByLabel('כמה זמן פנוי יש לכם למפגש (דקות)').fill('30');
    await form.getByRole('button', { name: 'שמירת המטרה' }).click();
    await expect(page.getByRole('region', { name: 'המפגש הבא המוצע (30 דקות)' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('personal course: dialogs, lessons, upload, external link, delete', async ({ page }) => {
    const problems = watch(page);
    await login(page, learner);
    await page.goto('/courses');
    await page.getByRole('button', { name: /יצירת קורס אישי/ }).first().click();
    const create = page.getByRole('dialog', { name: 'יצירת קורס אישי' });
    await create.getByLabel('שם הקורס').fill(`קורס בדיקה ${RUN}`);
    await create.getByRole('button', { name: 'יצירת הקורס' }).click();
    await expect(create).toBeHidden();
    await expect(page.locator('.fm-modal-backdrop')).toHaveCount(0); // no overlay left behind
    await page.getByRole('link', { name: /להוספת שיעורים/ }).click();

    await page.getByRole('button', { name: 'עריכת פרטי הקורס' }).click();
    const edit = page.getByRole('dialog', { name: 'עריכת פרטי הקורס' });
    await edit.getByLabel('קטגוריה').fill('בדיקות');
    await edit.getByRole('button', { name: 'שמירת השינויים' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'פרטי הקורס נשמרו.' })).toBeVisible();

    const add = page.getByRole('form', { name: 'הוספת שיעור' });
    for (const title of ['שיעור וידאו', 'שיעור קישור']) {
      await add.getByLabel('שם השיעור').fill(title);
      await add.getByRole('button', { name: 'הוספת השיעור' }).click();
      await expect(page.locator('.lesson-editor-summary strong', { hasText: title })).toBeVisible();
    }
    await page.getByRole('button', { name: 'פתיחת הסרטון והכלים של השיעור שיעור וידאו' }).click();
    await page.getByLabel('בחירת קובץ וידאו לשיעור שיעור וידאו').setInputFiles(TEST_VIDEO);
    await expect(page.getByText('הסרטון הועלה בהצלחה.')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'סגירת הסרטון והכלים של השיעור שיעור וידאו' }).click();

    await page.getByRole('button', { name: 'פתיחת הסרטון והכלים של השיעור שיעור קישור' }).click();
    await page.getByRole('radio', { name: 'קישור חיצוני' }).check();
    await page.getByLabel('קישור לסרטון', { exact: true }).fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'שמירת הקישור' }).click();
    await expect(page.getByText('הקישור נשמר.')).toBeVisible();

    await page.getByRole('button', { name: 'עריכת פרטי השיעור שיעור קישור' }).click();
    const lessonDialog = page.getByRole('dialog', { name: 'עריכת פרטי השיעור' });
    await lessonDialog.getByLabel('שם השיעור').fill('שיעור YouTube');
    await lessonDialog.getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(lessonDialog).toBeHidden();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'שיעור YouTube' })).toBeVisible();

    // The uploaded lesson plays in the player.
    await page.getByRole('link', { name: 'תצוגת הקורס' }).click();
    await page.locator('.lesson-row', { hasText: 'שיעור וידאו' }).getByRole('link', { name: 'שיעור וידאו', exact: true }).click();
    await page.getByLabel(/^נגן וידאו: /).evaluate((video) => video.play());
    await expect.poll(async () => (await media(page)).currentTime).toBeGreaterThan(1);

    // Delete the test course (confirmation required).
    await page.goto('/courses');
    await page.getByRole('link', { name: `קורס בדיקה ${RUN}` }).click();
    await page.getByRole('link', { name: 'עריכת הקורס והשיעורים' }).click();
    await page.getByRole('button', { name: 'מחיקת הקורס' }).click();
    await page.getByRole('button', { name: 'כן, למחוק את הקורס' }).click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.getByRole('link', { name: `קורס בדיקה ${RUN}` })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('administrator: the role is granted only from the server, catalog management works', async ({ page }) => {
    const problems = watch(page);
    await register(page, manager);
    await login(page, manager);
    await expect(page.getByRole('link', { name: 'ניהול הקטלוג' })).toHaveCount(0);
    expect((await page.request.get('/api/admin/catalog')).status()).toBe(403);
    execFileSync('docker', ['compose', '-p', PROJECT, 'exec', '-T', 'app', 'python', '-m', 'app.admin', 'grant', manager.email], { stdio: 'pipe' });
    await page.reload();
    await page.getByRole('link', { name: 'ניהול הקטלוג' }).click();
    const form = page.getByRole('form', { name: 'קורס קטלוג חדש' });
    await form.getByLabel('שם הקורס').fill(`טיוטה ${RUN}`);
    await form.getByRole('button', { name: 'יצירת טיוטה והוספת שיעורים' }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await page.goto('/admin/catalog');
    const row = page.getByRole('row', { name: new RegExp(`טיוטה ${RUN}`) });
    await row.getByRole('button', { name: 'פרסום בקטלוג' }).click();
    await expect(row).toContainText('מפורסם');
    await row.getByRole('button', { name: 'הסתרה מהקטלוג' }).click();
    await expect(row).toContainText('טיוטה (מוסתר)');
    expect(problems).toEqual([]);
  });

  test('privacy page, mobile layout, log out and back in with data intact', async ({ page }) => {
    const problems = watch(page);
    await login(page, learner);
    await page.goto('/privacy');
    await expect(page.getByText('מפגשי למידה').first()).toBeVisible();
    for (const path of ['/dashboard', '/courses/catalog', '/insights', '/study', '/review', '/privacy']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/courses');
    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, learner);
    const progress = await (await page.request.get(`/api/lessons/${state.lessonId}/progress`)).json();
    expect(progress.positionSeconds).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });
});
