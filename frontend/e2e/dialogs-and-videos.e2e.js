// Course/lesson dialogs close after a confirmed save, and catalog lessons
// show the right player or link. Catalog videos are attached with the real
// CLI (python -m app.catalog_videos) against the isolated e2e database.
//
// The "page" mode is used here because it does not depend on what the
// network allows. Which candidates are reachable behind NetFree is measured
// separately (docs/catalog-videos.md).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE } from '../playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

const RUN = `d${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const user = { name: 'עורכת קורסים', email: `dialogs-${RUN}@example.com` };

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

test.describe.serial('dialogs and catalog videos', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  });

  test('creating a course closes the dialog, refreshes the list and shows a notice', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page);
    await page.goto('/courses');
    await page.getByRole('button', { name: /יצירת קורס אישי/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'יצירת קורס אישי' });
    await expect(dialog.getByLabel('שם הקורס')).toBeFocused();
    await dialog.getByLabel('שם הקורס').fill(`גאומטריה ${RUN}`);

    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/courses')) posts += 1;
    });
    await dialog.getByRole('button', { name: 'יצירת הקורס' }).dblclick();
    await expect(dialog).toBeHidden();
    expect(posts).toBe(1);
    await expect(page.getByRole('status').filter({ hasText: `הקורס ״גאומטריה ${RUN}״ נוצר.` })).toBeVisible();
    await expect(page.getByRole('region', { name: 'קורסים אישיים' }).getByRole('link', { name: `גאומטריה ${RUN}` })).toBeVisible();
    await expect(page).toHaveURL(/\/courses$/);

    // Reopening shows an empty form; Escape closes it.
    await page.getByRole('button', { name: /יצירת קורס אישי/ }).first().click();
    await expect(dialog.getByLabel('שם הקורס')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('editing a course closes the dialog and updates the page; a failed save keeps it open', async ({ page }) => {
    await login(page);
    await page.goto('/courses');
    await page.getByRole('link', { name: `גאומטריה ${RUN}` }).click();
    await page.getByRole('link', { name: 'עריכת הקורס והשיעורים' }).click();

    await page.getByRole('button', { name: 'עריכת פרטי הקורס' }).click();
    const dialog = page.getByRole('dialog', { name: 'עריכת פרטי הקורס' });
    await expect(dialog.getByLabel('שם הקורס')).toHaveValue(`גאומטריה ${RUN}`);

    // The server is unreachable for this request: the dialog stays, with the typed values.
    await page.route('**/api/courses/*', (route) => (route.request().method() === 'PATCH'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"down"}' })
      : route.continue()));
    await dialog.getByLabel('קטגוריה').fill('מתמטיקה');
    await dialog.getByRole('button', { name: 'שמירת השינויים' }).click();
    await expect(dialog.getByRole('alert')).toContainText('השירות אינו זמין כרגע');
    await expect(dialog.getByLabel('קטגוריה')).toHaveValue('מתמטיקה');
    await page.unroute('**/api/courses/*');

    await dialog.getByRole('button', { name: 'שמירת השינויים' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'פרטי הקורס נשמרו.' })).toBeVisible();
    await expect(page.locator('.course-details-summary')).toContainText('מתמטיקה');

    // Lesson details dialog.
    const add = page.getByRole('form', { name: 'הוספת שיעור' });
    if (!(await add.isVisible())) await page.getByRole('button', { name: '+ הוספת שיעור' }).click();
    await add.getByLabel('שם השיעור').fill('משולשים');
    await add.getByRole('button', { name: 'שמירת השיעור' }).click();
    await page.getByRole('button', { name: 'עריכת פרטי השיעור משולשים' }).click();
    const lessonDialog = page.getByRole('dialog', { name: 'עריכת פרטי השיעור' });
    await lessonDialog.getByLabel('שם השיעור').fill('משולשים ישרי זווית');
    await lessonDialog.getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(lessonDialog).toBeHidden();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'משולשים ישרי זווית' })).toBeVisible();

    // After a reload the saved values are what the dialog shows.
    await page.reload();
    await page.getByRole('button', { name: 'עריכת פרטי הקורס' }).click();
    await expect(dialog.getByLabel('קטגוריה')).toHaveValue('מתמטיקה');
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(dialog).toBeHidden();
  });

  test('catalog lessons get curated videos; external pages open on their site', async ({ page }) => {
    const output = execFileSync(python, ['-m', 'app.catalog_videos', 'apply', '--mode', 'page'], {
      cwd: backendDir, env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE }, encoding: 'utf-8',
    });
    expect(output).toContain('attached');
    await login(page);
    await page.goto('/courses/catalog');
    await page.getByRole('button', { name: 'הרשמה לקורס יסודות SQL' }).click();
    await page.getByRole('link', { name: 'יסודות SQL' }).first().click();
    const row = page.locator('.lesson-row', { hasText: 'שליפת נתונים עם SELECT' });
    await expect(row).toContainText('סרטון באתר חיצוני');
    await row.getByRole('link', { name: 'שליפת נתונים עם SELECT', exact: true }).click();

    const link = page.getByRole('link', { name: /פתיחת הסרטון באתר החיצוני/ });
    await expect(link).toHaveAttribute('href', 'https://cs50.harvard.edu/sql/2024/weeks/0/');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.getByText(/ReplayAI המסונכרן למעקב הקשב אינו זמין/)).toBeVisible();
    await expect(page.getByText(/מקור: CS50 SQL, Lecture 0: Querying/)).toContainText('CC BY-NC-SA 4.0');
    await expect(page.getByLabel(/^נגן וידאו: /)).toHaveCount(0);

    // The course without a matching lecture stays honest.
    await page.goto('/courses/catalog');
    await page.getByRole('link', { name: 'מבוא לבינה מלאכותית' }).first().click();
    await expect(page.locator('.lesson-row', { hasText: 'בינה מלאכותית אחראית' })).toContainText('אין עדיין סרטון');
  });

  test('a direct video link that cannot be played shows a helpful message', async ({ page }) => {
    await login(page);
    const request = page.request;
    const course = await (await request.post('/api/courses', { data: { title: `וידאו חסום ${RUN}` } })).json();
    const lesson = await (await request.post(`/api/courses/${course.id}/lessons`, {
      data: { title: 'קובץ שלא זמין', externalUrl: 'https://cdn.example.com/missing-lesson.mp4' },
    })).json();
    await page.goto(`/learning/lessons/${lesson.id}`);
    await expect(page.getByRole('alert').filter({ hasText: 'לא ניתן לנגן את הסרטון מהקישור' })).toContainText('NetFree', { timeout: 30_000 });
  });
});
