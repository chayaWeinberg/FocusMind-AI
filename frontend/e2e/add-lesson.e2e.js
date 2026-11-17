// "Add lesson" in the course editor, in a real browser: the form closes only
// after the server confirms, the new lesson shows at once, "+ הוספת שיעור"
// opens a fresh form, failures keep the form and its values, and nothing is
// ever created twice (double click, failed upload then retry).

import { expect, test } from '@playwright/test';
import { TEST_VIDEO } from './global-setup.js';

const RUN = `l${Date.now().toString(36)}`;
const PASSWORD = 'add-lesson-pass-123';
const user = { name: 'מורה בודקת', email: `add-lesson-${RUN}@example.com` };
const state = {};

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

const form = (page) => page.getByRole('form', { name: 'הוספת שיעור' });
const openButton = (page) => page.getByRole('button', { name: '+ הוספת שיעור' });
const lessonTitles = async (page) => (await (await page.request.get(`/api/courses/${state.courseId}`)).json()).lessons.map((lesson) => lesson.title);

test.describe.serial('add lesson', () => {
  test.beforeAll(async ({ request }) => {
    expect((await request.post('/api/auth/register', {
      data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
    })).status()).toBe(201);
  });

  test('save closes the form, shows the lesson, and "+ הוספת שיעור" opens a fresh form', async ({ page }) => {
    await login(page);
    const course = await (await page.request.post('/api/courses', { data: { title: `קורס שיעורים ${RUN}` } })).json();
    state.courseId = course.id;
    await page.goto(`/courses/${course.id}/edit`);

    // A course without lessons opens the form; save a lesson without a video.
    await form(page).getByLabel('שם השיעור').fill('מבוא');
    await form(page).getByLabel('תיאור (לא חובה)').fill('שיעור פתיחה');
    await form(page).getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'מבוא' })).toBeVisible();
    await expect(form(page)).toHaveCount(0);
    await expect(openButton(page)).toBeVisible();
    await expect(openButton(page)).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'השיעור ״מבוא״ נוסף' })).toBeVisible();

    // A fresh, empty form.
    await openButton(page).click();
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByLabel('שם השיעור')).toHaveValue('');
    await expect(form(page).getByLabel('שם השיעור')).toBeFocused();
    await expect(form(page).getByLabel('תיאור (לא חובה)')).toHaveValue('');
    await expect(form(page).getByRole('radio', { name: 'בלי סרטון כרגע' })).toBeChecked();
    // Cancel closes it without creating anything.
    await form(page).getByLabel('שם השיעור').fill('טיוטה שבוטלה');
    await form(page).getByRole('button', { name: 'ביטול' }).click();
    await expect(form(page)).toHaveCount(0);
    expect(await lessonTitles(page)).toEqual(['מבוא']);

    // After a reload the lesson is still there (it was saved on the server).
    await page.reload();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'מבוא' })).toBeVisible();
    await expect(openButton(page)).toBeVisible();
  });

  test('external link lesson; a failed save keeps the form, its values and a Hebrew error', async ({ page }) => {
    await login(page);
    await page.goto(`/courses/${state.courseId}/edit`);
    await openButton(page).click();
    await form(page).getByLabel('שם השיעור').fill('שיעור עם קישור');
    await form(page).getByRole('radio', { name: 'קישור לסרטון' }).check();
    const link = form(page).getByLabel(/^קישור לסרטון \(/);
    await link.fill('http://example.com/not-secure.mp4');
    await form(page).getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(form(page).getByRole('alert')).toHaveText('אפשר להוסיף רק קישורים מאובטחים (https).');
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByLabel('שם השיעור')).toHaveValue('שיעור עם קישור');
    await expect(link).toHaveValue('http://example.com/not-secure.mp4');
    expect(await lessonTitles(page)).toEqual(['מבוא']); // nothing was created

    await link.fill('https://youtu.be/dQw4w9WgXcQ');
    await form(page).getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'שיעור עם קישור' })).toBeVisible();
    await expect(form(page)).toHaveCount(0);
    await expect(openButton(page)).toBeVisible();
    const lessons = (await (await page.request.get(`/api/courses/${state.courseId}`)).json()).lessons;
    expect(lessons.map((lesson) => lesson.title)).toEqual(['מבוא', 'שיעור עם קישור']);
    expect(lessons[1].video).toMatchObject({ sourceType: 'external', provider: 'youtube' });
  });

  test('upload lesson: a failed upload keeps the form; retrying uploads without a second lesson', async ({ page }) => {
    await login(page);
    await page.goto(`/courses/${state.courseId}/edit`);
    await openButton(page).click();
    await form(page).getByLabel('שם השיעור').fill('שיעור עם סרטון');
    await form(page).getByRole('radio', { name: 'העלאת קובץ וידאו' }).check();
    await form(page).getByLabel('קובץ וידאו לשיעור החדש').setInputFiles(TEST_VIDEO);

    // The first upload fails on the network.
    let failOnce = true;
    await page.route('**/api/lessons/*/video*', async (route) => {
      if (failOnce && route.request().method() === 'PUT') {
        failOnce = false;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    await form(page).getByRole('button', { name: 'שמירת השיעור' }).click();
    await expect(form(page).getByRole('alert')).toContainText('השיעור נוצר, אבל העלאת הסרטון נכשלה');
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByLabel('שם השיעור')).toHaveValue('שיעור עם סרטון');
    // The lesson exists once, already visible in the list.
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'שיעור עם סרטון' })).toHaveCount(1);
    expect((await lessonTitles(page)).filter((title) => title === 'שיעור עם סרטון')).toHaveLength(1);

    await form(page).getByRole('button', { name: 'ניסיון חוזר להעלאה' }).click();
    await expect(form(page)).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('status').filter({ hasText: 'השיעור ״שיעור עם סרטון״ נוסף עם הסרטון.' })).toBeVisible();
    const lessons = (await (await page.request.get(`/api/courses/${state.courseId}`)).json()).lessons;
    expect(lessons.map((lesson) => lesson.title)).toEqual(['מבוא', 'שיעור עם קישור', 'שיעור עם סרטון']);
    expect(lessons[2].video).toMatchObject({ sourceType: 'upload', trackable: true });
    await expect(page.locator('.lesson-editor-summary strong', { hasText: 'שיעור עם סרטון' })).toHaveCount(1);
  });

  test('a double click saves one lesson; the form is locked while saving', async ({ page }) => {
    await login(page);
    await page.goto(`/courses/${state.courseId}/edit`);
    await openButton(page).click();
    await form(page).getByLabel('שם השיעור').fill('לחיצה כפולה');
    // Slow the server down so the second click lands while the first is in flight.
    await page.route('**/api/courses/*/lessons', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    const save = form(page).getByRole('button', { name: 'שמירת השיעור' });
    await save.dblclick();
    await expect(form(page).getByRole('button', { name: 'שומרים…' })).toBeDisabled();
    await expect(form(page).getByLabel('שם השיעור')).toBeDisabled();
    await expect(form(page)).toHaveCount(0);
    expect((await lessonTitles(page)).filter((title) => title === 'לחיצה כפולה')).toHaveLength(1);
  });

  test('phone width: button, form and list fit without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto(`/courses/${state.courseId}/edit`);
    await expect(openButton(page)).toBeVisible();
    await openButton(page).click();
    await form(page).getByRole('radio', { name: 'העלאת קובץ וידאו' }).check();
    await expect(form(page).getByRole('button', { name: 'שמירת השיעור' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const dir = await form(page).evaluate((element) => getComputedStyle(element).direction);
    expect(dir).toBe('rtl');
    await form(page).getByRole('button', { name: 'ביטול' }).click();
    await expect(openButton(page)).toBeVisible();
  });
});
