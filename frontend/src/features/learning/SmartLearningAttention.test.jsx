import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SmartLearningPage from './SmartLearningPage.jsx';
import { NO_FACE, seededRandom, simulatedUser } from '../attention-engine/testing/syntheticFace.js';

// MediaPipe is replaced by a simulated user whose gaze the test controls.
const scene = vi.hoisted(() => ({ mode: 'screen', user: null, random: null }));
const mediapipe = vi.hoisted(() => ({ close: vi.fn(), detectForVideo: vi.fn() }));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  FaceLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: mediapipe.detectForVideo,
      close: mediapipe.close,
    })),
  },
}));

const VIDEO_PROPERTIES = { readyState: 4, videoWidth: 640, videoHeight: 480, paused: false };

function createCameraStream() {
  const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getVideoTracks: () => [track], getTracks: () => [track] } };
}

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const attentionStatus = () => screen.getByRole('status', { name: 'מצב הקשב' });
const summary = () => within(screen.getByRole('region', { name: 'Focus Monitor' }));
const seconds = (label) => {
  const text = summary().getByLabelText(new RegExp(`^${label}:`)).getAttribute('aria-label');
  const [, minutes, secs] = text.match(/(\d\d):(\d\d)$/);
  return Number(minutes) * 60 + Number(secs);
};

