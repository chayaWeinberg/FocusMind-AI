import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useFaceLandmarker from './useFaceLandmarker.js';
import SmartLearningPage from './SmartLearningPage.jsx';

const faceLandmarkerHook = vi.hoisted(() => ({ mock: vi.fn() }));

vi.mock('./useFaceLandmarker.js', () => ({
  default: faceLandmarkerHook.mock,
}));

function chooseFile(input, name = 'lesson.mp4') {
  const file = new File(['video-content'], name, { type: 'video/mp4' });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

function setupVideoPage() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T08:00:00Z'));
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn()
      .mockReturnValueOnce('blob:lesson-one')
      .mockReturnValueOnce('blob:lesson-two')
      .mockReturnValueOnce('blob:lesson-three'),
    revokeObjectURL: vi.fn(),
  });
  render(<SmartLearningPage />);
  const videoInput = screen.getByLabelText('בחירת סרטון מהמכשיר');
  chooseFile(videoInput);
  const video = screen.getByLabelText('נגן וידאו: lesson.mp4');
  vi.spyOn(video, 'pause').mockImplementation(() => {});
  return video;
}

function advanceTime(milliseconds) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function timerText() {
  return screen.getByLabelText(/^זמן למידה פעיל/).querySelector('span').textContent;
}

describe('SmartLearningPage', () => {
  beforeEach(() => {
    vi.mocked(useFaceLandmarker).mockReturnValue({ status: 'off' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders AI, timeline, and ReplayAI empty states without fake results or camera access', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    render(<SmartLearningPage />);

    expect(screen.getByText('בחרו סרטון כדי להתחיל')).toBeInTheDocument();
    expect(screen.getByText('ניתוח ריכוז באמצעות AI יהיה זמין בקרוב')).toBeInTheDocument();
    expect(screen.getByLabelText('עדיין אין נתונים')).toHaveTextContent('—');
    expect(screen.getByText('בהמתנה')).toBeInTheDocument();
    expect(screen.getByText('לא הופעלה')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'סטטוס מבט על המסך' }))
      .toHaveTextContent('ממתין להשלמת כיול');
    expect(screen.getByText(/השלימו את שלבי הכיול/)).toBeInTheDocument();
    expect(screen.getByText('ציר הזמן עדיין ריק')).toBeInTheDocument();
    expect(screen.getByText('עדיין לא נאספו מדידות')).toBeInTheDocument();
    expect(screen.getByText(/קטעי וידאו מומלצים לחזרה/)).toBeInTheDocument();
    expect(screen.getByLabelText('אבחון כיוון למסך')).toHaveTextContent('המצלמה אינה זמינה');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('updates the live attention label from the camera analysis callback', () => {
    render(<SmartLearningPage />);
    const reportAttention = vi.mocked(useFaceLandmarker).mock.calls.at(-1)[4];

    act(() => reportAttention('LOOKING_AT_SCREEN', false, null, true));
    expect(screen.getByRole('status', { name: 'סטטוס מבט על המסך' }))
      .toHaveTextContent('מסתכלת על המסך');

    act(() => reportAttention('LOOKING_AWAY', false, null, true));
    expect(screen.getByRole('status', { name: 'סטטוס מבט על המסך' }))
      .toHaveTextContent('מבט מחוץ למסך');

    act(() => reportAttention('UNKNOWN', false, 'face-not-detected', true));
    expect(screen.getByRole('status', { name: 'סטטוס מבט על המסך' }))
      .toHaveTextContent('לא ניתן לקבוע');
    expect(screen.getByText('לא זוהו פנים. מקמו את הפנים מול המצלמה.')).toBeInTheDocument();
    act(() => reportAttention('UNKNOWN', true, 'calibration-drift', true));
    expect(screen.getByText('נראה שינוי בתנוחה. מומלץ לבצע כיול מחדש.')).toBeInTheDocument();
  });

  it('selects and replaces local videos, releasing prior and unmounted object URLs', () => {
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:lesson-one')
      .mockReturnValueOnce('blob:lesson-two');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const { unmount } = render(<SmartLearningPage />);
    const input = screen.getByLabelText('בחירת סרטון מהמכשיר');

    chooseFile(input, 'lesson-one.mp4');
    expect(screen.getByText('lesson-one.mp4')).toBeInTheDocument();
    const firstVideo = screen.getByLabelText('נגן וידאו: lesson-one.mp4');
    expect(firstVideo).toHaveAttribute('src', 'blob:lesson-one');
    vi.spyOn(firstVideo, 'pause').mockImplementation(() => {});

    chooseFile(screen.getByLabelText('בחירת סרטון אחר מהמכשיר'), 'lesson-two.webm');
    expect(screen.getByText('lesson-two.webm')).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lesson-one');
    expect(createObjectURL).toHaveBeenCalledTimes(2);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lesson-two');
  });

  it('starts on playback, pauses on pause, and resumes from the accumulated time', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const video = setupVideoPage();

    fireEvent.playing(video);
    expect(screen.getByText('הסשן פעיל')).toBeInTheDocument();
    advanceTime(65_000);
    expect(timerText()).toBe('00:01:05');

    fireEvent.pause(video);
    expect(screen.getByText('הסשן מושהה')).toBeInTheDocument();
    const pausedAt = timerText();
    advanceTime(90_000);
    expect(timerText()).toBe(pausedAt);

    fireEvent.playing(video);
    advanceTime(55_000);
    expect(timerText()).toBe('00:02:00');
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /התחלת סשן|השהיית סשן|חידוש סשן/ })).not.toBeInTheDocument();
  });

  it('stops counting when the video ends', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(70_000);
    fireEvent.ended(video);

    expect(screen.getByText('הסרטון הסתיים')).toBeInTheDocument();
    const endedAt = timerText();
    advanceTime(120_000);
    expect(timerText()).toBe(endedAt);
    expect(screen.getByRole('button', { name: 'התחלת מפגש חדש' })).toBeInTheDocument();
  });

  it('excludes buffering time from the elapsed playback time', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(30_000);

    fireEvent.waiting(video);
    const beforeBuffer = timerText();
    advanceTime(90_000);
    expect(timerText()).toBe(beforeBuffer);

    fireEvent.playing(video);
    advanceTime(30_000);
    expect(timerText()).toBe('00:01:00');
  });

  it('keeps gaze tracking active with the camera while lesson playback is paused', async () => {
    const track = { readyState: 'live', stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const video = setupVideoPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'כיבוי מצלמה' })).toBeInTheDocument();
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);

    fireEvent.playing(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);

    fireEvent.loadStart(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.playing(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);

    fireEvent.waiting(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.playing(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);

    fireEvent.pause(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.seeking(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.seeked(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.playing(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);

    fireEvent.ended(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
  });

  it('disables sampling when the camera is turned off during playback', async () => {
    const track = { readyState: 'live', stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const video = setupVideoPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה' }));
      await Promise.resolve();
    });

    fireEvent.playing(video);
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'כיבוי מצלמה' }));
    expect(vi.mocked(useFaceLandmarker).mock.calls.at(-1)[3]).toBe(false);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('does not count seeking time and resumes when playback continues', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(30_000);

    fireEvent.seeking(video);
    const beforeSeek = timerText();
    advanceTime(90_000);
    expect(timerText()).toBe(beforeSeek);

    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    Object.defineProperty(video, 'readyState', { configurable: true, value: 3 });
    fireEvent.seeked(video);
    advanceTime(30_000);

    expect(timerText()).toBe('00:01:00');
  });

  it('preserves elapsed time and prevents automatic restart after ending the session', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(65_000);
    fireEvent.click(screen.getByRole('button', { name: 'סיום מפגש' }));

    expect(screen.getByText('המפגש הסתיים')).toBeInTheDocument();
    const finalTime = timerText();
    expect(finalTime).toBe('00:01:05');
    expect(video.paused).toBe(true);

    fireEvent.playing(video);
    advanceTime(120_000);
    expect(timerText()).toBe(finalTime);
    expect(screen.getByRole('button', { name: 'התחלת מפגש חדש' })).toBeInTheDocument();
  });

  it('resets the timer when a new session is started', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(65_000);
    fireEvent.click(screen.getByRole('button', { name: 'סיום מפגש' }));
    fireEvent.click(screen.getByRole('button', { name: 'התחלת מפגש חדש' }));

    expect(timerText()).toContain('00:00');
    fireEvent.playing(video);
    advanceTime(60_000);
    expect(timerText()).toBe('00:01:00');
  });

  it('resets the session timer when replacing the selected video', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);
    advanceTime(65_000);

    chooseFile(screen.getByLabelText('בחירת סרטון אחר מהמכשיר'), 'replacement.webm');

    expect(screen.getByText('replacement.webm')).toBeInTheDocument();
    expect(timerText()).toContain('00:00');
    expect(screen.getByText('מוכנים להתחיל')).toBeInTheDocument();
  });

  it('shows 00:00:10 after ten seconds of video playback', () => {
    const video = setupVideoPage();
    fireEvent.playing(video);

    advanceTime(10_000);

    expect(screen.getByText('00:00:10')).toBeInTheDocument();
    expect(screen.getByLabelText('זמן למידה פעיל 00:00:10')).toBeInTheDocument();
  });
});
