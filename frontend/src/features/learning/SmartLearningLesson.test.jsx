// Smart Learning as the course lesson player, end to end through App routing
// with a fake courses backend and a simulated camera (MediaPipe mocked).
// This verifies the integration, not real webcam accuracy.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { createFakeCoursesApi } from '../courses/testing/fakeCoursesApi.js';
import { seededRandom, simulatedUser } from '../attention-engine/testing/syntheticFace.js';

const scene = vi.hoisted(() => ({ user: null, random: null }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  FaceLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: () => scene.user.lookAt(0.2 + scene.random() * 0.6, 0.2 + scene.random() * 0.6),
      close: vi.fn(),
    })),
  },
}));

// Playback state of every <video> element, controlled by the test.
const media = { currentTime: 0, duration: 120, paused: true, playbackRate: 1 };
const DIRECT = { sourceType: 'external', provider: 'direct', url: 'https://cdn.example.com/lesson.mp4', embedUrl: null, trackable: true };

let api;

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Plays the lesson video for `ms`, moving the media clock like a browser. */
async function watch(video, ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += 250) {
    media.currentTime = Math.min(media.duration, media.currentTime + 0.25 * media.playbackRate);
    fireEvent.timeUpdate(video);
    await advance(250);
  }
}

function openLesson(lessonId) {
  window.history.pushState({}, '', `/learning/lessons/${lessonId}`);
  return render(<App />);
}

