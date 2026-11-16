// Catalog videos: external pages are opened on their site (no tracking, no
// ReplayAI), direct files show attribution and a helpful message when a
// filter blocks them, and editors choose the page type explicitly.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from '../courses/testing/fakeCoursesApi.js';

const SOURCE = {
  sourceName: 'CS50 SQL, Lecture 0: Querying',
  sourceUrl: 'https://cs50.harvard.edu/sql/2024/weeks/0/',
  license: 'CC BY-NC-SA 4.0',
};
const PAGE = { sourceType: 'external', provider: 'page', url: SOURCE.sourceUrl, embedUrl: null, trackable: false, ...SOURCE };
const DIRECT = {
  sourceType: 'external', provider: 'direct', url: 'https://cdn.cs50.net/sql/2023/x/lectures/0/lecture0-720p.mp4',
  embedUrl: null, trackable: true, ...SOURCE,
};

let api;

function open(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('external catalog videos', { timeout: 20_000 }, () => {
  let course;

  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    api = createFakeCoursesApi();
    course = api.addCourse({ title: 'יסודות SQL', type: 'catalog' });
    api.enroll(course.id);
    vi.stubGlobal('fetch', vi.fn((url, options) => api.fetch(url, options)));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('opens an external video page on its site and explains what is not available', async () => {
    const user = userEvent.setup({ delay: null });
    const lesson = api.addLesson(course.id, { title: 'שליפת נתונים עם SELECT', video: PAGE });
    open(`/learning/lessons/${lesson.id}`);

    const link = await screen.findByRole('link', { name: /פתיחת הסרטון באתר החיצוני/ }, { timeout: 5000 });
    expect(link).toHaveAttribute('href', SOURCE.sourceUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByLabelText(/^נגן וידאו: /)).not.toBeInTheDocument(); // a page is never played as a video
    expect(screen.getByText(/ReplayAI המסונכרן למעקב הקשב אינו זמין/)).toBeInTheDocument();
    expect(screen.getByText(/נפתח באתר חיצוני, ולכן FocusMind אינו יודע/)).toBeInTheDocument();
    expect(screen.getByText(/מקור: CS50 SQL, Lecture 0: Querying/)).toHaveTextContent('רישיון CC BY-NC-SA 4.0');

    // Timer is started manually and the lesson is completed manually.
    await user.click(screen.getByRole('button', { name: 'הפעלת שעון המפגש' }));
    await waitFor(() => expect(api.requests.some((request) => request.url === '/api/learning-sessions')).toBe(true));
    await user.click(screen.getByRole('button', { name: 'סימון השיעור כהושלם' }));
    expect(await screen.findByText('השיעור הושלם.')).toBeInTheDocument();
  });

  it('shows a helpful message when a filter blocks a direct video file', async () => {
    const lesson = api.addLesson(course.id, { title: 'שליפת נתונים', video: DIRECT });
    open(`/learning/lessons/${lesson.id}`);
    const video = await screen.findByLabelText(/^נגן וידאו: /, {}, { timeout: 5000 });
    expect(video).toHaveAttribute('src', DIRECT.url);
    fireEvent.error(video);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('סינון אינטרנט (למשל NetFree)');
    expect(within(alert).getByRole('link', { name: /פתיחת עמוד המקור/ })).toHaveAttribute('href', SOURCE.sourceUrl);
  });

  it('labels external pages on the course page and shows their link even before enrolling', async () => {
    const catalog = api.addCourse({ title: 'קורס לא רשום', type: 'catalog' });
    api.addLesson(catalog.id, { title: 'שליפת נתונים', video: PAGE });
    open(`/courses/${catalog.id}`);
    expect(await screen.findByText(/סרטון באתר חיצוני/, {}, { timeout: 5000 })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /פתיחת הסרטון באתר החיצוני \(CS50 SQL, Lecture 0: Querying\)/ });
    expect(link).toHaveAttribute('href', SOURCE.sourceUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('marks demonstration videos and keeps the full lecture as a reference', async () => {
    const reference = { name: 'CS50 SQL, Lecture 0: Querying', url: SOURCE.sourceUrl, license: 'CC BY-NC-SA 4.0' };
    const demo = { sourceType: 'upload', url: '/api/videos/abc/stream', originalName: 'סרטון הדגמה', trackable: true, demo: true };
    const lesson = api.addLesson(course.id, { title: 'שליפת נתונים עם SELECT', video: demo, reference, durationSeconds: 90 });
    open(`/courses/${course.id}`);
    expect(await screen.findByText(/סרטון הדגמה \(מתנגן כאן\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ההרצאה המלאה באתר המקור: CS50 SQL/ })).toHaveAttribute('href', SOURCE.sourceUrl);
    cleanup();

    open(`/learning/lessons/${lesson.id}`);
    const video = await screen.findByLabelText(/^נגן וידאו: /, {}, { timeout: 5000 });
    expect(video).toHaveAttribute('src', '/api/videos/abc/stream'); // played inside FocusMind, through the backend
    expect(screen.getByText('סרטון הדגמה', { selector: '.lesson-demo-badge' })).toBeInTheDocument();
    expect(screen.getByText(/זו לא הרצאה מלאה/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ההרצאה המלאה באתר המקור/ })).toHaveAttribute('href', SOURCE.sourceUrl);
    // Trackable: ReplayAI and bookmarks are available.
    expect(await screen.findByRole('button', { name: 'סימון הרגע הנוכחי' })).toBeInTheDocument();
  });

  it('lets an editor save a web page only as an explicit external page', async () => {
    const user = userEvent.setup({ delay: null });
    const personal = api.addCourse({ title: 'קורס שלי' });
    api.addLesson(personal.id, { title: 'שיעור' });
    open(`/courses/${personal.id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'פתיחת הסרטון והכלים של השיעור שיעור' }));
    await user.click(screen.getByRole('radio', { name: 'קישור חיצוני' }));
    await user.type(screen.getByLabelText('קישור לסרטון'), 'https://example.org/lesson-page');
    await user.click(screen.getByRole('button', { name: 'שמירת הקישור' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument(); // not a video file

    await user.click(screen.getByRole('radio', { name: /עמוד אינטרנט שמציג את הסרטון/ }));
    await user.click(screen.getByRole('button', { name: 'שמירת הקישור' }));
    expect(await screen.findByText('הקישור נשמר.')).toBeInTheDocument();
    expect(api.lastBody('PUT', /video-url$/)).toEqual({ url: 'https://example.org/lesson-page', kind: 'page' });
    expect(screen.getAllByText(/עמוד וידאו חיצוני/).length).toBeGreaterThan(0);
  });
});
