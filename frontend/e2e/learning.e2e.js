// Real-browser end-to-end tests for ReplayAI, the Smart Timer, FocusInsights,
// AdaptiveStudy, QuizFlow and authorization, against the isolated stack from
// playwright.config.js (backend on 8010, database focusmind_e2e).
//
// Attention data: the fake camera has no face, so it cannot produce
// "looking away" events. The test therefore records one learning session
// through the real API with *controlled* segments (a 5-second look-away at
// 3-8 s of video). Everything after that, from ReplayAI analysis and storage
// to the UI, seeking, pausing and status, is real. This does not measure
// real-webcam accuracy.

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { TEST_VIDEO, TEST_VIDEO_SECONDS } from './global-setup.js';

const RUN = `l${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const learner = { name: 'לומדת חכמה', email: `learner-${RUN}@example.com` };
const other = { name: 'משתמש אחר', email: `other-${RUN}@example.com` };
const state = {};

async function apiRegister(request, user) {
  const response = await request.post('/api/auth/register', {
    data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
  });
  expect(response.status()).toBe(201);
}

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

const player = (page) => page.getByLabel('נגן וידאו: שיעור עם הסחה');
const videoState = (page) => player(page).evaluate((video) => ({ currentTime: video.currentTime, paused: video.paused }));

function segment(seq, state, videoStart, seconds, sessionStartMs) {
  return {
    seq, sessionStartMs, sessionEndMs: sessionStartMs + seconds * 1000, videoStart, videoEnd: videoStart + seconds,
    playbackRate: 1, state, durationMs: seconds * 1000,
  };
}

test.describe.serial('FocusMind learning features end to end', () => {
  test('signed-out visitors are sent to login from every new page', async ({ page }) => {
    for (const path of ['/review', '/insights', '/study', '/privacy', '/admin/catalog']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    const anonymous = await page.request.get('/api/replay');
    expect(anonymous.status()).toBe(401);
  });

  test('prepares a lesson with a real uploaded video and one recorded session', async ({ page }) => {
    await apiRegister(page.request, learner);
    await apiRegister(page.request, other);
    await login(page, learner);
    const request = page.request;

    const course = await (await request.post('/api/courses', { data: { title: 'קורס ReplayAI', category: 'בדיקות' } })).json();
    const lesson = await (await request.post(`/api/courses/${course.id}/lessons`, { data: { title: 'שיעור עם הסחה' } })).json();
    await request.post(`/api/courses/${course.id}/lessons`, { data: { title: 'שיעור המשך', externalUrl: 'https://cdn.example.com/next.mp4', durationSeconds: 600 } });
    const upload = await request.put(`/api/lessons/${lesson.id}/video?durationSeconds=${TEST_VIDEO_SECONDS}`, {
      data: await readFile(TEST_VIDEO),
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'lesson.mp4' },
    });
    expect(upload.status()).toBe(200);

    const session = await (await request.post('/api/learning-sessions', { data: { lessonId: lesson.id } })).json();
    const sent = await request.post(`/api/learning-sessions/${session.id}/segments`, {
      data: { segments: [segment(0, 'ON_SCREEN', 0, 3, 0), segment(1, 'OFF_SCREEN', 3, 5, 3000), segment(2, 'ON_SCREEN', 8, 4, 8000)] },
    });
    expect(await sent.json()).toEqual({ accepted: 3 });
    await request.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 12_000, breakMs: 0 } });
    Object.assign(state, { courseId: course.id, lessonId: lesson.id });
  });

  test('ReplayAI shows the suggestion and replays exactly that interval in the lesson player', async ({ page }) => {
    await login(page, learner);
    await page.goto(`/learning/lessons/${state.lessonId}`);
    const panel = page.getByRole('region', { name: 'ReplayAI – קטעים לחזרה' });
    // Look-away at 3-8 s, 5 s context before (clamped to 0) and 3 s after.
    const card = panel.getByRole('listitem', { name: /קטע מומלץ לחזרה 0:00–0:11/ });
    await expect(card).toBeVisible();
    await expect(card.getByText('המבט הופנה מהמסך ברצף (כ-5 שניות).')).toBeVisible();
    await expect(card.locator('.replay-status')).toHaveText(/ממתין לחזרה/);

    await card.getByRole('button', { name: /ניגון הקטע/ }).click();
    await expect(page.getByText('מנגנים את הקטע ועוצרים בסופו.', { exact: false })).toBeVisible();
    // The real video plays and pauses itself at the end of the interval (11 s of 12 s).
    await expect.poll(async () => (await videoState(page)).paused, { timeout: 25_000 }).toBe(true);
    const stopped = await videoState(page);
    expect(stopped.currentTime).toBeGreaterThanOrEqual(10.5);
    expect(stopped.currentTime).toBeLessThan(TEST_VIDEO_SECONDS - 0.4);
    await expect(page.getByText(/הקטע הסתיים/)).toBeVisible();

    await page.locator('.replay-banner').getByRole('button', { name: 'סימון כנבדק' }).click();
    await expect(card.locator('.replay-status')).toHaveText(/נבדק/);

    // Persisted: still reviewed after a reload.
    await page.reload();
    await expect(page.getByRole('listitem', { name: /0:00–0:11/ }).locator('.replay-status')).toHaveText(/נבדק/);
  });

  test('a bookmark is saved, listed on the review page and reopens the lesson at its point', async ({ page }) => {
    await login(page, learner);
    await page.goto(`/learning/lessons/${state.lessonId}`);
    const panel = page.getByRole('region', { name: 'ReplayAI – קטעים לחזרה' });
    await expect(panel.getByRole('listitem').first()).toBeVisible();
    await player(page).evaluate((video) => { video.currentTime = 6; });
    await expect.poll(async () => Math.round((await videoState(page)).currentTime)).toBe(6);
    await panel.getByPlaceholder('הערה (לא חובה)').fill('לחזור לכאן');
    await panel.getByRole('button', { name: 'סימון הרגע הנוכחי' }).click();
    await expect(panel.getByText('נשמרה סימנייה בנקודה 0:06.')).toBeVisible();

    await page.goto('/review');
    const group = page.getByRole('region', { name: 'קורס ReplayAI – שיעור עם הסחה' });
    await expect(group.getByText('״לחזור לכאן״')).toBeVisible(); // pending bookmark
    await page.getByRole('tab', { name: 'נבדקו' }).click();
    await expect(group.getByRole('listitem', { name: /0:00–0:11/ })).toBeVisible();
    await page.getByRole('tab', { name: 'ממתינים לחזרה' }).click();
    await group.getByRole('link', { name: /לניגון הקטע בשיעור/ }).click();
    await expect(page).toHaveURL(/\/learning\/lessons\/.+\/review\/.+/);
    await expect(page.getByText(/מנגנים מהסימנייה/)).toBeVisible();
    await expect.poll(async () => (await videoState(page)).currentTime).toBeGreaterThanOrEqual(2.9);
  });

  test('the Smart Timer runs a break that the learner starts and ends', async ({ page }) => {
    await login(page, learner);
    await page.goto(`/learning/lessons/${state.lessonId}`);
    const timer = page.getByRole('region', { name: 'שעון למידה חכם' });
    await timer.getByRole('button', { name: 'התחלת הפסקה' }).click();
    await expect(timer.getByText('בהפסקה')).toBeVisible();
    await page.waitForTimeout(1500);
    await timer.getByRole('button', { name: 'סיום ההפסקה' }).click();
    await expect(timer.getByRole('button', { name: 'התחלת הפסקה' })).toBeVisible();
  });

  test('FocusInsights shows the stored session, and nothing invented', async ({ page }) => {
    await login(page, learner);
    await page.goto('/insights');
    const totals = page.locator('article', { hasText: 'זמן למידה פעיל בסך הכול' });
    await expect(totals).toContainText('פחות מדקה'); // 12 s of active time
    await expect(page.getByRole('figure', { name: 'התפלגות מצבי המבט בזמן צפייה' })).toContainText('מבט מחוץ למסך');
    await expect(page.locator('article', { hasText: 'קטעים לחזרה (ReplayAI)' })).toContainText('נבדקו 1');
    await expect(page.getByRole('table').filter({ hasText: 'שיעור עם הסחה' })).toBeVisible();
    await expect(page.getByText(/אינו ציון ריכוז/)).toBeVisible();
  });

  test('AdaptiveStudy saves a goal and suggests the next session; the coach explains its tips', async ({ page }) => {
    await login(page, learner);
    await page.goto('/study');
    const form = page.getByRole('form', { name: 'מטרת לימוד' });
    await form.getByLabel('קורס להתמקד בו').selectOption({ label: 'קורס ReplayAI' });
    await form.getByLabel('כמה זמן פנוי יש לכם למפגש (דקות)').fill('20');
    await form.getByLabel('מטרה שבועית בדקות (לא חובה)').fill('90');
    await form.getByRole('button', { name: 'שמירת המטרה' }).click();
    const next = page.getByRole('region', { name: 'המפגש הבא המוצע (20 דקות)' });
    await expect(next).toBeVisible();
    await expect(next.getByText('חזרה לסימנייה')).toBeVisible(); // the pending bookmark comes first
    await expect(page.getByText(/השבוע: 0 מתוך 90 דקות/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'FocusCoach – המלצות אישיות' }).getByText('למה?').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(/זמן למפגש:/)).toContainText('20 דקות');
  });

  test('QuizFlow: write a question, answer it and see the graded result', async ({ page }) => {
    await login(page, learner);
    await page.goto(`/learning/lessons/${state.lessonId}`);
    const quiz = page.getByRole('region', { name: 'QuizFlow – שאלות חזרה' });
    await quiz.getByRole('button', { name: 'הוספת שאלה ראשונה' }).click();
    await quiz.getByLabel('השאלה').fill('מה מוצג בסרטון הבדיקה?');
    await quiz.getByLabel('תשובה א', { exact: true }).fill('טקסט ושעון');
    await quiz.getByLabel('תשובה ב', { exact: true }).fill('נוף');
    await quiz.getByRole('button', { name: 'שמירת השאלה' }).click();
    await expect(quiz.getByText('מה מוצג בסרטון הבדיקה?')).toBeVisible();
    await quiz.getByRole('button', { name: 'סיום עריכה' }).click();
    await quiz.getByRole('button', { name: 'מענה על השאלות' }).click();
    await quiz.getByRole('radio', { name: 'נוף' }).check();
    await quiz.getByRole('button', { name: 'בדיקת התשובות' }).click();
    await expect(quiz.getByText(/ענית נכון על/)).toContainText('0 מתוך 1');
    await expect(quiz.getByText('התשובה הנכונה: ״טקסט ושעון״')).toBeVisible();

    await page.goto(`/courses/${state.courseId}`);
    await expect(page.getByText('שאלות חזרה: 0% בניסיון האחרון')).toBeVisible();
  });

  test('another user cannot read or change the learner\'s ReplayAI items, quiz or sessions', async ({ page }) => {
    await login(page, learner);
    const items = await (await page.request.get('/api/replay?status=all')).json();
    expect(items.length).toBeGreaterThanOrEqual(2);
    await page.goto('/courses');
    await page.getByRole('button', { name: 'התנתקות' }).click();

    await login(page, other);
    const request = page.request;
    expect((await request.get(`/api/lessons/${state.lessonId}/replay`)).status()).toBe(404);
    expect((await request.patch(`/api/replay/${items[0].id}`, { data: { status: 'dismissed' } })).status()).toBe(404);
    expect((await request.get(`/api/lessons/${state.lessonId}/quiz`)).status()).toBe(404);
    expect(await (await request.get('/api/replay?status=all')).json()).toEqual([]);
    expect(await (await request.get('/api/learning-sessions')).json()).toEqual([]);
    expect((await request.get('/api/admin/catalog')).status()).toBe(403);
    await page.goto('/admin/catalog');
    await expect(page.getByText('אין לכם הרשאה לנהל את הקטלוג')).toBeVisible();
    await page.goto('/insights');
    await expect(page.getByText('עדיין אין נתוני למידה')).toBeVisible();
  });
});