describe('Smart Learning lesson player', () => {
  // The engine imports MediaPipe lazily; loading the (mocked) module once up
  // front keeps that real I/O out of the fake-timer timeline.
  beforeAll(async () => {
    await import('@mediapipe/tasks-vision');
  });

  let course;
  let first;
  let second;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    scene.user = simulatedUser({ seed: 3 });
    scene.random = seededRandom(5);
    Object.assign(media, { currentTime: 0, duration: 120, paused: true, playbackRate: 1 });
    // The lesson player follows `media`; the camera preview behaves like a live camera.
    const isPlayer = (element) => (element.getAttribute('aria-label') || '').startsWith('נגן וידאו');
    const camera = { duration: Infinity, paused: false, playbackRate: 1 };
    ['duration', 'paused', 'playbackRate'].forEach((name) => {
      Object.defineProperty(HTMLMediaElement.prototype, name, {
        configurable: true,
        get() { return isPlayer(this) ? media[name] : camera[name]; },
        set(value) { if (isPlayer(this)) media[name] = value; },
      });
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return isPlayer(this) ? media.currentTime : performance.now() / 1000; },
      set(value) { if (isPlayer(this)) media.currentTime = value; },
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { configurable: true, get: () => 4 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getVideoTracks: () => [track], getTracks: () => [track] })) },
    });

    api = createFakeCoursesApi();
    course = api.addCourse({ title: 'פיזיקה' });
    first = api.addLesson(course.id, { title: 'תנועה', video: DIRECT, durationSeconds: 120 });
    second = api.addLesson(course.id, { title: 'כוחות', video: DIRECT });
    vi.stubGlobal('fetch', vi.fn((url, options) => api.fetch(url, options)));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    ['duration', 'paused', 'playbackRate', 'currentTime'].forEach((name) => delete HTMLMediaElement.prototype[name]);
    ['readyState', 'videoWidth', 'videoHeight'].forEach((name) => delete HTMLVideoElement.prototype[name]);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('plays a lesson with the attention monitor, saves progress, resumes after leaving and completes', async () => {
    const { unmount } = openLesson(first.id);
    await advance(50);
    expect(screen.getByRole('heading', { name: 'תנועה', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פיזיקה' })).toHaveAttribute('href', `/courses/${course.id}`);
    expect(screen.getByText(/שיעור 1 מתוך 2/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /חזרה לקורס/ })).toHaveAttribute('href', `/courses/${course.id}`);
    expect(screen.getByRole('link', { name: /השיעור הבא/ })).toHaveAttribute('href', `/learning/lessons/${second.id}`);

    // Opening the lesson does not create progress.
    const video = screen.getByLabelText('נגן וידאו: תנועה');
    expect(video).toHaveAttribute('src', DIRECT.url);
    fireEvent.loadedMetadata(video);
    expect(api.requests.some((request) => request.url.endsWith('/progress'))).toBe(false);

    // The webcam attention monitor still initializes and adapts automatically.
    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    await advance(500); // camera + model loading settle
    await advance(4000); // automatic adaptation, no calibration
    expect(screen.getByRole('status', { name: 'מצב הקשב' })).toHaveTextContent('מבט לכיוון המסך');

    // Watch part of the video: a throttled save happens while playing.
    media.paused = false;
    fireEvent.playing(video);
    await watch(video, 12_000);
    const periodic = api.lastBody('PUT', /\/progress$/);
    expect(periodic.positionSeconds).toBeGreaterThanOrEqual(10);
    expect(periodic.ended).toBe(false);
    const savesWhilePlaying = api.requests.filter((request) => request.url.endsWith('/progress')).length;
    expect(savesWhilePlaying).toBeLessThanOrEqual(2); // throttled, not one per timeupdate

    // Pause saves immediately and sends attention segments with video time.
    media.paused = true;
    fireEvent.pause(video);
    await advance(50);
    const saved = api.progress.get(first.id);
    expect(saved.positionSeconds).toBeCloseTo(media.currentTime, 1);
    expect(saved.completed).toBe(false);
    const [session] = [...api.sessions.values()];
    expect(session.lessonId).toBe(first.id);
    expect(session.segments.length).toBeGreaterThan(0);
    session.segments.forEach((segment) => {
      expect(['ON_SCREEN', 'OFF_SCREEN', 'FACE_ABSENT', 'UNCERTAIN', 'NOT_MEASURED']).toContain(segment.state);
      expect(segment.videoEnd).toBeGreaterThanOrEqual(segment.videoStart);
      expect(segment.videoEnd).toBeLessThanOrEqual(media.currentTime + 0.01);
    });
    expect(session.segments.some((segment) => segment.state === 'ON_SCREEN')).toBe(true);

    // Leave the page: the session is ended with keepalive requests.
    const position = saved.positionSeconds;
    unmount();
    await advance(50);
    expect(session.ended).toBeGreaterThan(0);
    expect(api.requests.find((request) => request.url.endsWith('/end')).keepalive).toBe(true);

    // Return: playback resumes from the saved position.
    media.currentTime = 0;
    openLesson(first.id);
    await advance(50);
    const again = screen.getByLabelText('נגן וידאו: תנועה');
    fireEvent.loadedMetadata(again);
    expect(media.currentTime).toBeCloseTo(position, 1);
    expect(screen.getByText(/ממשיכים מהמקום שבו עצרתם/)).toBeInTheDocument();
    expect(screen.getByText(/ההתקדמות נשמרה בנקודה/)).toBeInTheDocument();

    // Watch to the end: the lesson is completed.
    media.paused = false;
    fireEvent.playing(again);
    await watch(again, 1000);
    media.currentTime = 120;
    media.paused = true;
    fireEvent.ended(again);
    await advance(50);
    expect(api.lastBody('PUT', /\/progress$/)).toMatchObject({ ended: true });
    expect(api.progress.get(first.id).completed).toBe(true);
    expect(screen.getByText('השיעור הושלם.')).toBeInTheDocument();

    // Course progress reflects the completed lesson.
    cleanup();
    window.history.pushState({}, '', `/courses/${course.id}`);
    render(<App />);
    await advance(50);
    expect(screen.getByRole('progressbar', { name: 'התקדמות כוללת בקורס' })).toHaveAttribute('aria-valuenow', '50');
    expect(within(screen.getByRole('list')).getByText('הושלם')).toBeInTheDocument();
  }, 30_000);

  it('asks to enroll before learning a catalog lesson', async () => {
    const catalog = api.addCourse({ title: 'יסודות SQL', type: 'catalog' });
    const lesson = api.addLesson(catalog.id, { title: 'SELECT', video: DIRECT });
    openLesson(lesson.id);
    await advance(50);
    expect(screen.getByText('כדי ללמוד את השיעור צריך להירשם לקורס.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/נגן וידאו:/)).not.toBeInTheDocument();
    // The attention monitor stays available on the page.
    expect(screen.getByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
  });

  it('embeds YouTube lessons, runs the timer manually and completes them manually', async () => {
    const lesson = api.addLesson(course.id, {
      title: 'אנרגיה',
      video: { sourceType: 'external', provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', trackable: false },
    });
    openLesson(lesson.id);
    await advance(50);
    expect(screen.getByTitle('סרטון YouTube: אנרגיה')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/'));
    expect(screen.getByText('מיקום הצפייה אינו נשמר בסרטון מסוג זה.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת שעון המפגש' }));
    await advance(2100);
    expect(screen.getByLabelText('זמן למידה פעיל 00:00:02')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'סימון השיעור כהושלם' }));
    await advance(50);
    expect(screen.getByText('השיעור הושלם.')).toBeInTheDocument();
    expect(api.requests.some((request) => request.url.endsWith('/progress') && request.method === 'PUT')).toBe(false);
  });

  it('explains lessons without a video and playback errors from external hosts', async () => {
    const empty = api.addLesson(course.id, { title: 'בקרוב' });
    const { unmount } = openLesson(empty.id);
    await advance(50);
    expect(screen.getByText('לשיעור הזה עדיין אין סרטון.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'הוספת סרטון לשיעור' })).toBeInTheDocument();
    unmount();

    openLesson(second.id);
    await advance(50);
    fireEvent.error(screen.getByLabelText('נגן וידאו: כוחות'));
    expect(screen.getByRole('alert')).toHaveTextContent('ייתכן שהאתר המארח חוסם ניגון');
  });
});
