import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraPreview from './CameraPreview.jsx';
import useFaceLandmarker from './useFaceLandmarker.js';

vi.mock('./useFaceLandmarker.js', () => ({
  default: vi.fn(),
}));

function setGetUserMedia(getUserMedia) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
}

function createCameraStream() {
  const track = { readyState: 'live', stop: vi.fn() };
  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    },
    track,
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('CameraPreview', () => {
  beforeEach(() => {
    vi.mocked(useFaceLandmarker).mockReturnValue({ status: 'off', error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts inactive and does not request camera access before interaction', () => {
    const getUserMedia = vi.fn();
    setGetUserMedia(getUserMedia);
    render(<CameraPreview />);

    expect(screen.getByText('המצלמה כבויה', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'סטטוס זיהוי פנים' })).toHaveTextContent('המצלמה כבויה');
    expect(screen.getByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it.each([
    ['loading', 'טוען מודל לזיהוי פנים'],
    ['ready', 'זיהוי פנים מוכן'],
    ['detected', 'זוהו פנים'],
    ['no-face', 'לא זוהו פנים'],
    ['error', 'שגיאה בזיהוי פנים'],
  ])('shows the %s diagnostic state', (status, message) => {
    vi.mocked(useFaceLandmarker).mockReturnValue({ status, error: null });
    render(<CameraPreview />);

    expect(screen.getByRole('status', { name: 'סטטוס זיהוי פנים' })).toHaveTextContent(message);
  });

  it('renders the experimental eye-gaze diagnostic separately from head pose', () => {
    render(<CameraPreview />);

    expect(screen.getByLabelText('אבחון כיוון מבט העיניים')).toHaveTextContent('סיווג: לא ידוע');
    expect(screen.getByLabelText('אבחון תנוחת ראש')).toBeInTheDocument();
    expect(screen.getByLabelText('אבחון כיוון למסך')).toHaveTextContent('המצלמה אינה זמינה');
    expect(screen.getByText(/"מרכז" אינו מעיד שהמבט מופנה למסך/)).toBeInTheDocument();
  });

  it('enables live tracking from the camera independently of learning-video playback', async () => {
    const { stream } = createCameraStream();
    setGetUserMedia(vi.fn().mockResolvedValue(stream));
    render(<CameraPreview videoPlaybackState="paused" experimentMode />);

    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    await screen.findByRole('button', { name: 'כיבוי מצלמה' });

    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    expect(screen.getByRole('button', { name: 'התחלת כיול' })).toBeEnabled();
  });

  it('passes the hook gaze ref to the diagnostic without another detection instance', () => {
    vi.mocked(useFaceLandmarker).mockReturnValue({
      status: 'detected',
      error: null,
      latestEyeGazeRef: {
        current: {
          horizontal: -0.4,
          vertical: 0.02,
          direction: 'right',
          reliability: 'reliable',
          reason: null,
        },
      },
      latestEyeLookBlendshapesRef: {
        current: { eyeLookInLeft: 0.3 },
      },
    });
    render(<CameraPreview />);

    expect(screen.getByLabelText('אבחון כיוון מבט העיניים')).toHaveTextContent('סיווג: ימינה');
    expect(screen.getByLabelText('ציוני מבט עיניים של MediaPipe')).toHaveTextContent('0.300');
  });

  it('requests camera access only after the user activates it and shows the live preview', async () => {
    const { stream } = createCameraStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setGetUserMedia(getUserMedia);
    render(<CameraPreview />);

    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    const preview = await screen.findByLabelText('תצוגה חיה מהמצלמה');
    expect(preview.tagName).toBe('VIDEO');
    expect(preview).toHaveAttribute('playsinline');
    expect(preview).toHaveAttribute('autoplay');
    expect(preview).toHaveProperty('muted', true);
    await waitFor(() => expect(preview.srcObject).toBe(stream));
    expect(screen.getByRole('button', { name: 'כיבוי מצלמה' })).toBeInTheDocument();
  });

  it('explains when camera permission is denied', async () => {
    const getUserMedia = vi.fn().mockRejectedValue({ name: 'NotAllowedError' });
    setGetUserMedia(getUserMedia);
    render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('הגישה למצלמה נדחתה');
    expect(screen.getByText('המצלמה כבויה', { selector: 'strong' })).toBeInTheDocument();
  });

  it('explains when no camera is available', async () => {
    const getUserMedia = vi.fn().mockRejectedValue({ name: 'NotFoundError' });
    setGetUserMedia(getUserMedia);
    render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('לא נמצאה מצלמה זמינה');
  });

  it('reports unsupported camera APIs without attempting access', () => {
    setGetUserMedia(undefined);
    render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));

    expect(screen.getByRole('alert')).toHaveTextContent('אינם תומכים בגישה למצלמה');
  });

  it('stops every camera track when the user turns the camera off', async () => {
    const { stream, track } = createCameraStream();
    setGetUserMedia(vi.fn().mockResolvedValue(stream));
    render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    fireEvent.click(await screen.findByRole('button', { name: 'כיבוי מצלמה' }));

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('המצלמה כבויה', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
  });

  it('stops camera tracks when the component unmounts', async () => {
    const { stream, track } = createCameraStream();
    setGetUserMedia(vi.fn().mockResolvedValue(stream));
    const { unmount } = render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    await screen.findByRole('button', { name: 'כיבוי מצלמה' });
    unmount();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('stops a stream that resolves after the component unmounts', async () => {
    const { stream, track } = createCameraStream();
    const deferred = createDeferred();
    setGetUserMedia(vi.fn().mockReturnValue(deferred.promise));
    const { unmount } = render(<CameraPreview />);

    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
    unmount();
    deferred.resolve(stream);
    await deferred.promise;

    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it('does not make duplicate camera requests while access is pending', () => {
    const deferred = createDeferred();
    const getUserMedia = vi.fn().mockReturnValue(deferred.promise);
    setGetUserMedia(getUserMedia);
    render(<CameraPreview />);
    const button = screen.getByRole('button', { name: 'הפעלת מצלמה' });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
