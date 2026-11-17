// The expanded catalog in a real browser: every course and lesson, a visible
// "watch" link per lesson pointing at one specific video page, external pages
// opening in a new tab, honest accessibility labels, desktop and mobile.

import { expect, test } from '@playwright/test';

const RUN = `c${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const user = { name: 'סייר קטלוג', email: `library-${RUN}@example.com` };
const VIDEO_PAGE = /^https:\/\/(learn\.microsoft\.com\/en-us\/shows\/[a-z0-9-]+\/[a-z0-9-]+\/|cs50\.harvard\.edu\/[a-z]+\/\d{4}\/(weeks\/\d+|shorts\/[a-z_]+)\/)$/;
const LIBRARY = ['תכנות ב-Python', 'SQL ומסדי נתונים', 'JavaScript', 'React', 'HTML ו-CSS', 'בינה מלאכותית ומודלי שפה',
  'אלגוריתמים ומבני נתונים', 'Git ו-GitHub', 'Docker, API וענן', 'בדיקות תוכנה ואוטומציה'];

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

test.describe.serial('video library catalog', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  });

  test('every course and every lesson shows its real video link in order', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await page.goto('/courses/catalog');
    await expect(page.locator('.course-card')).toHaveCount(13);
    await expect(page.locator('.catalog-summary')).toContainText('13 קורסים');

    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    let lessons = 0;
    for (const title of LIBRARY) {
      const card = page.getByRole('article', { name: title });
      await expect(card).toBeVisible();
      await expect(card.locator('.course-badge--level')).toBeVisible();
      const course = catalog.find((row) => row.title === title);
      const detail = await (await page.request.get(`/api/courses/${course.id}`)).json();

      await card.getByRole('link', { name: title }).click();
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      const rows = page.locator('.lesson-row');
      await expect(rows).toHaveCount(detail.lessons.length);
      for (const [index, lesson] of detail.lessons.entries()) {
        expect(lesson.resource?.pageUrl, lesson.title).toMatch(VIDEO_PAGE);
        const row = rows.nth(index);
        await expect(row).toContainText(`${index + 1}. ${lesson.title}`); // the order of the course
        await expect(row).toContainText(lesson.resource.provider);
        const watch = row.locator('a.lesson-watch');
        await expect(watch).toBeVisible();
        await expect(watch).toHaveAttribute('href', lesson.resource.pageUrl);
        await expect(watch).toHaveAttribute('target', '_blank');
        await expect(row.locator('.lesson-access')).toHaveText(/נבדק|לא נבדק/);
        lessons += 1;
      }
      await page.goto('/courses/catalog');
    }
    expect(lessons).toBe(116);
  });

  test('the watch button opens the lesson video page in a new tab', async ({ page }) => {
    await login(page);
    await page.goto('/courses/catalog');
    await page.getByRole('article', { name: 'אלגוריתמים ומבני נתונים' }).getByRole('link', { name: 'אלגוריתמים ומבני נתונים' }).click();
    const row = page.locator('.lesson-row', { hasText: 'חיפוש בינארי' });
    const [popup] = await Promise.all([page.waitForEvent('popup'), row.locator('a.lesson-watch').click()]);
    // A noopener tab starts at about:blank; wait for the real navigation.
    await popup.waitForURL('https://cs50.harvard.edu/x/2024/shorts/binary_search/', { timeout: 30_000 });
    await expect(popup).toHaveTitle(/Binary Search/);
    await popup.close();
  });

  test('a library lesson explains its external video and links back to the course', async ({ page }) => {
    await login(page);
    await page.goto('/courses/catalog');
    await page.getByRole('button', { name: 'הרשמה לקורס JavaScript' }).click();
    await page.getByRole('article', { name: 'JavaScript' }).getByRole('link', { name: 'JavaScript' }).click();
    await page.locator('.lesson-row', { hasText: 'מהי JavaScript' }).getByRole('link', { name: 'מהי JavaScript', exact: true }).click();
    const open = page.getByRole('link', { name: /פתיחת הסרטון באתר החיצוני/ });
    await expect(open).toHaveAttribute('href', /learn\.microsoft\.com\/en-us\/shows\/beginners-series-to-javascript\//);
    await expect(page.getByText(/ReplayAI המסונכרן למעקב הקשב אינו זמין/)).toBeVisible();
    await expect(page.locator('.lesson-external-meta')).toContainText('Microsoft Learn');
    await page.getByRole('link', { name: /חזרה לקורס/ }).click();
    await expect(page.getByRole('heading', { name: 'JavaScript', level: 1 })).toBeVisible();
  });

  test('the catalog and a course page fit a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/courses/catalog');
    await expect(page.locator('.course-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole('article', { name: 'React' }).getByRole('link', { name: 'React' }).click();
    const watch = page.locator('a.lesson-watch').first();
    await expect(watch).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
