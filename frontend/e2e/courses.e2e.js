// Real-browser end-to-end tests for authentication, courses, uploads, the
// Smart Learning lesson player, progress, catalog enrollment and access
// control. Runs against the isolated stack from playwright.config.js.
//
// Camera: Chromium's synthetic fake device (no human face). The tests verify
// that the real MediaPipe model loads and that the attention monitor feeds
// lesson playback; they do NOT measure real-webcam accuracy.

import { expect, test } from '@playwright/test';
import { TEST_VIDEO, TEST_VIDEO_SECONDS } from './global-setup.js';

const RUN = Date.now().toString(36);
const PASSWORD = 'e2e-password-123';
const owner = { name: 'בודקת אחת', email: `owner-${RUN}@example.com` };
const stranger = { name: 'בודק שני', email: `stranger-${RUN}@example.com` };

const state = { courseId: null, lessons: {} };

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

const lessonVideo = (page, title) => page.getByLabel(`נגן וידאו: ${title}`);

async function videoState(page, title) {
  return lessonVideo(page, title).evaluate((video) => ({
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    ended: video.ended,
  }));
}

test.describe.serial('FocusMind courses end to end', () => {
  test('authentication: register, log in, protect pages, log out', async ({ page }) => {
    await page.goto('/courses');
    await expect(page).toHaveURL(/\/login$/); // protected while signed out

    await register(page, owner);
    await register(page, stranger);
    await login(page, owner);
    await expect(page.getByRole('link', { name: 'הקורסים שלי' })).toHaveAttribute('href', '/courses');

    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);

    // Wrong password is rejected.
    await page.getByLabel('כתובת אימייל').fill(owner.email);
    await page.getByLabel('סיסמה', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'התחברות' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('creates a personal course with three lessons, an uploaded video and external links', async ({ page }) => {
    await login(page, owner);
    await page.getByRole('link', { name: 'הקורסים שלי' }).click();
    await expect(page.getByText('עדיין לא יצרתם קורס אישי')).toBeVisible();
    await page.getByRole('link', { name: /יצירת קורס אישי/ }).first().click();

    await page.getByLabel('שם הקורס').fill('פיזיקה E2E');
    await page.getByLabel('קטגוריה').fill('מדעים');
    await page.getByLabel('תיאור').fill('קורס בדיקה מקצה לקצה');
    await page.getByRole('button', { name: 'יצירת הקורס' }).click();
    await expect(page.getByRole('heading', { name: 'פיזיקה E2E', level: 1 })).toBeVisible();
    state.courseId = page.url().match(/\/courses\/([^/]+)\/edit$/)[1];

    const addForm = page.getByRole('form', { name: 'הוספת שיעור' });
    for (const title of ['תנועה', 'כוחות', 'אנרגיה']) {
      await addForm.getByLabel('שם השיעור').fill(title);
      await addForm.getByRole('button', { name: 'הוספת השיעור' }).click();
      await expect(page.locator('.lesson-editor-summary strong', { hasText: title })).toBeVisible();
    }

    // Upload a real MP4 (recorded by the browser in global-setup) to lesson 1.
    await page.getByRole('button', { name: 'עריכת השיעור תנועה' }).click();
    const upload = page.waitForResponse((response) => response.url().includes('/video') && response.request().method() === 'PUT');
    await page.getByLabel('בחירת קובץ וידאו לשיעור תנועה').setInputFiles(TEST_VIDEO);
    expect((await upload).status()).toBe(200);
    await expect(page.getByText('הסרטון הועלה בהצלחה.')).toBeVisible();
    await expect(page.getByText(/סרטון נוכחי: lesson\.mp4/)).toBeVisible();
    await page.getByRole('button', { name: 'סגירת השיעור תנועה' }).click();

    // A supported external link (YouTube) on lesson 2; an unsupported page is rejected.
    await page.getByRole('button', { name: 'עריכת השיעור כוחות' }).click();
    await page.getByRole('radio', { name: 'קישור חיצוני' }).check();
    await page.getByLabel('קישור לסרטון', { exact: true }).fill('https://example.com/an-article');
    await page.getByRole('button', { name: 'שמירת הקישור' }).click();
    await expect(page.getByRole('alert')).toContainText('הקישור אינו נתמך');
    await page.getByLabel('קישור לסרטון', { exact: true }).fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'שמירת הקישור' }).click();
    await expect(page.getByText('הקישור נשמר.')).toBeVisible();
    await expect(page.getByText(/אי אפשר לשמור את מיקום הצפייה/)).toBeVisible();
    await page.getByRole('button', { name: 'סגירת השיעור כוחות' }).click();

    // A direct https video link on lesson 3 (stored and classified; the host is not contacted by the server).
    await page.getByRole('button', { name: 'עריכת השיעור אנרגיה' }).click();
    await page.getByRole('radio', { name: 'קישור חיצוני' }).check();
    await page.getByLabel('קישור לסרטון', { exact: true }).fill('https://cdn.example.com/media/energy.webm');
    await page.getByRole('button', { name: 'שמירת הקישור' }).click();
    await expect(page.getByText('הקישור נשמר.')).toBeVisible();

    // Course details list the lessons in order with their sources.
    await page.getByRole('link', { name: 'תצוגת הקורס' }).click();
    const rows = page.locator('.lesson-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('סרטון שהועלה');
    await expect(rows.nth(1)).toContainText('YouTube');
    await expect(rows.nth(2)).toContainText('קישור לסרטון');
    for (const [index, title] of ['תנועה', 'כוחות', 'אנרגיה'].entries()) {
      const href = await rows.nth(index).getByRole('link', { name: title, exact: true }).getAttribute('href');
      state.lessons[title] = href.split('/').pop();
    }
    await expect(page.getByRole('progressbar', { name: 'התקדמות כוללת בקורס' })).toHaveAttribute('aria-valuenow', '0');
  });

  test('uploaded video streams with HTTP ranges only for its owner', async ({ page, browser }) => {
    await login(page, owner);
    const context = await page.request.get(`/api/lessons/${state.lessons['תנועה']}`);
    const streamUrl = (await context.json()).lesson.video.url;
    const ranged = await page.request.get(streamUrl, { headers: { Range: 'bytes=0-99' } });
    expect(ranged.status()).toBe(206);
    expect(ranged.headers()['content-range']).toMatch(/^bytes 0-99\/\d+$/);
    expect(ranged.headers()['content-type']).toBe('video/mp4');
    expect((await ranged.body()).length).toBe(100);

    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(`http://localhost:3010${streamUrl}`)).status()).toBe(401);
    await anonymous.close();
  });

  test('plays a lesson with the attention monitor, saves and restores the position, completes it', async ({ page }) => {
    await login(page, owner);
    const segmentBatches = [];
    page.on('request', (request) => {
      if (request.url().includes('/segments') && request.method() === 'POST') {
        segmentBatches.push(request.postDataJSON().segments);
      }
    });

    await page.goto(`/courses/${state.courseId}`);
    await page.getByRole('link', { name: /להתחיל ללמוד/ }).click();
    await expect(page).toHaveURL(new RegExp(`/learning/lessons/${state.lessons['תנועה']}$`));
    await expect(page.getByRole('heading', { name: 'תנועה', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'פיזיקה E2E' })).toBeVisible();
    await expect(page.getByText(/שיעור 1 מתוך 3/)).toBeVisible();
    await expect(page.getByRole('link', { name: /השיעור הבא/ })).toBeVisible();

    // The real MediaPipe model runs on the synthetic camera (no face in it).
    await page.getByRole('button', { name: 'הפעלת מצלמה' }).click();
    const attention = page.getByRole('status', { name: 'מצב הקשב' });
    await expect(attention).toHaveText('לא זוהו פנים', { timeout: 45_000 });

    // Watch ~4 seconds, then pause: the position is saved immediately.
    await expect.poll(async () => (await videoState(page, 'תנועה')).duration).toBeGreaterThan(TEST_VIDEO_SECONDS - 2);
    await lessonVideo(page, 'תנועה').evaluate((video) => { video.muted = true; return video.play(); });
    await expect(page.getByText('הסשן פעיל')).toBeVisible();
    await expect.poll(async () => (await videoState(page, 'תנועה')).currentTime, { timeout: 20_000 }).toBeGreaterThan(4);
    const saved = page.waitForResponse((response) => response.url().endsWith('/progress') && response.request().method() === 'PUT');
    await lessonVideo(page, 'תנועה').evaluate((video) => video.pause());
    const savedBody = await (await saved).json();
    expect(savedBody.positionSeconds).toBeGreaterThan(4);
    expect(savedBody.completed).toBe(false);
    await expect(page.getByText(/ההתקדמות נשמרה בנקודה/)).toBeVisible();

    // Attention segments were sent with video time and the measured state.
    await expect.poll(() => segmentBatches.flat().length).toBeGreaterThan(0);
    const segments = segmentBatches.flat();
    for (const segment of segments) {
      expect(['ON_SCREEN', 'OFF_SCREEN', 'FACE_ABSENT', 'UNCERTAIN', 'NOT_MEASURED']).toContain(segment.state);
      expect(segment.videoEnd).toBeGreaterThanOrEqual(segment.videoStart);
      expect(segment.videoEnd).toBeLessThanOrEqual(savedBody.positionSeconds + 0.6);
    }
    expect(segments.some((segment) => segment.state === 'FACE_ABSENT')).toBe(true);
    await expect(page.getByRole('region', { name: 'Focus Monitor' })).toContainText('לא זוהו פנים');

    // Leave the lesson and come back: playback resumes where it stopped.
    await page.getByRole('link', { name: /חזרה לקורס/ }).click();
    await expect(page.getByRole('heading', { name: 'פיזיקה E2E', level: 1 })).toBeVisible();
    await expect(page.locator('.lesson-row').nth(0)).toContainText('בתהליך');
    await page.locator('.lesson-row').nth(0).getByRole('link', { name: 'תנועה', exact: true }).click();
    await expect(page.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeVisible();
    await expect.poll(async () => (await videoState(page, 'תנועה')).currentTime).toBeCloseTo(savedBody.positionSeconds, 0);

    // Watch to the end: the lesson is completed.
    const finished = page.waitForResponse(async (response) => (
      response.url().endsWith('/progress') && response.request().method() === 'PUT' && response.request().postDataJSON().ended
    ));
    await lessonVideo(page, 'תנועה').evaluate((video) => {
      video.muted = true;
      video.currentTime = Math.max(0, video.duration - 1.5);
      return video.play();
    });
    expect((await (await finished).json()).completed).toBe(true);
    await expect(page.getByText('השיעור הושלם.')).toBeVisible();
    await expect(page.getByText('הסרטון הסתיים', { exact: true })).toBeVisible();
  });

  test('marks an embedded lesson completed manually and updates course progress', async ({ page }) => {
    await login(page, owner);
    await page.goto(`/learning/lessons/${state.lessons['כוחות']}`);
    await expect(page.getByTitle('סרטון YouTube: כוחות')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    await expect(page.getByText('מיקום הצפייה אינו נשמר בסרטון מסוג זה.')).toBeVisible();
    await page.getByRole('button', { name: 'סימון השיעור כהושלם' }).click();
    await expect(page.getByText('השיעור הושלם.')).toBeVisible();

    await page.goto(`/courses/${state.courseId}`);
    await expect(page.getByRole('progressbar', { name: 'התקדמות כוללת בקורס' })).toHaveAttribute('aria-valuenow', '67');
    await expect(page.getByText('2 מתוך 3 שיעורים הושלמו')).toBeVisible();
    await expect(page.getByRole('link', { name: /להמשיך ללמוד/ })).toHaveAttribute('href', `/learning/lessons/${state.lessons['אנרגיה']}`);

    // Dashboard and My Courses show the same real progress.
    await page.goto('/dashboard');
    await expect(page.getByLabel('התקדמות כללית 67%')).toBeVisible();
    await page.goto('/courses');
    await expect(page.getByRole('progressbar', { name: 'התקדמות בקורס פיזיקה E2E' })).toHaveAttribute('aria-valuenow', '67');
  });

  test('browses, searches and enrolls in a catalog course', async ({ page }) => {
    await login(page, owner);
    await page.getByRole('link', { name: 'קטלוג קורסים' }).click();
    await expect(page.getByRole('heading', { name: 'קטלוג קורסים', level: 1 })).toBeVisible();
    await expect(page.locator('.course-card')).toHaveCount(3);

    await page.getByRole('searchbox').fill('SQL');
    await expect(page.locator('.course-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'יסודות SQL' })).toBeVisible();
    await page.getByRole('searchbox').fill('');
    await page.getByLabel('קטגוריה').selectOption('בינה מלאכותית');
    await expect(page.locator('.course-card')).toHaveCount(1);
    await page.getByLabel('קטגוריה').selectOption('');

    await page.getByRole('button', { name: 'הרשמה לקורס יסודות SQL' }).click();
    await expect(page.getByText('✓ רשומים לקורס')).toBeVisible();

    await page.getByRole('link', { name: 'הקורסים שלי' }).click();
    const catalogSection = page.getByRole('region', { name: 'קורסים מהקטלוג' });
    await expect(catalogSection.getByText('יסודות SQL')).toBeVisible();
    await catalogSection.getByRole('link', { name: 'פרטי הקורס' }).click();
    await expect(page.getByText('✓ רשומים לקורס')).toBeVisible();
    await expect(page.getByRole('link', { name: /עריכת הקורס/ })).toHaveCount(0);
    await expect(page.getByText(/עדיין ללא סרטון/)).toBeVisible();
  });

  test('another user cannot see or change the private course, lessons, video or progress', async ({ page }) => {
    await login(page, stranger);
    await page.goto('/courses');
    await expect(page.getByText('עדיין לא יצרתם קורס אישי')).toBeVisible();
    await expect(page.getByText('פיזיקה E2E')).toHaveCount(0);

    await page.goto(`/courses/${state.courseId}`);
    await expect(page.getByRole('alert')).toContainText('הפריט לא נמצא, או שאין לכם גישה אליו.');
    await page.goto(`/courses/${state.courseId}/edit`);
    await expect(page.getByRole('alert')).toContainText('הפריט לא נמצא');
    await page.goto(`/learning/lessons/${state.lessons['תנועה']}`);
    await expect(page.getByRole('alert')).toContainText('הפריט לא נמצא');

    const api = page.request;
    expect((await api.patch(`/api/courses/${state.courseId}`, { data: { title: 'נפרץ' } })).status()).toBe(404);
    expect((await api.delete(`/api/courses/${state.courseId}`)).status()).toBe(404);
    expect((await api.put(`/api/lessons/${state.lessons['תנועה']}/progress`, { data: { positionSeconds: 1, ended: true } })).status()).toBe(404);
    expect((await api.post(`/api/lessons/${state.lessons['כוחות']}/complete`)).status()).toBe(404);
    const ownerContext = await api.get(`/api/lessons/${state.lessons['תנועה']}`);
    expect(ownerContext.status()).toBe(404);

    // The owner's course is intact.
    await page.goto('/courses');
    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, owner);
    await page.goto(`/courses/${state.courseId}`);
    await expect(page.getByRole('heading', { name: 'פיזיקה E2E', level: 1 })).toBeVisible();
    await expect(page.getByText('2 מתוך 3 שיעורים הושלמו')).toBeVisible();
  });
});
