import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from './testing/fakeCoursesApi.js';

let api;

function openApp(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('Courses screens (fake backend)', { timeout: 20_000 }, () => {
  beforeEach(() => {
    api = createFakeCoursesApi();
    vi.stubGlobal('fetch', vi.fn((url, options) => api.fetch(url, options)));
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows empty states on My Courses with links to create and browse', async () => {
    openApp('/courses');
    expect(await screen.findByRole('heading', { name: 'הקורסים שלי', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('עדיין לא יצרתם קורס אישי')).toBeInTheDocument();
    expect(screen.getByText('עדיין לא נרשמתם לקורסים מהקטלוג')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /יצירת קורס אישי/ })).toHaveAttribute('href', '/courses/new');
    expect(screen.getByRole('link', { name: 'הקורסים שלי' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists personal and enrolled courses with real progress and a continue button', async () => {
    const personal = api.addCourse({ title: 'אלגברה', category: 'מתמטיקה' });
    const first = api.addLesson(personal.id, { title: 'משוואות', video: { sourceType: 'external', provider: 'direct', url: 'https://cdn.example.com/a.mp4', trackable: true } });
    const second = api.addLesson(personal.id, { title: 'אי-שוויונות' });
    api.progress.set(first.id, { positionSeconds: 100, durationSeconds: 100, completed: true });
    const catalog = api.addCourse({ title: 'יסודות SQL', type: 'catalog', category: 'נתונים' });
    api.addLesson(catalog.id, { title: 'SELECT' });
    api.enroll(catalog.id);

    openApp('/courses');
    const personalSection = within(await screen.findByRole('region', { name: 'קורסים אישיים' }));
    expect(personalSection.getByText(/1 מתוך 2 שיעורים הושלמו/)).toBeInTheDocument();
    expect(personalSection.getByRole('progressbar', { name: 'התקדמות בקורס אלגברה' })).toHaveAttribute('aria-valuenow', '50');
    expect(personalSection.getByRole('link', { name: /להמשיך ללמוד/ })).toHaveAttribute('href', `/learning/lessons/${second.id}`);

    const catalogSection = within(screen.getByRole('region', { name: 'קורסים מהקטלוג' }));
    expect(catalogSection.getByText('יסודות SQL')).toBeInTheDocument();
    expect(catalogSection.getByRole('link', { name: /להתחיל ללמוד/ })).toBeInTheDocument();
  });

  it('searches and filters the catalog and enrolls without duplicates', async () => {
    const user = userEvent.setup({ delay: null });
    api.addCourse({ title: 'Python למתחילים', type: 'catalog', category: 'תכנות', description: 'משתנים ולולאות' });
    const sql = api.addCourse({ title: 'יסודות SQL', type: 'catalog', category: 'נתונים' });
    openApp('/courses/catalog');

    expect(await screen.findByText('Python למתחילים')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'SQL');
    await waitFor(() => expect(screen.queryByText('Python למתחילים')).not.toBeInTheDocument());
    expect(screen.getByText('יסודות SQL')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'קטגוריה' }), 'תכנות');
    await waitFor(() => expect(screen.queryByText('יסודות SQL')).not.toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox', { name: 'קטגוריה' }), '');

    await user.click(await screen.findByRole('button', { name: 'הרשמה לקורס יסודות SQL' }));
    expect(await screen.findByText('✓ רשומים לקורס')).toBeInTheDocument();
    expect(api.requests.filter((request) => request.url === `/api/courses/${sql.id}/enroll`)).toHaveLength(1);
  });

  it('creates a personal course, adds lessons with an external link, reorders and opens details', async () => {
    const user = userEvent.setup({ delay: null });
    openApp('/courses/new');
    await user.click(await screen.findByRole('button', { name: 'יצירת הקורס' }));
    expect(screen.getByText('שם הקורס חייב לכלול לפחות 2 תווים.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('שם הקורס'), 'פיזיקה');
    await user.type(screen.getByLabelText('קטגוריה'), 'מדעים');
    await user.click(screen.getByRole('button', { name: 'יצירת הקורס' }));
    expect(await screen.findByRole('heading', { name: 'פיזיקה', level: 1 })).toBeInTheDocument();
    const course = [...api.courses.values()][0];
    expect(window.location.pathname).toBe(`/courses/${course.id}/edit`);
    expect(course).toMatchObject({ title: 'פיזיקה', category: 'מדעים', type: 'personal' });

    const addForm = within(screen.getByRole('form', { name: 'הוספת שיעור' }));
    await user.type(addForm.getByLabelText('שם השיעור'), 'תנועה');
    await user.click(addForm.getByRole('button', { name: 'הוספת השיעור' }));
    expect(await screen.findByText('תנועה')).toBeInTheDocument();

    await user.type(addForm.getByLabelText('שם השיעור'), 'כוחות');
    await user.type(addForm.getByLabelText('קישור לסרטון (לא חובה)'), 'https://example.com/page');
    await user.click(addForm.getByRole('button', { name: 'הוספת השיעור' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('הקישור אינו נתמך');
    await user.clear(addForm.getByLabelText('קישור לסרטון (לא חובה)'));
    await user.type(addForm.getByLabelText('קישור לסרטון (לא חובה)'), 'https://cdn.example.com/forces.mp4');
    await user.click(addForm.getByRole('button', { name: 'הוספת השיעור' }));
    expect(await screen.findByText('כוחות')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'הזזת השיעור כוחות למעלה' }));
    await waitFor(() => {
      const items = screen.getAllByRole('listitem').map((item) => item.textContent);
      expect(items.findIndex((text) => text.includes('כוחות'))).toBeLessThan(items.findIndex((text) => text.includes('תנועה')));
    });
    expect(api.lastBody('PUT', /lessons\/order$/).lessonIds).toHaveLength(2);

    await user.click(screen.getByRole('link', { name: 'תצוגת הקורס' }));
    const lessonsList = within(await screen.findByRole('list'));
    expect(lessonsList.getByRole('link', { name: 'כוחות' })).toHaveAttribute('href', expect.stringMatching(/^\/learning\/lessons\//));
    expect(lessonsList.getByText('אין עדיין סרטון')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /להתחיל ללמוד/ })).toBeInTheDocument();
  });

  it('replaces a lesson video with a YouTube link and explains its limits', async () => {
    const user = userEvent.setup({ delay: null });
    const course = api.addCourse({ title: 'כימיה' });
    api.addLesson(course.id, { title: 'אטומים' });
    openApp(`/courses/${course.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'עריכת השיעור אטומים' }));
    await user.click(screen.getByRole('radio', { name: 'קישור חיצוני' }));
    await user.type(screen.getByLabelText('קישור לסרטון'), 'https://youtu.be/dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: 'שמירת הקישור' }));
    expect(await screen.findByText('הקישור נשמר.')).toBeInTheDocument();
    expect(screen.getByText(/אי אפשר לשמור את מיקום הצפייה/)).toBeInTheDocument();
  });

  it('shows catalog course details read-only until the user enrolls', async () => {
    const user = userEvent.setup({ delay: null });
    const course = api.addCourse({ title: 'מבוא לבינה מלאכותית', type: 'catalog' });
    api.addLesson(course.id, { title: 'מהי בינה מלאכותית' });
    openApp(`/courses/${course.id}`);

    expect(await screen.findByRole('heading', { name: 'מבוא לבינה מלאכותית', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /עריכת הקורס/ })).not.toBeInTheDocument();
    expect(screen.getByText(/עדיין ללא סרטון/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הרשמה לקורס' }));
    expect(await screen.findByText('✓ רשומים לקורס')).toBeInTheDocument();
  });

  it('reports a missing or private course without exposing details', async () => {
    openApp('/courses/abcdefabcdefabcdefabcdef');
    expect(await screen.findByRole('alert')).toHaveTextContent('הפריט לא נמצא, או שאין לכם גישה אליו.');
  });

  it('shows real course progress on the dashboard', async () => {
    const course = api.addCourse({ title: 'אלגברה' });
    const lesson = api.addLesson(course.id, { title: 'משוואות' });
    api.addLesson(course.id, { title: 'גרפים' });
    api.addLesson(course.id, { title: 'פונקציות' });
    api.addLesson(course.id, { title: 'סדרות' });
    api.progress.set(lesson.id, { completed: true, positionSeconds: 10 });
    openApp('/dashboard');
    expect(await screen.findByLabelText('התקדמות כללית 25%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'הקורסים שלי' })).toHaveAttribute('href', '/courses');
    expect(await screen.findByText('אלגברה')).toBeInTheDocument();
  });
});
