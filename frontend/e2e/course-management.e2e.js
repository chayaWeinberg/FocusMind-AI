// "הקורסים שלי": leaving a catalog course (ביטול הרשמה) and deleting one's own
// course (מחיקת קורס), in a real browser, including cancel, failures, direct
// API attempts on other people's and protected courses, and a phone screen.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE, E2E_VIDEO_DIR } from '../playwright.config.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

const RUN = `m${Date.now().toString(36)}`;
const PASSWORD = 'manage-pass-123';
const owner = { name: 'בעלת הקורס', email: `manage-${RUN}@example.com` };
const other = { name: 'משתמש אחר', email: `manage-other-${RUN}@example.com` };
const ACADEMY = 'Docker למפתחים';
const PRIVATE = `קורס פרטי ${RUN}`;
const state = {};

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

const catalogSection = (page) => page.getByRole('region', { name: 'קורסים מהקטלוג' });
const personalSection = (page) => page.getByRole('region', { name: 'קורסים אישיים' });

test.describe.serial('course management', () => {
  test.beforeAll(async ({ request }) => {
    // The Academy lessons need their bundled videos to record progress (idempotent).
    execFileSync(python, ['-m', 'app.demo_videos', 'install', path.join(backendDir, 'demo_assets'), '--kind', 'academy'], {
      cwd: backendDir, env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE, VIDEO_STORAGE_DIR: E2E_VIDEO_DIR },
    });
    for (const user of [owner, other]) {
      expect((await request.post('/api/auth/register', {
        data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
      })).status()).toBe(201);
    }
  });

  test('leave a catalog course: cancel, confirm, still in the catalog, enroll again', async ({ page }) => {
    await login(page, owner);
    await page.goto('/courses/catalog');
    await page.getByRole('button', { name: `הרשמה לקורס ${ACADEMY}` }).click();
    await expect(page.getByRole('article', { name: ACADEMY }).getByText('✓ רשומים לקורס')).toBeVisible();
    const course = (await (await page.request.get('/api/courses/catalog')).json()).find((row) => row.title === ACADEMY);
    state.academyId = course.id;
    const lesson = (await (await page.request.get(`/api/courses/${course.id}`)).json()).lessons[0];
    expect((await page.request.put(`/api/lessons/${lesson.id}/progress`, { data: { positionSeconds: 42, durationSeconds: 167 } })).ok()).toBe(true);

    await page.goto('/courses');
    const card = catalogSection(page).getByRole('article', { name: ACADEMY });
    await expect(card).toBeVisible();
    // Catalog courses can be left, never deleted from here.
    await expect(card.getByRole('button', { name: `מחיקת הקורס ${ACADEMY}` })).toHaveCount(0);

    // Cancel: nothing changes.
    await card.getByRole('button', { name: `ביטול ההרשמה לקורס ${ACADEMY}` }).click();
    const dialog = page.getByRole('dialog', { name: 'ביטול ההרשמה לקורס' });
    await expect(dialog).toContainText('יישאר בקטלוג');
    await dialog.getByRole('button', { name: 'להשאיר את ההרשמה' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeVisible();

    // A failed request keeps the course and shows a Hebrew error.
    await page.route('**/api/courses/*/enroll', (route) => (route.request().method() === 'DELETE' ? route.abort('failed') : route.continue()));
    await card.getByRole('button', { name: `ביטול ההרשמה לקורס ${ACADEMY}` }).click();
    await dialog.getByRole('button', { name: 'כן, לבטל את ההרשמה' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('אין חיבור לשרת. בדקו את החיבור ונסו שוב.');
    await expect(dialog).toBeVisible();
    await page.unroute('**/api/courses/*/enroll');
    await dialog.getByRole('button', { name: 'להשאיר את ההרשמה' }).click();
    await expect(card).toBeVisible();

    // Confirm.
    await card.getByRole('button', { name: `ביטול ההרשמה לקורס ${ACADEMY}` }).click();
    await dialog.getByRole('button', { name: 'כן, לבטל את ההרשמה' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(catalogSection(page).getByRole('article', { name: ACADEMY })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: `ההרשמה לקורס ״${ACADEMY}״ בוטלה` })).toBeVisible();
    await page.reload();
    await expect(catalogSection(page).getByRole('article', { name: ACADEMY })).toHaveCount(0);

    // Still in the catalog, and can be joined again with the history restored.
    await page.goto('/courses/catalog');
    await page.getByRole('button', { name: `הרשמה לקורס ${ACADEMY}` }).click();
    await page.goto('/courses');
    await expect(catalogSection(page).getByRole('article', { name: ACADEMY })).toBeVisible();
    expect((await (await page.request.get(`/api/lessons/${lesson.id}/progress`)).json()).positionSeconds).toBe(42);
  });

  test('delete an own course: stronger confirmation, cancel, failure, success', async ({ page }) => {
    await login(page, owner);
    // Create a private course with a lesson through the UI.
    await page.goto('/courses');
    await page.getByRole('button', { name: /יצירת קורס אישי/ }).first().click();
    const create = page.getByRole('dialog', { name: 'יצירת קורס אישי' });
    await create.getByLabel('שם הקורס').fill(PRIVATE);
    await create.getByRole('button', { name: 'יצירת הקורס' }).click();
    await page.getByRole('link', { name: /להוספת שיעורים/ }).click();
    await page.getByRole('form', { name: 'הוספת שיעור' }).getByLabel('שם השיעור').fill('שיעור במחיקה');
    await page.getByRole('form', { name: 'הוספת שיעור' }).getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'שיעור במחיקה' })).toBeVisible();
    state.courseId = page.url().match(/\/courses\/([^/]+)\/edit$/)[1];
    const detail = await (await page.request.get(`/api/courses/${state.courseId}`)).json();
    state.lessonId = detail.lessons[0].id;

    await page.goto('/courses');
    const card = personalSection(page).getByRole('article', { name: PRIVATE });
    await expect(card.getByRole('button', { name: `ביטול ההרשמה לקורס ${PRIVATE}` })).toHaveCount(0);
    const open = () => card.getByRole('button', { name: `מחיקת הקורס ${PRIVATE}` }).click();
    const dialog = page.getByRole('dialog', { name: 'מחיקת קורס' });
    const confirm = dialog.getByRole('button', { name: 'מחיקה סופית של הקורס' });

    // The destructive button needs the explicit tick; cancel changes nothing.
    await open();
    await expect(dialog).toContainText('1 השיעורים שבקורס');
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeVisible();
    expect((await page.request.get(`/api/courses/${state.courseId}`)).status()).toBe(200);

    // A failed deletion keeps everything.
    await page.route(`**/api/courses/${state.courseId}`, (route) => (route.request().method() === 'DELETE' ? route.abort('failed') : route.continue()));
    await open();
    await dialog.getByRole('checkbox').check();
    await confirm.click();
    await expect(dialog.getByRole('alert')).toHaveText('אין חיבור לשרת. בדקו את החיבור ונסו שוב.');
    await page.unroute(`**/api/courses/${state.courseId}`);
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(card).toBeVisible();

    // Delete (a double click sends one request).
    let deletes = 0;
    page.on('request', (request) => { if (request.method() === 'DELETE' && request.url().endsWith(`/api/courses/${state.courseId}`)) deletes += 1; });
    await open();
    await dialog.getByRole('checkbox').check();
    await confirm.dblclick();
    await expect(dialog).toHaveCount(0);
    await expect(personalSection(page).getByRole('article', { name: PRIVATE })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: `הקורס ״${PRIVATE}״ נמחק.` })).toBeVisible();
    expect(deletes).toBe(1);
    expect((await page.request.get(`/api/courses/${state.courseId}`)).status()).toBe(404);
    expect((await page.request.get(`/api/lessons/${state.lessonId}`)).status()).toBe(404);
    await page.reload();
    await expect(personalSection(page).getByRole('article', { name: PRIVATE })).toHaveCount(0);
  });

  test('the server refuses deleting other people\'s or protected courses; their data stays', async ({ page }) => {
    await login(page, other);
    const mine = await (await page.request.post('/api/courses', { data: { title: `של משתמש אחר ${RUN}` } })).json();
    await page.request.post(`/api/courses/${mine.id}/lessons`, { data: { title: 'שיעור של אחר' } });
    await page.getByRole('button', { name: 'התנתקות' }).click();

    await login(page, owner);
    // Someone else's course: not found (nothing revealed), and not deleted.
    expect((await page.request.delete(`/api/courses/${mine.id}`)).status()).toBe(404);
    // A protected Academy course: refused.
    expect((await page.request.delete(`/api/courses/${state.academyId}`)).status()).toBe(403);
    // Leaving a course one is not enrolled in, or a personal course, is refused too.
    expect((await page.request.delete(`/api/courses/${mine.id}/enroll`)).status()).toBe(404);
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    expect(catalog.map((row) => row.title)).toContain(ACADEMY);
    expect(catalog).toHaveLength(15); // 5 Academy + 10 library; the old demonstration courses stay retired

    await page.getByRole('button', { name: 'התנתקות' }).click();
    await login(page, other);
    const detail = await (await page.request.get(`/api/courses/${mine.id}`)).json();
    expect(detail.title).toBe(`של משתמש אחר ${RUN}`);
    expect(detail.lessons).toHaveLength(1);
  });

  test('phone width: the actions and the dialogs fit and work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, owner);
    await page.goto('/courses');
    const card = catalogSection(page).getByRole('article', { name: ACADEMY });
    await card.getByRole('button', { name: `ביטול ההרשמה לקורס ${ACADEMY}` }).click();
    const dialog = page.getByRole('dialog', { name: 'ביטול ההרשמה לקורס' });
    await expect(dialog.getByRole('button', { name: 'כן, לבטל את ההרשמה' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await dialog.getByRole('button', { name: 'להשאיר את ההרשמה' }).click();
    await expect(card).toBeVisible();
  });
});
