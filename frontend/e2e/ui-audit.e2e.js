// The five reported UI issues, measured on the rendered interface in Edge:
// login as the default page, discoverable playable Academy lessons, a fixed
// sidebar, one shared navigation on Smart Learning, and the lesson title spacing.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_DATABASE, E2E_VIDEO_DIR } from '../playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..', '..', 'backend');
const python = process.platform === 'win32'
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

const RUN = `u${Date.now().toString(36)}`;
const PASSWORD = 'ui-audit-pass-123';
const user = { name: 'בודקת ממשק', email: `ui-${RUN}@example.com` };
const VIEWPORTS = { desktop: { width: 1366, height: 768 }, mobile: { width: 390, height: 844 } };

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

const box = (locator) => locator.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
});

test.describe.serial('five UI issues', () => {
  test.beforeAll(async ({ request }) => {
    execFileSync(python, ['-m', 'app.demo_videos', 'install', path.join(backendDir, 'demo_assets'), '--kind', 'academy'], {
      cwd: backendDir, env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE, VIDEO_STORAGE_DIR: E2E_VIDEO_DIR },
    });
    const response = await request.post('/api/auth/register', {
      data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  });

  test('1. signed-out visitors land on Login; registration is one link away', async ({ page }) => {
    for (const start of ['/', '/some/unknown/page', '/dashboard', '/courses/catalog', '/learning']) {
      await page.goto(start);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'חוזרים לפוקוס' })).toBeVisible();
    }
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'יוצרים חשבון חדש' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'מתחילים להתמקד' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/register$/); // registration stays reachable

    await login(page);
    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('2. the Academy is the obvious place to watch, and external lessons say what they are', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'קטלוג קורסים' }).click();
    const spotlight = page.getByRole('region', { name: /FocusMind Academy – שיעורים מלאים/ });
    await expect(spotlight).toBeVisible();
    await expect(spotlight).toContainText('15 שיעורים מקוריים');
    await expect(spotlight.getByRole('link')).toHaveCount(5);
    // It is above the course grid, without scrolling.
    expect((await box(spotlight)).top).toBeLessThan(VIEWPORTS.desktop.height);

    await spotlight.getByRole('button', { name: 'הצגת קורסי Academy בלבד' }).click();
    await expect(page.locator('.course-card')).toHaveCount(5);
    await expect(page.locator('.course-card .course-badge--academy')).toHaveCount(5);
    await page.goto('/courses/catalog?video=external');
    await expect(page.locator('.course-card')).toHaveCount(10);
    await expect(page.locator('.course-card .course-badge--external')).toHaveCount(10);

    // An external library course points to the playable lessons. (Other suites may
    // attach direct videos to library lessons in this shared database; pick a course
    // that still has lessons that do not play here.)
    const plays = (lesson) => lesson.video.sourceType === 'upload'
      || (lesson.video.provider === 'direct' && lesson.resource?.netfree?.status !== 'blocked');
    const catalog = await (await page.request.get('/api/courses/catalog')).json();
    let detail = null;
    for (const course of catalog.filter((entry) => entry.externalLibrary)) {
      const candidate = await (await page.request.get(`/api/courses/${course.id}`)).json();
      if (candidate.lessons.some((lesson) => !plays(lesson))) { detail = candidate; break; }
    }
    expect(detail).toBeTruthy();
    await page.goto(`/courses/${detail.id}`);
    const notice = page.getByRole('note', { name: 'על הסרטונים בקורס' });
    await expect(notice).toContainText('הרצאות באתרים חיצוניים');
    // Every lesson badge matches what its video can really do here.
    await expect(page.locator('.lesson-row .learning-mode')).toHaveCount(detail.lessons.length);
    await expect(page.locator('.learning-mode--smart')).toHaveCount(detail.lessons.filter(plays).length);
    await notice.getByRole('link', { name: /לשיעורי FocusMind Academy/ }).click();
    await expect(page).toHaveURL(/video=academy/);
    await expect(page.locator('.course-card')).toHaveCount(5);

    // Watch an Academy lesson inside FocusMind: real playback, saved progress, ReplayAI available.
    await page.getByRole('button', { name: 'הרשמה לקורס Python בפועל' }).click();
    await page.getByRole('article', { name: 'Python בפועל' }).getByRole('link', { name: 'Python בפועל' }).click();
    await expect(page.locator('.learning-mode--smart')).toHaveCount(3);
    await page.getByRole('link', { name: 'פונקציות: פרמטרים, ערכי החזרה וברירות מחדל', exact: true }).click();
    const player = page.getByLabel(/^נגן וידאו: /);
    await player.evaluate((video) => { video.currentTime = 30; video.play(); });
    await expect.poll(() => player.evaluate((video) => video.currentTime), { timeout: 20_000 }).toBeGreaterThan(31);
    const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
    await player.evaluate((video) => video.pause());
    expect((await (await saved).json()).positionSeconds).toBeGreaterThan(30);
    await expect(page.getByRole('button', { name: 'הפעלת מצלמה' })).toBeVisible();
    await expect(page.getByRole('region', { name: /ReplayAI/ }).first()).toBeVisible();
  });

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`3+4+5. ${name}: fixed sidebar, one shared navigation, title spacing`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);

      // 3. The sidebar stays in place while long pages scroll.
      const catalog = await (await page.request.get('/api/courses/catalog')).json();
      const library = catalog.find((course) => course.externalLibrary && course.lessonCount >= 13);
      const longPages = ['/courses/catalog', `/courses/${library.id}`];
      const python = catalog.find((course) => course.title === 'Python בפועל');
      const detail = await (await page.request.get(`/api/courses/${python.id}`)).json();
      longPages.push(`/learning/lessons/${detail.lessons[0].id}`, '/learning');
      for (const url of longPages) {
        await page.goto(url);
        const sidebar = page.locator('aside.signature-dashboard-sidebar');
        await expect(sidebar).toBeVisible();
        // Wait for the page content (lists load after the first paint).
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), {
          message: `${url} is long enough to scroll`, timeout: 15_000,
        }).toBeGreaterThan(200);
        const before = await box(sidebar);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => window.scrollY), url).toBeGreaterThan(150);
        const after = await box(sidebar);
        // Pinned to the top (within the 1px page border), instead of scrolling away.
        expect(Math.abs(after.top), `${url}: sidebar stays at the top`).toBeLessThanOrEqual(2);
        expect(after.left, url).toBeCloseTo(before.left, 0);
        await expect(sidebar.getByRole('link', { name: 'לוח הבקרה' })).toBeInViewport();
        await expect(sidebar.getByRole('button', { name: 'התנתקות' })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${url}: no sideways scroll`).toBeLessThanOrEqual(0);
      }

      // 4. Smart Learning uses the same side navigation, once, and no top bar.
      for (const url of ['/learning', `/learning/lessons/${detail.lessons[0].id}`]) {
        await page.goto(url);
        await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toHaveCount(1);
        await expect(page.locator('aside.signature-dashboard-sidebar nav[aria-label="ניווט ראשי"]')).toHaveCount(1);
        await expect(page.locator('.signature-learning-header')).toHaveCount(0);
        await expect(page.locator('aside.signature-dashboard-sidebar a[aria-current="page"]')).toHaveAttribute('href', '/learning');
      }

      // 5. The lesson title: comfortable RTL padding, never touching the edge or the sidebar.
      const sidebarBox = await box(page.locator('aside.signature-dashboard-sidebar'));
      const hero = page.locator('.lesson-hero');
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveText(detail.lessons[0].title);
      const heroBox = await box(hero);
      const titleBox = await box(title);
      const padding = await hero.evaluate((element) => {
        const style = getComputedStyle(element);
        return { right: parseFloat(style.paddingRight), left: parseFloat(style.paddingLeft), direction: style.direction };
      });
      expect(padding.direction).toBe('rtl');
      expect(padding.right).toBeGreaterThanOrEqual(16);
      expect(padding.left).toBeGreaterThanOrEqual(16);
      expect(titleBox.right, 'title stays left of the sidebar (RTL)').toBeLessThanOrEqual(sidebarBox.left - 16);
      expect(heroBox.right - titleBox.right, 'space between the title and the card edge').toBeGreaterThanOrEqual(16);
      expect(titleBox.left).toBeGreaterThanOrEqual(heroBox.left + 16);
      expect(titleBox.left).toBeGreaterThanOrEqual(8);
      // Same placement as the hero of another page (consistency).
      await page.goto('/courses');
      const coursesHero = await box(page.locator('.courses-hero').first());
      expect(Math.abs(coursesHero.right - heroBox.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(coursesHero.left - heroBox.left)).toBeLessThanOrEqual(1);
    });
  }
});
