import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AttentionEnginePanel from './AttentionEnginePanel.jsx';
import SmartLearningPage from '../learning/SmartLearningPage.jsx';
import { ATTENTION_ENGINE_STORAGE_KEY } from '../../config/featureFlags.js';
import { NO_FACE, simulatedUser } from './testing/syntheticFace.js';

const scene = vi.hoisted(() => ({ gaze: { x: 0.5, y: 0.5 }, faceVisible: true, user: null }));
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

const videoProperties = {
  readyState: 4,
  videoWidth: 640,
  videoHeight: 480,
  paused: false,
};
const originalDescriptors = {};

function createCameraStream() {
  const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getVideoTracks: () => [track], getTracks: () => [track] } };
}

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startCamera() {
  fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
  await advance(200);
}

async function runCalibration() {
  fireEvent.click(screen.getByRole('button', { name: /כיול אישי/ }));
  await advance(0);
  for (let step = 0; step < 600; step += 1) {
    const target = screen.queryByTestId('calibration-target');
    if (!target) break;
    scene.gaze = { x: parseFloat(target.style.left) / 100, y: parseFloat(target.style.top) / 100 };
    await advance(66);
  }
}

describe('AttentionEnginePanel with a simulated camera', () => {
  let camera;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
    scene.gaze = { x: 0.5, y: 0.5 };
    scene.faceVisible = true;
    scene.user = simulatedUser({ seed: 5 });
    mediapipe.detectForVideo.mockImplementation(() => (
      scene.faceVisible ? scene.user.lookAt(scene.gaze.x, scene.gaze.y) : NO_FACE
    ));
    Object.entries(videoProperties).forEach(([name, value]) => {
      originalDescriptors[name] = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, name)
        || Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, name);
      Object.defineProperty(HTMLVideoElement.prototype, name, { configurable: true, get: () => value });
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
      configurable: true,
      get: () => performance.now() / 1000,
      set: () => {},
    });
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    camera = createCameraStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => camera.stream) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    ['readyState', 'videoWidth', 'videoHeight', 'paused', 'currentTime'].forEach((name) => {
      delete HTMLVideoElement.prototype[name];
    });
    vi.clearAllMocks();
  });

  it('is uncertain before calibration and says so', async () => {
    render(<AttentionEnginePanel />);
    expect(screen.getByRole('status', { name: 'מצב המבט' })).toHaveTextContent('לא ניתן לקבוע בוודאות');
    expect(screen.getByText(/זו אינה מדידה של ריכוז/)).toBeInTheDocument();

    await startCamera();
    await advance(1500);
    expect(screen.getByText(/בלי כיול אישי המנוע מזהה רק פנייה ברורה/)).toBeInTheDocument();
    expect(mediapipe.detectForVideo).toHaveBeenCalled();
  });

  it('calibrates, then detects on-screen, looking away and face absent', async () => {
    render(<AttentionEnginePanel />);
    await startCamera();
    await runCalibration();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/הכיול הושלם/)).toBeInTheDocument();
    const state = () => screen.getByRole('status', { name: 'מצב המבט' });

    scene.gaze = { x: 0.3, y: 0.6 };
    await advance(1500);
    expect(state()).toHaveTextContent('מבט לכיוון המסך');
    expect(screen.getByTestId('gaze-point')).toBeInTheDocument();

    scene.gaze = { x: 1.9, y: 0.5 };
    await advance(2000);
    expect(state()).toHaveTextContent('מבט מחוץ למסך');

    scene.faceVisible = false;
    await advance(2500);
    expect(state()).toHaveTextContent('לא זוהו פנים');
  });

  it('reports a failed calibration when the face disappears', async () => {
    render(<AttentionEnginePanel />);
    await startCamera();
    scene.faceVisible = false;
    fireEvent.click(screen.getByRole('button', { name: /כיול אישי/ }));
    await advance(6000);
    expect(screen.getByText(/הכיול נכשל: הפנים לא זוהו/)).toBeInTheDocument();
  });

  it('can cancel calibration with Escape', async () => {
    render(<AttentionEnginePanel />);
    await startCamera();
    fireEvent.click(screen.getByRole('button', { name: /כיול אישי/ }));
    await advance(100);
    expect(screen.getByRole('dialog', { name: 'כיול אישי של זיהוי המבט' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await advance(100);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('הכיול בוטל.')).toBeInTheDocument();
  });

  it('stops the camera and the model when the camera is turned off', async () => {
    render(<AttentionEnginePanel />);
    await startCamera();
    fireEvent.click(screen.getByRole('button', { name: 'כיבוי מצלמה' }));
    await advance(100);
    expect(camera.track.stop).toHaveBeenCalled();
    expect(mediapipe.close).toHaveBeenCalled();
    expect(screen.getByText('המצלמה כבויה.')).toBeInTheDocument();
  });
});

describe('Smart Learning page feature flag', () => {
  afterEach(() => {
    window.localStorage.removeItem(ATTENTION_ENGINE_STORAGE_KEY);
    window.history.pushState({}, '', '/');
  });

  it('keeps the legacy gaze experiment by default', () => {
    window.history.pushState({}, '', '/learning');
    render(<SmartLearningPage />);
    expect(screen.getByRole('heading', { name: 'ניסוי זיהוי מבט' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'זיהוי מבט לכיוון המסך' })).not.toBeInTheDocument();
  });

  it('shows the new engine with ?engine=new and remembers the choice until ?engine=legacy', async () => {
    window.history.pushState({}, '', '/learning?engine=new');
    const { unmount } = render(<SmartLearningPage />);
    expect(await screen.findByRole('heading', { name: 'זיהוי מבט לכיוון המסך' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ניסוי זיהוי מבט' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
    unmount();

    window.history.pushState({}, '', '/learning');
    const second = render(<SmartLearningPage />);
    expect(await screen.findByRole('heading', { name: 'זיהוי מבט לכיוון המסך' })).toBeInTheDocument();
    second.unmount();

    window.history.pushState({}, '', '/learning?engine=legacy');
    render(<SmartLearningPage />);
    expect(screen.queryByRole('heading', { name: 'זיהוי מבט לכיוון המסך' })).not.toBeInTheDocument();
  });
});
