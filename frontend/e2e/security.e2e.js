// Authentication and account-isolation security in a real browser:
// Back/Forward after logout, a new tab after logout, refresh of protected
// URLs, switching accounts in the same browser, logout in another tab,
// direct API requests with another account's ids, and cross-site writes.

import { expect, test } from '@playwright/test';

const RUN = Date.now().toString(36);
const PASSWORD = 'security-pass-123';
const alice = { name: 'אליס פרטית', email: `alice-${RUN}@example.com` };
const bob = { name: 'בוב בודק', email: `bob-${RUN}@example.com` };
const SECRET_TITLE = `קורס סודי ${RUN}`;
const SECRET_LESSON = `שיעור סודי ${RUN}`;
const state = {};

async function register(page, user) {
  await page.goto('/register');
  await page.getByLabel('שם מלא').fill(user.name);
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByLabel('אימות סיסמה').fill(PASSWORD);
  await page.getByRole('button', { name: /יצירת חשבון/ }).click();
  await expect(page.getByRole('heading', { name: 'איזה כיף, נרשמת!' })).toBeVisible();
}

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'התנתקות' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Nothing of Alice's private data is visible on the current page. */
async function expectNoPrivateData(page) {
  // Not 'networkidle': the private lesson's external video request can hang on
  // a filtered network. Wait for the page to settle, then read what is shown.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(600);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(SECRET_TITLE);
  expect(body).not.toContain(SECRET_LESSON);
  expect(body).not.toContain('הערה סודית');
  expect(body).not.toContain(alice.name);
}

