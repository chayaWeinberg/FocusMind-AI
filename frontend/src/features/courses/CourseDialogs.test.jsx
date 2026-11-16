// Regression tests: course and lesson dialogs close only after a confirmed
// save, refresh what is shown, keep input on errors, ignore double clicks and
// reopen with current values.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from './testing/fakeCoursesApi.js';

let api;
let intercept; // (url, options) => response | Promise<response> | null

function openApp(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

const failure = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe('course and lesson dialogs', { timeout: 20_000 }, () => {
  beforeEach(() => {
    api = createFakeCoursesApi();
    intercept = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const custom = intercept && (await intercept(url, options));
      return custom || api.fetch(url, options);
    }));
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a course: closes the dialog, refreshes the list and shows a notice', async () => {
    const user = userEvent.setup({ delay: null });
    openApp('/courses');
    await screen.findByText('עדיין לא יצרתם קורס אישי');
    await user.click(screen.getByRole('button', { name: /יצירת קורס אישי/ }));
    const dialog = within(screen.getByRole('dialog', { name: 'יצירת קורס אישי' }));
    await user.type(dialog.getByLabelText('שם הקורס'), 'גאומטריה');
    await user.type(dialog.getByLabelText('קטגוריה'), 'מתמטיקה');
    await user.click(dialog.getByRole('button', { name: 'יצירת הקורס' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('הקורס ״גאומטריה״ נוצר.');
    const section = within(screen.getByRole('region', { name: 'קורסים אישיים' }));
    expect(await section.findByRole('link', { name: 'גאומטריה' })).toBeInTheDocument();
    expect(screen.queryByText('עדיין לא יצרתם קורס אישי')).not.toBeInTheDocument();

    // Reopening starts empty: no stale values from the previous course.
    await user.click(screen.getByRole('button', { name: /יצירת קורס אישי/ }));
    expect(within(screen.getByRole('dialog')).getByLabelText('שם הקורס')).toHaveValue('');
  });

  it('keeps the dialog open with the error and the typed values when saving fails', async () => {
    const user = userEvent.setup({ delay: null });
    intercept = (url, options) => (url === '/api/courses' && options.method === 'POST' ? failure(503, 'down') : null);
    openApp('/courses/new');
    const dialog = within(await screen.findByRole('dialog', { name: 'יצירת קורס אישי' }));
    await user.type(dialog.getByLabelText('שם הקורס'), 'ביולוגיה');
    await user.type(dialog.getByLabelText('תיאור'), 'תאים ורקמות');
    await user.click(dialog.getByRole('button', { name: 'יצירת הקורס' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('השירות אינו זמין כרגע');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dialog.getByLabelText('שם הקורס')).toHaveValue('ביולוגיה');
    expect(dialog.getByLabelText('תיאור')).toHaveValue('תאים ורקמות');
    expect(api.courses.size).toBe(0);

    // Retry succeeds once the server is back.
    intercept = null;
    await user.click(dialog.getByRole('button', { name: 'יצירת הקורס' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.pathname).toBe('/courses');
  });

  it('sends one request for repeated clicks and shows a loading state', async () => {
    const user = userEvent.setup({ delay: null });
    const pending = deferred();
    let posts = 0;
    intercept = async (url, options) => {
      if (url !== '/api/courses' || options.method !== 'POST') return null;
      posts += 1;
      await pending.promise;
      return null; // then answered by the fake backend
    };
    openApp('/courses/new');
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('שם הקורס'), 'כימיה');
    const submit = dialog.getByRole('button', { name: 'יצירת הקורס' });
    await user.click(submit);
    await user.click(submit);
    await user.keyboard('{Enter}');
    expect(posts).toBe(1);
    expect(dialog.getByRole('button', { name: 'יוצרים…' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'ביטול' })).toBeDisabled();
    // Escape is ignored while saving: the request is not abandoned.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.courses.size).toBe(1);
  });

  it('closes without saving with Cancel, the close button and Escape', async () => {
    const user = userEvent.setup({ delay: null });
    openApp('/courses/new');
    await user.type(within(await screen.findByRole('dialog')).getByLabelText('שם הקורס'), 'טיוטה');
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/courses');

    await user.click(screen.getByRole('button', { name: /יצירת קורס אישי/ }));
    await user.click(screen.getByRole('button', { name: 'סגירת החלון' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /יצירת קורס אישי/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('edits course details: closes, updates the page and reopens with the saved values', async () => {
    const user = userEvent.setup({ delay: null });
    const course = api.addCourse({ title: 'אלגברה', category: 'מתמטיקה', description: 'משוואות' });
    openApp(`/courses/${course.id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'עריכת פרטי הקורס' }));
    let dialog = within(screen.getByRole('dialog', { name: 'עריכת פרטי הקורס' }));
    expect(dialog.getByLabelText('שם הקורס')).toHaveValue('אלגברה');
    await user.clear(dialog.getByLabelText('שם הקורס'));
    await user.type(dialog.getByLabelText('שם הקורס'), 'אלגברה לינארית');
    await user.click(dialog.getByRole('button', { name: 'שמירת השינויים' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'אלגברה לינארית', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('פרטי הקורס נשמרו.');
    expect(api.courses.get(course.id).title).toBe('אלגברה לינארית');

    // Unsaved changes are discarded on cancel; reopening shows the server values.
    await user.click(screen.getByRole('button', { name: 'עריכת פרטי הקורס' }));
    dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('שם הקורס')).toHaveValue('אלגברה לינארית');
    await user.type(dialog.getByLabelText('שם הקורס'), ' טיוטה');
    await user.click(dialog.getByRole('button', { name: 'ביטול' }));
    await user.click(screen.getByRole('button', { name: 'עריכת פרטי הקורס' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('שם הקורס')).toHaveValue('אלגברה לינארית');
  });

  it('keeps the edit dialog open on an API error and edits from the course page', async () => {
    const user = userEvent.setup({ delay: null });
    const course = api.addCourse({ title: 'היסטוריה' });
    intercept = (url, options) => (url === `/api/courses/${course.id}` && options.method === 'PATCH' ? failure(422, []) : null);
    openApp(`/courses/${course.id}`);
    await user.click(await screen.findByRole('button', { name: 'עריכת פרטי הקורס' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('קטגוריה'), 'מדעי הרוח');
    await user.click(dialog.getByRole('button', { name: 'שמירת השינויים' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('חלק מהפרטים אינם תקינים.');
    expect(dialog.getByLabelText('קטגוריה')).toHaveValue('מדעי הרוח');

    intercept = null;
    await user.click(dialog.getByRole('button', { name: 'שמירת השינויים' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(/מדעי הרוח/)).toBeInTheDocument();
  });

  it('edits lesson details in a dialog that closes after saving', async () => {
    const user = userEvent.setup({ delay: null });
    const course = api.addCourse({ title: 'פיזיקה' });
    api.addLesson(course.id, { title: 'תנועה' });
    openApp(`/courses/${course.id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'עריכת פרטי השיעור תנועה' }));
    const dialog = within(screen.getByRole('dialog', { name: 'עריכת פרטי השיעור' }));
    await user.clear(dialog.getByLabelText('שם השיעור'));
    await user.click(dialog.getByRole('button', { name: 'שמירת השיעור' }));
    expect(dialog.getByText('שם השיעור חייב לכלול לפחות 2 תווים.')).toBeInTheDocument();
    await user.type(dialog.getByLabelText('שם השיעור'), 'תנועה במישור');
    await user.click(dialog.getByRole('button', { name: 'שמירת השיעור' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('השיעור ״תנועה במישור״ נשמר.');
    expect(screen.getByRole('button', { name: 'עריכת פרטי השיעור תנועה במישור' })).toBeInTheDocument();
  });
});
