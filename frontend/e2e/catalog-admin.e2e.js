// Catalog management by a content manager, in a real browser. The role is
// granted with the real command-line tool (python -m app.admin) against the
// isolated e2e database only; nobody gets it through the API.

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

const RUN = `a${Date.now().toString(36)}`;
const PASSWORD = 'e2e-password-123';
const manager = { name: 'מנהלת תוכן', email: `manager-${RUN}@example.com` };
const learner = { name: 'לומד קטלוג', email: `catalog-learner-${RUN}@example.com` };
const TITLE = `סטטיסטיקה ${RUN}`;

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(user.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`ברוך שובך, ${user.name}`) })).toBeVisible();
}

test('a content manager creates, fills and publishes a catalog course that learners then see', async ({ page }) => {
  for (const user of [manager, learner]) {
    const response = await page.request.post('/api/auth/register', {
      data: { displayName: user.name, email: user.email, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(response.status()).toBe(201);
  }

  // Before the role is granted the manager is an ordinary learner.
  await login(page, manager);
  await expect(page.getByRole('link', { name: 'ניהול הקטלוג' })).toHaveCount(0);
  expect((await page.request.get('/api/admin/catalog')).status()).toBe(403);

  const output = execFileSync(python, ['-m', 'app.admin', 'grant', manager.email], {
    cwd: backendDir, env: { ...process.env, MONGO_DB_NAME: E2E_DATABASE }, encoding: 'utf-8',
  });
  expect(output).toContain('content manager');

  await page.reload();
  await page.getByRole('link', { name: 'ניהול הקטלוג' }).click();
  await expect(page.getByRole('heading', { name: 'ניהול קטלוג הקורסים' })).toBeVisible();
  const form = page.getByRole('form', { name: 'קורס קטלוג חדש' });
  await form.getByLabel('שם הקורס').fill(TITLE);
  await form.getByLabel('קטגוריה').fill('נתונים');
  await form.getByRole('button', { name: 'יצירת טיוטה והוספת שיעורים' }).click();

  // The existing course editor manages catalog lessons and videos.
  await expect(page).toHaveURL(/\/courses\/.+\/edit$/);
  const addForm = page.getByRole('form', { name: 'הוספת שיעור' });
  await addForm.getByLabel('שם השיעור').fill('ממוצע וחציון');
  await addForm.getByRole('button', { name: 'הוספת השיעור' }).click();
  await expect(page.getByText('ממוצע וחציון').first()).toBeVisible();

  // Draft: invisible to learners.
  await page.goto('/admin/catalog');
  const row = page.getByRole('row', { name: new RegExp(TITLE) });
  await expect(row).toContainText('טיוטה (מוסתר)');
  await expect(row).toContainText('יוצג ״אין עדיין סרטון״');
  const browser = page.context().browser();
  const other = await browser.newContext({ baseURL: 'http://localhost:3010' });
  const learnerPage = await other.newPage();
  await login(learnerPage, learner);
  await learnerPage.goto('/courses/catalog');
  await expect(learnerPage.getByRole('heading', { name: 'קטלוג קורסים', level: 1 })).toBeVisible();
  await expect(learnerPage.getByText(TITLE)).toHaveCount(0);

  await row.getByRole('button', { name: 'פרסום בקטלוג' }).click();
  await expect(row).toContainText('מפורסם');

  await learnerPage.reload();
  await expect(learnerPage.getByRole('link', { name: TITLE })).toBeVisible();
  expect((await learnerPage.request.get('/api/admin/catalog')).status()).toBe(403);
  await learnerPage.getByRole('link', { name: TITLE }).click();
  await expect(learnerPage.getByText('אין עדיין סרטון')).toBeVisible();
  await other.close();

  // Unpublish again so other suites see the catalog exactly as seeded.
  await row.getByRole('button', { name: 'הסתרה מהקטלוג' }).click();
  await expect(row).toContainText('טיוטה (מוסתר)');
});