test.describe.serial('authentication and account isolation', () => {
  test('Alice builds private learning data', async ({ page }) => {
    await register(page, alice);
    await login(page, alice);
    const api = page.request;
    const course = await (await api.post('/api/courses', { data: { title: SECRET_TITLE, description: 'פרטי', category: 'אבטחה' } })).json();
    const lesson = await (await api.post(`/api/courses/${course.id}/lessons`, {
      data: { title: SECRET_LESSON, externalUrl: 'https://cdn.example.com/media/secret.mp4', durationSeconds: 300 },
    })).json();
    expect((await api.put(`/api/lessons/${lesson.id}/progress`, { data: { positionSeconds: 120, durationSeconds: 300 } })).ok()).toBe(true);
    const session = await (await api.post('/api/learning-sessions', { data: { lessonId: lesson.id } })).json();
    const segment = (seq, s, start, seconds) => ({
      seq, state: s, videoStart: start, videoEnd: start + seconds, sessionStartMs: start * 1000,
      sessionEndMs: (start + seconds) * 1000, playbackRate: 1, durationMs: seconds * 1000,
    });
    await api.post(`/api/learning-sessions/${session.id}/segments`, {
      data: { segments: [segment(0, 'ON_SCREEN', 0, 30), segment(1, 'OFF_SCREEN', 30, 6), segment(2, 'ON_SCREEN', 36, 20)] },
    });
    await api.post(`/api/learning-sessions/${session.id}/end`, { data: { activeMs: 56_000, breakMs: 0 } });
    const replay = await (await api.get(`/api/lessons/${lesson.id}/replay`)).json();
    expect(replay.items.length).toBeGreaterThan(0);
    const bookmark = await (await api.post(`/api/lessons/${lesson.id}/bookmarks`, { data: { startSeconds: 10, note: 'הערה סודית' } })).json();
    const question = await (await api.post(`/api/lessons/${lesson.id}/quiz/questions`, {
      data: { prompt: 'שאלה סודית?', options: ['כן', 'לא'], correctIndex: 0 },
    })).json();
    await api.post(`/api/lessons/${lesson.id}/quiz/attempts`, { data: { answers: [{ questionId: question.id, choice: 0 }] } });
    Object.assign(state, { course, lesson, session, bookmark, question, suggestion: replay.items[0] });

    // Alice sees her data in the UI.
    await page.goto('/courses');
    await expect(page.getByRole('link', { name: SECRET_TITLE })).toBeVisible();
    await page.goto(`/courses/${course.id}`);
    await expect(page.getByRole('heading', { name: SECRET_TITLE })).toBeVisible();
    await page.goto('/review');
    await expect(page.getByText('הערה סודית')).toBeVisible();
  });

  test('after logout, Back, Forward, refresh and a new tab never show private data', async ({ page, context }) => {
    await login(page, alice);
    // Private responses are not cacheable.
    const me = await page.request.get('/api/auth/me');
    expect(me.headers()['cache-control']).toBe('no-store');

    await page.goto('/dashboard');
    await page.goto('/courses');
    await expect(page.getByRole('link', { name: SECRET_TITLE })).toBeVisible();
    await page.goto(`/courses/${state.course.id}`);
    await expect(page.getByRole('heading', { name: SECRET_TITLE })).toBeVisible();
    await page.goto(`/learning/lessons/${state.lesson.id}`);
    await expect(page.getByRole('heading', { name: SECRET_LESSON })).toBeVisible();

    await logout(page);
    await expectNoPrivateData(page);

    // Back through the protected history entries.
    for (let step = 0; step < 3; step += 1) {
      await page.goBack();
      await expect(page).toHaveURL(/\/login$/);
      await expectNoPrivateData(page);
    }
    await page.goForward();
    await expect(page).toHaveURL(/\/login$/);
    await expectNoPrivateData(page);

    // Refresh and direct navigation to protected URLs.
    for (const url of [`/courses/${state.course.id}`, `/learning/lessons/${state.lesson.id}`, '/review', '/insights']) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/login$/);
      await page.reload();
      await expectNoPrivateData(page);
    }

    // A new tab in the same browser.
    const tab = await context.newPage();
    await tab.goto(`/courses/${state.course.id}`);
    await expect(tab).toHaveURL(/\/login$/);
    await expectNoPrivateData(tab);

    // The API refuses the signed-out browser.
    expect((await page.request.get(`/api/courses/${state.course.id}`)).status()).toBe(401);
    expect((await page.request.get('/api/replay')).status()).toBe(401);
  });

  test('Bob, in the same browser after Alice, sees none of her data and cannot reach it', async ({ page }) => {
    await login(page, alice);
    await page.goto(`/courses/${state.course.id}`);
    await expect(page.getByRole('heading', { name: SECRET_TITLE })).toBeVisible();
    await logout(page);

    await register(page, bob);
    await login(page, bob);
    for (const url of ['/dashboard', '/courses', '/review', '/insights', '/study', '/privacy']) {
      await page.goto(url);
      await expectNoPrivateData(page);
    }
    // Alice's URLs, opened by Bob.
    for (const url of [`/courses/${state.course.id}`, `/courses/${state.course.id}/edit`, `/learning/lessons/${state.lesson.id}`,
      `/learning/lessons/${state.lesson.id}/review/${state.suggestion.id}`]) {
      await page.goto(url);
      await expect(page.getByText(/הפריט לא נמצא, או שאין לכם גישה אליו|לא נמצא/).first()).toBeVisible();
      await expectNoPrivateData(page);
    }
    // Back into pages loaded while Alice was signed in.
    await page.goBack();
    await page.goBack();
    await expectNoPrivateData(page);
    await page.reload();
    await expectNoPrivateData(page);

    // Direct API requests with Alice's ids (the frontend is bypassed).
    const api = page.request;
    const attempts = [
      ['get', `/api/courses/${state.course.id}`],
      ['patch', `/api/courses/${state.course.id}`, { title: 'hacked' }],
      ['delete', `/api/courses/${state.course.id}`],
      ['get', `/api/lessons/${state.lesson.id}`],
      ['get', `/api/lessons/${state.lesson.id}/progress`],
      ['put', `/api/lessons/${state.lesson.id}/progress`, { positionSeconds: 1, durationSeconds: 300 }],
      ['get', `/api/learning-sessions/${state.session.id}`],
      ['post', `/api/learning-sessions/${state.session.id}/end`, { activeMs: 1, breakMs: 0 }],
      ['get', `/api/lessons/${state.lesson.id}/replay`],
      ['patch', `/api/replay/${state.suggestion.id}`, { status: 'dismissed' }],
      ['delete', `/api/replay/${state.bookmark.id}`],
      ['get', `/api/lessons/${state.lesson.id}/quiz`],
      ['delete', `/api/quiz/questions/${state.question.id}`],
    ];
    for (const [method, url, data] of attempts) {
      const response = await api[method](url, data ? { data } : {});
      expect(response.status(), `${method.toUpperCase()} ${url}`).toBe(404);
      expect(await response.text()).not.toContain(SECRET_TITLE);
    }
    // Admin APIs are refused to a learner.
    expect((await api.get('/api/admin/catalog')).status()).toBe(403);
    expect((await api.post('/api/admin/catalog', { data: { title: 'fake' } })).status()).toBe(403);
    // Bob's own analytics contain nothing of Alice.
    expect(await (await api.get('/api/insights')).text()).not.toContain(SECRET_TITLE);
    expect(await (await api.get('/api/replay')).json()).toEqual([]);

    // Alice's data is intact.
    await logout(page);
    await login(page, alice);
    const progress = await (await page.request.get(`/api/lessons/${state.lesson.id}/progress`)).json();
    expect(progress.positionSeconds).toBe(120);
    await page.goto('/review');
    await expect(page.getByText('הערה סודית')).toBeVisible();
  });

  test('logging out in one tab signs out the other tabs; cross-site writes are refused', async ({ page, context }) => {
    await login(page, alice);
    await page.goto('/courses');
    await expect(page.getByRole('link', { name: SECRET_TITLE })).toBeVisible();
    const other = await context.newPage();
    await other.goto('/review');
    await expect(other.getByText('הערה סודית')).toBeVisible();

    await logout(page);
    // The other tab leaves the private page without a reload.
    await expect(other).toHaveURL(/\/login$/);
    await expectNoPrivateData(other);

    // A forged request from another site is rejected even with a session.
    await login(page, alice);
    const forged = await page.request.post('/api/courses', { data: { title: 'forged' }, headers: { Origin: 'https://evil.example' } });
    expect(forged.status()).toBe(403);
    const titles = (await (await page.request.get('/api/courses/mine')).json()).map((course) => course.title);
    expect(titles).not.toContain('forged');
  });
});