describe('Smart Learning attention monitoring (simulated camera)', () => {
  let camera;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    scene.mode = 'screen';
    scene.user = simulatedUser({ seed: 9 });
    scene.random = seededRandom(21);
    mediapipe.detectForVideo.mockImplementation(() => {
      if (scene.mode === 'absent') return NO_FACE;
      if (scene.mode === 'away') return scene.user.lookAt(2.1, 0.5);
      if (scene.mode === 'eyes-closed') return scene.user.lookAt(0.5, 0.5, { eyeAspect: 0.05, blink: 1 });
      return scene.user.lookAt(0.2 + scene.random() * 0.6, 0.2 + scene.random() * 0.6);
    });
    Object.entries(VIDEO_PROPERTIES).forEach(([name, value]) => {
      Object.defineProperty(HTMLVideoElement.prototype, name, { configurable: true, get: () => value });
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
      configurable: true,
      get: () => performance.now() / 1000,
      set: () => {},
    });
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    camera = createCameraStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => camera.stream) },
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:lesson'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    ['readyState', 'videoWidth', 'videoHeight', 'paused', 'currentTime'].forEach((name) => {
      delete HTMLVideoElement.prototype[name];
    });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function openPageWithCamera() {
    render(<SmartLearningPage />);
    const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('בחירת סרטון מהמכשיר'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    await advance(200);
    return screen.getByLabelText('נגן וידאו: lesson.mp4');
  }

  it('needs no calibration: adapts within seconds and shows the live state', async () => {
    await openPageWithCamera();
    expect(attentionStatus()).toHaveTextContent('לא ניתן לקבוע בוודאות');
    expect(screen.getByText(/מתאימים את עצמנו למיקום שלכם/)).toBeInTheDocument();

    await advance(4000);
    expect(attentionStatus()).toHaveTextContent('מבט לכיוון המסך');
    expect(screen.getByLabelText(/^ודאות \d+%$/)).toBeInTheDocument();

    scene.mode = 'away';
    await advance(2000);
    expect(attentionStatus()).toHaveTextContent('מבט מחוץ למסך');

    scene.mode = 'absent';
    await advance(2500);
    expect(attentionStatus()).toHaveTextContent('לא זוהו פנים');
  });

  it('counts statistics only while the session timer runs', async () => {
    const lesson = await openPageWithCamera();
    await advance(4000); // adapted, but no session yet
    expect(screen.getByText(/הסטטיסטיקה תתחיל להיאסף/)).toBeInTheDocument();

    fireEvent.playing(lesson);
    await advance(20_000);
    scene.mode = 'away';
    await advance(10_000);
    fireEvent.pause(lesson);
    await advance(30_000); // paused: nothing is added

    expect(seconds('מבט לכיוון המסך')).toBeGreaterThanOrEqual(19);
    expect(seconds('מבט מחוץ למסך')).toBeGreaterThanOrEqual(8);
    expect(seconds('מבט לכיוון המסך') + seconds('מבט מחוץ למסך') + seconds('לא ניתן לקבוע בוודאות')).toBeLessThanOrEqual(31);
    expect(summary().getByText('יציאות מהמסך').nextSibling).toHaveTextContent('1');
    expect(screen.getByRole('img', { name: /ציר זמן של \d+ משבצות/ })).toBeInTheDocument();
  });

  it('counts session time without a camera as not measured, never as attention', async () => {
    render(<SmartLearningPage />);
    const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('בחירת סרטון מהמכשיר'), { target: { files: [file] } });
    fireEvent.playing(screen.getByLabelText('נגן וידאו: lesson.mp4'));
    expect(screen.getByText(/המפגש פעיל, אבל כיוון המבט אינו נמדד/)).toBeInTheDocument();
    await advance(10_000);

    expect(seconds('לא נמדד \\(מצלמה כבויה\\)')).toBeGreaterThanOrEqual(9);
    expect(seconds('מבט לכיוון המסך')).toBe(0);
    expect(seconds('מבט מחוץ למסך')).toBe(0);
  });

  it('resets statistics for a new session and releases the camera when turned off', async () => {
    const lesson = await openPageWithCamera();
    await advance(4000);
    fireEvent.playing(lesson);
    await advance(6000);
    fireEvent.click(screen.getByRole('button', { name: 'סיום מפגש' }));
    expect(seconds('מבט לכיוון המסך')).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /התחלת מפגש חדש/ }));
    await advance(1000);
    expect(screen.getByText(/הסטטיסטיקה תתחיל להיאסף/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'כיבוי מצלמה' }));
    await advance(100);
    expect(camera.track.stop).toHaveBeenCalled();
    expect(mediapipe.close).toHaveBeenCalled();
    expect(attentionStatus()).toHaveTextContent('המצלמה כבויה');
  });

  it('shows an estimated concentration that reacts to looking away and closed eyes', async () => {
    const lesson = await openPageWithCamera();
    const concentration = () => within(screen.getByRole('region', { name: 'הערכת ריכוז' }));
    const score = () => Number(concentration().getByLabelText(/^הערכת ריכוז \d+%$/).textContent.replace('%', ''));

    await advance(4000);
    expect(concentration().getByText('אוספים נתונים…')).toBeInTheDocument();

    fireEvent.playing(lesson);
    await advance(10_000);
    expect(score()).toBeGreaterThanOrEqual(90);
    expect(concentration().getByText('ריכוז גבוה')).toBeInTheDocument();

    scene.mode = 'away';
    await advance(12_000);
    expect(score()).toBeLessThan(50);
    expect(concentration().getByText('ריכוז נמוך')).toBeInTheDocument();
    expect(concentration().getByText(/המבט היה הרבה מחוץ למסך/)).toBeInTheDocument();

    scene.mode = 'screen';
    await advance(20_000);
    scene.mode = 'eyes-closed';
    await advance(2500);
    expect(score()).toBeLessThanOrEqual(25);
    expect(concentration().getByText('העיניים עצומות כרגע')).toBeInTheDocument();

    fireEvent.pause(lesson);
    const average = summary().getByLabelText(/^ריכוז ממוצע במפגש:/).textContent;
    expect(average).toMatch(/^\d+%$/);
  });

  it('shows the measured gaze offset in the measurement details', async () => {
    await openPageWithCamera();
    await advance(4000);
    fireEvent.click(screen.getByText('פרטי המדידה'));
    expect(screen.getByText('סטיית מבט אופקית')).toBeInTheDocument();
    expect(screen.getByText('ראש + עיניים')).toBeInTheDocument();
  });

  it('lets the user re-center without any calibration targets', async () => {
    await openPageWithCamera();
    await advance(4000);
    fireEvent.click(screen.getByRole('button', { name: 'התאמה מחדש למיקום שלי' }));
    await advance(300);
    expect(screen.getByText(/מתאימים את עצמנו למיקום שלכם/)).toBeInTheDocument();
    await advance(4000);
    expect(attentionStatus()).toHaveTextContent('מבט לכיוון המסך');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
