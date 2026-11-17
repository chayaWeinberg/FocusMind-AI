// The expanded catalog: difficulty, demo courses, lesson sources with a
// visible "watch" link and an honest accessibility status.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from './testing/fakeCoursesApi.js';

const PAGE = 'https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/what-is-javascript-2-of-51/';
const resource = (overrides = {}) => ({
  provider: 'Microsoft Learn',
  sourceTitle: 'What is JavaScript [2 of 51]',
  language: 'en',
  license: 'Microsoft Learn terms of use',
  pageUrl: PAGE,
  youtubeUrl: null,
  directUrl: null,
  durationSeconds: 212,
  netfree: { status: 'page_only', detail: 'page HTTP 200; no video playback on the page', checkedAt: '2026-11-17' },
  ...overrides,
});

let api;

function open(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('catalog library', { timeout: 20_000 }, () => {
  beforeEach(() => {
    api = createFakeCoursesApi();
    vi.stubGlobal('fetch', vi.fn((url, options) => api.fetch(url, options)));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('shows difficulty, demo courses, totals and filters by level', async () => {
    const user = userEvent.setup({ delay: null });
    const js = api.addCourse({ title: 'JavaScript', type: 'catalog', category: 'פיתוח ווב', difficulty: 'beginner' });
    api.addLesson(js.id, { title: 'מהי JavaScript' });
    api.addLesson(js.id, { title: 'משתנים' });
    const react = api.addCourse({ title: 'React', type: 'catalog', category: 'פיתוח ווב', difficulty: 'intermediate' });
    api.addLesson(react.id, { title: 'קומפוננטות' });
    api.addCourse({ title: 'Python בפועל', type: 'catalog', category: 'תכנות', difficulty: 'beginner', academy: true });
    open('/courses/catalog');

    expect(await screen.findByText('3 קורסים · 3 שיעורים')).toBeInTheDocument();
    const reactCard = screen.getByRole('article', { name: 'React' });
    expect(within(reactCard).getByText('רמה: בינוני')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Python בפועל' })).getByText('FocusMind Academy · למידה חכמה מלאה')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('רמה'), 'intermediate');
    await waitFor(() => expect(screen.queryByRole('article', { name: 'JavaScript' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'React' })).toBeInTheDocument();
    expect(screen.getByText('1 קורסים · 1 שיעורים')).toBeInTheDocument();
  });

  it('lists every lesson with its source and a visible watch link, before enrolling too', async () => {
    const course = api.addCourse({ title: 'JavaScript', type: 'catalog', difficulty: 'beginner' });
    const page = { sourceType: 'external', provider: 'page', url: PAGE, embedUrl: null, trackable: false };
    api.addLesson(course.id, { title: 'מהי JavaScript', description: 'איפה JavaScript רצה.', video: page, resource: resource() });
    api.addLesson(course.id, {
      title: 'חיפוש בינארי', video: page,
      resource: resource({
        provider: 'Harvard CS50', sourceTitle: 'CS50x 2024 - Binary Search', pageUrl: 'https://cs50.harvard.edu/x/2024/shorts/binary_search/',
        youtubeUrl: 'https://www.youtube.com/watch?v=T98PIp4omUA', durationSeconds: 571, license: 'CC BY-NC-SA 4.0',
        netfree: { status: 'unverified', detail: null, checkedAt: null },
      }),
    });
    open(`/courses/${course.id}`);

    const rows = await screen.findAllByRole('listitem');
    const first = within(rows[0]);
    expect(first.getByText('1. מהי JavaScript')).toBeInTheDocument();
    expect(first.getByText('איפה JavaScript רצה.')).toBeInTheDocument();
    expect(first.getByText('Microsoft Learn')).toBeInTheDocument();
    expect(first.getByText(/3:32/)).toBeInTheDocument();
    expect(first.getByText('נבדק ב-NetFree: העמוד נפתח, הסרטון חסום')).toBeInTheDocument();
    const watch = first.getByRole('link', { name: /צפייה בסרטון של השיעור מהי JavaScript/ });
    expect(watch).toHaveAttribute('href', PAGE);
    expect(watch).toHaveAttribute('target', '_blank');
    expect(watch).toHaveAttribute('rel', 'noopener noreferrer');

    const second = within(rows[1]);
    expect(second.getByText('לא נבדק ברשת זו')).toBeInTheDocument();
    expect(second.getByRole('link', { name: /YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=T98PIp4omUA');
  });

  it('explains on the lesson page what works with an external video', async () => {
    const course = api.addCourse({ title: 'JavaScript', type: 'catalog' });
    api.enroll(course.id);
    const page = { sourceType: 'external', provider: 'page', url: PAGE, embedUrl: null, trackable: false, sourceName: 'What is JavaScript [2 of 51]' };
    const lesson = api.addLesson(course.id, { title: 'מהי JavaScript', video: page, resource: resource() });
    open(`/learning/lessons/${lesson.id}`);
    expect(await screen.findByRole('link', { name: /פתיחת הסרטון באתר החיצוני/ }, { timeout: 5000 })).toHaveAttribute('href', PAGE);
    expect(screen.getByText(/Microsoft Learn · אנגלית · 3:32 · נבדק ב-NetFree: העמוד נפתח, הסרטון חסום/)).toBeInTheDocument();
    expect(screen.getByText(/בחרו בקורסי FocusMind Academy, שהשיעורים שלהם מתנגנים כאן/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /חזרה לקורס/ })).toBeInTheDocument();
  });
});
