// ReplayAI, Smart Timer, QuizFlow, FocusInsights, FocusCoach, AdaptiveStudy,
// privacy and catalog administration through App routing with a fake backend.
// The camera stays off here: these tests cover the learning features, not
// webcam accuracy.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from '../courses/testing/fakeCoursesApi.js';

const media = { currentTime: 0, duration: 300, paused: true, playbackRate: 1 };
const DIRECT = { sourceType: 'external', provider: 'direct', url: 'https://cdn.example.com/lesson.mp4', embedUrl: null, trackable: true };
const YOUTUBE = {
  sourceType: 'external', provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ',
  embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', trackable: false,
};

let api;
let extraRoutes;

function open(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

async function playerReady() {
  const video = await screen.findByLabelText(/^נגן וידאו: /);
  fireEvent.loadedMetadata(video);
  return video;
}

describe('learning features (fake backend)', { timeout: 20_000 }, () => {
  let course;
  let lesson;

  beforeEach(() => {
    Object.assign(media, { currentTime: 0, duration: 300, paused: true, playbackRate: 1 });
    ['duration', 'paused', 'playbackRate', 'currentTime'].forEach((name) => {
      Object.defineProperty(HTMLMediaElement.prototype, name, {
        configurable: true,
        get() { return media[name]; },
        set(value) { media[name] = value; },
      });
    });
    HTMLMediaElement.prototype.play = vi.fn(() => {
      media.paused = false;
      return Promise.resolve();
    });
    HTMLMediaElement.prototype.pause = vi.fn(() => {
      media.paused = true;
    });
    api = createFakeCoursesApi();
    course = api.addCourse({ title: 'פיזיקה' });
    lesson = api.addLesson(course.id, { title: 'תנועה', video: DIRECT, durationSeconds: 300 });
    extraRoutes = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options) => (extraRoutes && (await extraRoutes(url, options))) || api.fetch(url, options)));
  });

  afterEach(() => {
    cleanup();
    ['duration', 'paused', 'playbackRate', 'currentTime'].forEach((name) => delete HTMLMediaElement.prototype[name]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('lists ReplayAI suggestions and replays the exact interval in the existing player', async () => {
    const user = userEvent.setup({ delay: null });
    const item = api.addReplayItem({ lessonId: lesson.id, startSeconds: 30, endSeconds: 45 });
    open(`/learning/lessons/${lesson.id}`);
    await playerReady();

    const panel = within(await screen.findByRole('region', { name: 'ReplayAI – קטעים לחזרה' }));
    const card = within(await panel.findByRole('listitem', { name: /קטע מומלץ לחזרה 0:30–0:45/ }));
    expect(card.getByText('המבט הופנה מהמסך ברצף (כ-6 שניות).')).toBeInTheDocument();
    expect(card.getByText(/משך: 0:15/)).toBeInTheDocument();
    expect(card.getByText('ממתין לחזרה')).toBeInTheDocument();

    await user.click(card.getByRole('button', { name: /ניגון הקטע/ }));
    expect(media.currentTime).toBe(30);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByText(/מנגנים את הקטע ועוצרים בסופו/)).toBeInTheDocument();

    // Playing inside the interval continues; reaching its end pauses.
    media.currentTime = 40;
    fireEvent.timeUpdate(screen.getByLabelText(/^נגן וידאו: /));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    media.currentTime = 45.1;
    fireEvent.timeUpdate(screen.getByLabelText(/^נגן וידאו: /));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/הקטע הסתיים/)).toBeInTheDocument();

    // Replay again, then mark reviewed from the banner.
    await user.click(screen.getByRole('button', { name: 'ניגון חוזר' }));
    expect(media.currentTime).toBe(30);
    const banner = screen.getByText('מצב חזרה', { exact: true }).closest('.replay-banner');
    await user.click(within(banner).getByRole('button', { name: 'סימון כנבדק' }));
    await waitFor(() => expect(api.replayItems.get(item.id).status).toBe('reviewed'));
    expect(await panel.findByText('נבדק')).toBeInTheDocument();

    // Seeking away leaves replay mode; normal playback is untouched.
    await user.click(screen.getByRole('button', { name: 'ניגון חוזר' }));
    media.currentTime = 200;
    fireEvent.timeUpdate(screen.getByLabelText(/^נגן וידאו: /));
    await waitFor(() => expect(screen.queryByText('מצב חזרה', { exact: true })).not.toBeInTheDocument());
  });

  it('dismisses irrelevant suggestions and creates bookmarks from the current position', async () => {
    const user = userEvent.setup({ delay: null });
    const item = api.addReplayItem({ lessonId: lesson.id, startSeconds: 100, endSeconds: 110 });
    open(`/learning/lessons/${lesson.id}`);
    await playerReady();
    const panel = within(await screen.findByRole('region', { name: 'ReplayAI – קטעים לחזרה' }));
    await user.click(await panel.findByRole('button', { name: 'לא רלוונטי – הסתרה' }));
    await waitFor(() => expect(api.replayItems.get(item.id).status).toBe('dismissed'));
    expect(panel.queryByRole('listitem', { name: /1:40–1:50/ })).not.toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'הצגת 1 קטעים מוסתרים' }));
    expect(panel.getByRole('listitem', { name: /1:40–1:50/ })).toBeInTheDocument();

    media.currentTime = 12;
    await user.type(panel.getByPlaceholderText('הערה (לא חובה)'), 'נוסחה חשובה');
    await user.click(panel.getByRole('button', { name: 'סימון הרגע הנוכחי' }));
    expect(await panel.findByText('נשמרה סימנייה בנקודה 0:12.')).toBeInTheDocument();
    const bookmark = [...api.replayItems.values()].find((entry) => entry.kind === 'bookmark');
    expect(bookmark).toMatchObject({ startSeconds: 12, note: 'נוסחה חשובה' });

    // A range: start, keep watching, end.
    await user.click(panel.getByRole('button', { name: 'התחלת סימון קטע' }));
    media.currentTime = 50;
    await user.click(panel.getByRole('button', { name: 'סיום סימון הקטע' }));
    await waitFor(() => expect([...api.replayItems.values()].some((entry) => entry.kind === 'bookmark' && entry.endSeconds === 50)).toBe(true));
    expect(panel.getAllByText('סימנייה שלכם')).toHaveLength(2);
  });

  it('opens a suggestion from the review page directly at its interval', async () => {
    const user = userEvent.setup({ delay: null });
    const item = api.addReplayItem({ lessonId: lesson.id, startSeconds: 70, endSeconds: 82 });
    api.addReplayItem({ lessonId: lesson.id, startSeconds: 150, endSeconds: 160, status: 'reviewed' });
    open('/review');
    expect(await screen.findByRole('heading', { name: 'חזרה חכמה', level: 1 })).toBeInTheDocument();
    const group = within(await screen.findByRole('region', { name: 'פיזיקה – תנועה' }));
    expect(group.getAllByRole('listitem', { name: /קטע מומלץ/ })).toHaveLength(1); // pending filter

    await user.click(screen.getByRole('tab', { name: 'הכול' }));
    expect(await screen.findAllByRole('listitem', { name: /קטע מומלץ/ })).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'ממתינים לחזרה' }));
    const link = await screen.findByRole('link', { name: /לניגון הקטע בשיעור/ });
    expect(link).toHaveAttribute('href', `/learning/lessons/${lesson.id}/review/${item.id}`);

    await user.click(link);
    await playerReady();
    await waitFor(() => expect(media.currentTime).toBe(70));
    expect(await screen.findByText('מצב חזרה', { exact: true })).toBeInTheDocument();
  });

  it('shows a clear limitation for YouTube instead of invented timestamps', async () => {
    const tube = api.addLesson(course.id, { title: 'הרצאה', video: YOUTUBE });
    open(`/learning/lessons/${tube.id}`);
    expect(await screen.findByText(/הדף אינו יכול לקרוא את מיקום הצפייה/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'סימון הרגע הנוכחי' })).not.toBeInTheDocument();
  });

  it('runs breaks and saves the study rhythm in the Smart Timer', async () => {
    const user = userEvent.setup({ delay: null });
    open(`/learning/lessons/${lesson.id}`);
    await playerReady();
    const timer = within(screen.getByRole('region', { name: 'שעון למידה חכם' }));
    expect(timer.getByText('בלוק למידה של 25 דק׳')).toBeInTheDocument();
    await user.click(timer.getByRole('button', { name: 'התחלת הפסקה' }));
    expect(timer.getByText('בהפסקה')).toBeInTheDocument();
    await user.click(timer.getByRole('button', { name: 'סיום ההפסקה' }));
    await user.click(timer.getByRole('button', { name: 'הגדרות שעון' }));
    const study = timer.getByLabelText('דקות למידה לפני תזכורת להפסקה');
    await user.clear(study);
    await user.type(study, '40');
    await user.click(timer.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(api.preferences.studyMinutes).toBe(40));
    expect(await timer.findByText('בלוק למידה של 40 דק׳')).toBeInTheDocument();
  });

  it('creates a review question, grades answers and shows the mistakes', async () => {
    const user = userEvent.setup({ delay: null });
    api.addQuestion(lesson.id, { prompt: 'מהי מהירות?', options: ['מרחק חלקי זמן', 'מסה כפול תאוצה'], correctIndex: 0, explanation: 'v = d/t' });
    open(`/learning/lessons/${lesson.id}`);
    const quiz = within(await screen.findByRole('region', { name: 'QuizFlow – שאלות חזרה' }));
    await user.click(await quiz.findByRole('button', { name: 'ניהול השאלות' }));
    await user.type(quiz.getByLabelText('השאלה'), 'מהי תאוצה?');
    await user.type(quiz.getByLabelText('תשובה א'), 'שינוי מהירות');
    await user.type(quiz.getByLabelText('תשובה ב'), 'מרחק');
    await user.click(quiz.getByRole('button', { name: 'שמירת השאלה' }));
    await waitFor(() => expect(api.questions.size).toBe(2));
    await user.click(quiz.getByRole('button', { name: 'סיום עריכה' }));

    await user.click(quiz.getByRole('button', { name: 'מענה על השאלות' }));
    await user.click(quiz.getByRole('button', { name: 'בדיקת התשובות' }));
    expect(quiz.getByRole('alert')).toHaveTextContent('נשארו 2 שאלות בלי תשובה.');
    await user.click(quiz.getByRole('radio', { name: 'מסה כפול תאוצה' }));
    await user.click(quiz.getByRole('radio', { name: 'שינוי מהירות' }));
    await user.click(quiz.getByRole('button', { name: 'בדיקת התשובות' }));
    expect(await quiz.findByText(/ענית נכון על/)).toHaveTextContent('ענית נכון על 1 מתוך 2 שאלות (50%).');
    expect(quiz.getByText('התשובה הנכונה: ״מרחק חלקי זמן״')).toBeInTheDocument();
    expect(quiz.getByText('v = d/t')).toBeInTheDocument();

    await user.click(quiz.getByRole('button', { name: 'חזרה לשאלות החזרה' }));
    await user.click(quiz.getByRole('button', { name: 'חזרה על 1 טעויות מהניסיון האחרון' }));
    expect(quiz.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows insights from real data, with honest wording and an empty state', async () => {
    open('/insights');
    expect(await screen.findByText('עדיין אין נתוני למידה')).toBeInTheDocument();
    cleanup();

    const insights = await (await api.fetch('/api/insights')).json();
    insights.totals = { ...insights.totals, activeMs: 3_600_000, sessionCount: 3, lessonsCompleted: 2, activeMsToday: 1_200_000 };
    insights.daily[13].activeMs = 1_200_000;
    insights.attention = { ON_SCREEN: 600_000, OFF_SCREEN: 200_000, FACE_ABSENT: 100_000, UNCERTAIN: 50_000, NOT_MEASURED: 50_000 };
    insights.streak = { current: 3, longest: 5, activeToday: true };
    insights.byCourse = [{ courseId: course.id, title: 'פיזיקה', type: 'personal', activeMs: 3_600_000, completedLessons: 2, totalLessons: 4, percent: 50 }];
    api.setInsights(insights);
    open('/insights');
    expect(await screen.findByText('זמן למידה פעיל היום')).toBeInTheDocument();
    const tile = (label) => within(screen.getByText(label).closest('article'));
    expect(tile('זמן למידה פעיל היום').getByText('20 דק׳')).toBeInTheDocument();
    expect(tile('זמן למידה פעיל בסך הכול').getByText('1 שע׳')).toBeInTheDocument();
    expect(tile('ימי למידה ברצף').getByText('3')).toBeInTheDocument();
    const distribution = screen.getByRole('figure', { name: 'התפלגות מצבי המבט בזמן צפייה' });
    expect(within(distribution).getAllByText('מבט לכיוון המסך').length).toBeGreaterThan(0);
    expect(within(distribution).getAllByText('60%').length).toBeGreaterThan(0);
    expect(screen.getByText(/אינו ציון ריכוז/)).toBeInTheDocument();
    expect(screen.queryByText(/ציון ריכוז:/)).not.toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'זמן למידה והתקדמות לפי קורס' })).toHaveTextContent('פיזיקה');
  });

  it('lists sessions with their average concentration and opens their readings', async () => {
    const user = userEvent.setup({ delay: null });
    const insights = await (await api.fetch('/api/insights')).json();
    insights.totals = { ...insights.totals, activeMs: 60_000, sessionCount: 2 };
    const base = {
      lessonId: lesson.id, courseId: course.id, lessonTitle: 'תנועה', courseTitle: 'פיזיקה',
      startedAt: '2026-11-18T10:00:00Z', endedAt: '2026-11-18T10:01:00Z', lastSeenAt: '2026-11-18T10:01:00Z',
      activeMs: 60_000, breakMs: 0, videoSeconds: 60, trackable: true, status: 'ended',
    };
    insights.recentSessions = [
      { ...base, id: 'measured', segmentCount: 2, averageConcentration: 75 },
      { ...base, id: 'camera-off', segmentCount: 1, averageConcentration: null },
    ];
    api.setInsights(insights);
    extraRoutes = async (url) => (url === '/api/learning-sessions/measured' ? {
      ok: true,
      status: 200,
      json: async () => ({
        ...base, id: 'measured', segmentCount: 2,
        segments: [
          { seq: 0, sessionStartMs: 0, sessionEndMs: 30_000, videoStart: 0, videoEnd: 30, playbackRate: 1, state: 'ON_SCREEN', durationMs: 30_000, concentration: 90 },
          { seq: 1, sessionStartMs: 30_000, sessionEndMs: 40_000, videoStart: 30, videoEnd: 40, playbackRate: 1, state: 'OFF_SCREEN', durationMs: 10_000, concentration: 30 },
        ],
      }),
    } : null);

    open('/insights');
    const history = within((await screen.findByRole('heading', { name: 'היסטוריית מפגשים' })).closest('section'));
    expect(history.getByRole('columnheader', { name: 'ריכוז ממוצע (הערכה)' })).toBeInTheDocument();
    expect(history.getByText('75%')).toBeInTheDocument();
    expect(history.getByText('לא נמדד')).toBeInTheDocument();

    const [showReadings] = history.getAllByRole('button', { name: 'הצגת המדידות' });
    await user.click(showReadings);
    const readings = within(await history.findByRole('table', { name: 'המדידות של המפגש (2)' }));
    expect(readings.getByText('90%')).toBeInTheDocument();
    expect(readings.getByText('מבט מחוץ למסך')).toBeInTheDocument();
    await user.click(history.getByRole('button', { name: 'הסתרת המדידות' }));
    expect(history.queryByRole('table', { name: /המדידות של המפגש/ })).not.toBeInTheDocument();
  });

  it('sets a study goal, suggests the next session and explains coach tips', async () => {
    const user = userEvent.setup({ delay: null });
    api.setCoachTips([{
      kind: 'continue_lesson', priority: 75, lessonId: lesson.id, courseId: course.id, lessonTitle: 'תנועה',
      courseTitle: 'פיזיקה', evidence: { positionSeconds: 90, durationSeconds: 300, daysAgo: 2 },
    }]);
    open('/study');
    const coach = within(await screen.findByRole('region', { name: 'FocusCoach – המלצות אישיות' }));
    expect(await coach.findByText('להמשיך את ״תנועה״')).toBeInTheDocument();
    expect(coach.getByText(/עצרתם בדקה 1:30 מתוך 5:00, לפני 2 ימים/)).toBeInTheDocument();

    const form = await screen.findByRole('form', { name: 'מטרת לימוד' });
    const minutes = within(form).getByLabelText('כמה זמן פנוי יש לכם למפגש (דקות)');
    await user.clear(minutes);
    await user.type(minutes, '45');
    await user.click(within(form).getByRole('button', { name: 'שמירת המטרה' }));
    await waitFor(() => expect(api.goal).toMatchObject({ courseId: course.id, sessionMinutes: 45 }));
    const next = within(await screen.findByRole('region', { name: 'המפגש הבא המוצע (45 דקות)' }));
    expect(next.getByText('שיעור חדש')).toBeInTheDocument();
    expect(next.getByRole('link', { name: /להתחיל/ })).toHaveAttribute('href', `/learning/lessons/${lesson.id}`);
  });

  it('shows coach tips on the dashboard with their evidence', async () => {
    api.setCoachTips([{
      kind: 'review_flagged', priority: 80, lessonId: lesson.id, courseId: course.id, lessonTitle: 'תנועה',
      courseTitle: 'פיזיקה', evidence: { count: 2, seconds: 30, firstStart: 65 },
    }]);
    open('/dashboard');
    expect(await screen.findByText('קטעים לחזרה בשיעור ״תנועה״')).toBeInTheDocument();
    expect(screen.getByText(/2 קטעים ממתינים לחזרה, הראשון מ-1:05/)).toBeInTheDocument();
  });

  it('explains what is stored and deletes attention data only after confirmation', async () => {
    const user = userEvent.setup({ delay: null });
    const deletions = [];
    extraRoutes = async (url, options = {}) => {
      if (url === '/api/privacy/summary') {
        return { ok: true, status: 200, json: async () => ({ sessions: 4, segments: 120, suggestions: 3, bookmarks: 1, quizAttempts: 2, oldestSessionAt: '2026-10-01T10:00:00Z', retentionDays: 0 }) };
      }
      if (url.startsWith('/api/privacy/learning-data')) {
        deletions.push({ url, method: options.method });
        return { ok: true, status: 200, json: async () => ({ sessions: 4, segments: 120, suggestions: 3, bookmarks: 0, quizAttempts: 0 }) };
      }
      return null;
    };
    open('/privacy');
    expect(await screen.findByText(/תמונות מהמצלמה ונקודות פנים לא נשמרות/)).toBeInTheDocument();
    expect(await screen.findByText('מפגשי למידה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'מחיקת כל נתוני הקשב' }));
    expect(deletions).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'כן, למחוק הכול' }));
    expect(await screen.findByText(/נמחקו 4 מפגשים, 120 קטעי מדידה/)).toBeInTheDocument();
    expect(deletions).toEqual([{ url: '/api/privacy/learning-data', method: 'DELETE' }]);
  });

  it('shows catalog management only to content managers', async () => {
    open('/admin/catalog');
    expect(await screen.findByText('אין לכם הרשאה לנהל את הקטלוג')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ניהול הקטלוג' })).not.toBeInTheDocument();
    cleanup();

    api.user.role = 'content_manager';
    const draft = { id: 'cat1', title: 'סטטיסטיקה', category: 'נתונים', type: 'catalog', status: 'draft', lessonCount: 2, lessonsWithoutVideo: 1, enrollmentCount: 0 };
    let patched = null;
    extraRoutes = async (url, options = {}) => {
      if (url === '/api/admin/catalog') return { ok: true, status: 200, json: async () => [draft] };
      if (url === '/api/courses/cat1' && options.method === 'PATCH') {
        patched = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ ...draft, status: 'published' }) };
      }
      return null;
    };
    const user = userEvent.setup({ delay: null });
    open('/admin/catalog');
    expect(await screen.findByRole('link', { name: 'ניהול הקטלוג' })).toHaveAttribute('aria-current', 'page');
    const row = within((await screen.findByRole('link', { name: 'סטטיסטיקה' })).closest('tr'));
    expect(row.getByText('טיוטה (מוסתר)')).toBeInTheDocument();
    expect(row.getByText(/יוצג ״אין עדיין סרטון״/)).toBeInTheDocument();
    await user.click(row.getByRole('button', { name: 'פרסום בקטלוג' }));
    expect(await row.findByText('מפורסם')).toBeInTheDocument();
    expect(patched).toEqual({ status: 'published' });
  });

  it('shows review badges and quiz state on the course page', async () => {
    api.addReplayItem({ lessonId: lesson.id, startSeconds: 30, endSeconds: 45 });
    api.addQuestion(lesson.id, {});
    open(`/courses/${course.id}`);
    expect(await screen.findByText('1 קטעים לחזרה')).toBeInTheDocument();
    expect(screen.getByText('1 שאלות חזרה')).toBeInTheDocument();
    const section = within(await screen.findByRole('region', { name: 'קטעים לחזרה בקורס' }));
    expect(section.getByRole('link', { name: /תנועה/ })).toHaveAttribute('href', expect.stringContaining('/review/'));
  });
});
