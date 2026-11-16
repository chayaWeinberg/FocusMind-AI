import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SmartLearningPage from './SmartLearningPage.jsx';

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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the product page with live attention monitoring and no experiment UI', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    render(<SmartLearningPage />);

    expect(screen.getByRole('heading', { name: 'למידה חכמה', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'כיוון המבט' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'מצב הקשב' })).toHaveTextContent('המצלמה כבויה');
    expect(screen.getByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
    expect(screen.getByText('בחרו סרטון כדי להתחיל')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ציר זמן של כיוון המבט' })).toBeInTheDocument();
    expect(screen.getByText(/הסטטיסטיקה תתחיל להיאסף/)).toBeInTheDocument();
    // A local file is never sent to the server, so ReplayAI explains where it works.
    expect(screen.getByText(/בסרטון מקומי שום דבר לא נשמר בשרת/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'שעון למידה חכם' })).toBeInTheDocument();
    expect(screen.getByText(/אינה מדידה מדויקת של ריכוז/)).toBeInTheDocument();
    // The concentration estimate appears only once the camera is measuring.
    expect(screen.queryByRole('region', { name: 'הערכת ריכוז' })).not.toBeInTheDocument();

    // Removed experiment and placeholder UI
    expect(screen.queryByText(/כיול/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ניסוי/)).not.toBeInTheDocument();
    expect(screen.queryByText('ניתוח ריכוז באמצעות AI יהיה זמין בקרוב')).not.toBeInTheDocument();
    expect(screen.queryByText(/ציון ריכוז/)).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
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
