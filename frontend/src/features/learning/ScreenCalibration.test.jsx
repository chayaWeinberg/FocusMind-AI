import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScreenCalibration from './ScreenCalibration.jsx';
import { createScreenCalibrationSession } from './screenCalibrationCollector.js';

function validSample() {
  return {
    faceDetected: true,
    headPose: { yaw: 2, pitch: -1, roll: 0.5 },
    eyeGaze: {
      leftEye: { horizontal: 0.1, vertical: -0.2 },
      rightEye: { horizontal: 0.12, vertical: -0.18 },
      reliability: 'reliable',
      reason: null,
    },
    blendshapes: { eyeLookDownLeft: 0.3, eyeLookDownRight: 0.31 },
  };
}

function renderCalibration({
  cameraAvailable = true,
  videoPlaybackState = 'playing',
  options = {},
} = {}) {
  const sessionRef = { current: createScreenCalibrationSession(options) };
  const now = () => performance.now();
  const actions = {
    startCalibration: vi.fn(() => {
      sessionRef.current.start(now());
      return true;
    }),
    cancelCalibration: vi.fn(() => sessionRef.current.cancel()),
    restartCalibration: vi.fn(() => {
      sessionRef.current.start(now());
      return true;
    }),
    repeatCalibrationTarget: vi.fn(() => sessionRef.current.repeatTarget(now())),
    startKeyboardEvaluation: vi.fn(() => sessionRef.current.startKeyboardEvaluation(now())),
    completeCalibration: vi.fn(() => sessionRef.current.completeWithoutKeyboard()),
  };
  const view = render(
    <ScreenCalibration
      cameraAvailable={cameraAvailable}
      videoPlaybackState={videoPlaybackState}
      sessionRef={sessionRef}
      {...actions}
    />,
  );
  return { ...view, sessionRef, actions };
}

describe('ScreenCalibration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('only starts when camera and video playback are available and displays a viewport target countdown', () => {
    const { actions, rerender, sessionRef } = renderCalibration({
      cameraAvailable: false,
      videoPlaybackState: 'paused',
    });
    const startButton = screen.getByRole('button', { name: 'התחלת כיול' });
    expect(startButton).toBeDisabled();
    expect(actions.startCalibration).not.toHaveBeenCalled();

    rerender(
      <ScreenCalibration
        cameraAvailable
        videoPlaybackState="playing"
        sessionRef={sessionRef}
        {...actions}
      />,
    );
    fireEvent.click(startButton);

    expect(actions.startCalibration).toHaveBeenCalledTimes(1);
    expect(startButton).toBeDisabled();
    expect(screen.getByLabelText('מטרת כיול במסך')).toBeInTheDocument();
    expect(document.querySelector('.screen-calibration-overlay').parentElement).toBe(document.body);
    expect(document.querySelector('.screen-calibration-overlay-instructions strong'))
      .toHaveTextContent('CENTER');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(document.querySelector('.screen-calibration-viewport-target')).toHaveStyle({
      left: '50vw',
      top: '50vh',
    });
  });

  it('counts down, collects, offers a repeat when sample minimum is missed, and supports cancellation and restart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { actions, sessionRef } = renderCalibration({
      options: { minimumReliableSamples: 1 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('collecting');
    expect(screen.getByText(/אוספים מדידות/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('needs-repeat');
    fireEvent.click(screen.getByRole('button', { name: 'חזרה על היעד' }));
    expect(actions.repeatCalibrationTarget).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('countdown');

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(actions.cancelCalibration).toHaveBeenCalledTimes(1);
    expect(screen.getByText('האיסוף בוטל')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'התחלה מחדש' }));
    expect(actions.restartCalibration).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now())).toMatchObject({
      status: 'countdown',
      target: { label: 'CENTER' },
      acceptedSampleCount: 0,
      rejectedSampleCount: 0,
    });
  });

  it('interrupts active collection when camera or video playback becomes unavailable', () => {
    const { rerender, sessionRef, actions } = renderCalibration();
    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    rerender(
      <ScreenCalibration
        cameraAvailable
        videoPlaybackState="buffering"
        sessionRef={sessionRef}
        {...actions}
      />,
    );
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('interrupted');
    expect(screen.getByText('האיסוף נעצר כי המצלמה או הווידאו אינם פעילים')).toBeInTheDocument();
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);
  });

  it('downloads the local JSON report without uploading it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const createObjectURL = vi.fn(() => 'blob:screen-calibration');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { sessionRef } = renderCalibration();

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    act(() => vi.advanceTimersByTime(3000));
    sessionRef.current.recordSample(validSample(), performance.now());
    sessionRef.current.recordSample({
      faceDetected: true,
      headPose: { yaw: 2, pitch: -1, roll: 0 },
      eyeGaze: { reliability: 'unreliable', reason: 'eyes-closed-or-invalid' },
      blendshapes: { eyeLookDownLeft: 0.8 },
    }, performance.now() + 1);
    act(() => vi.advanceTimersByTime(100));

    const downloadButton = screen.getByRole('button', { name: 'הורדת דוח כיול JSON' });
    expect(downloadButton).toBeEnabled();
    fireEvent.click(downloadButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0].download).toBe('screen-calibration-data.json');
    act(() => vi.runOnlyPendingTimers());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:screen-calibration');
    vi.useRealTimers();
    const exportedText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    expect(JSON.parse(exportedText).screenCalibration.CENTER.rejectedSamples[0])
      .toMatchObject({
        rejectionReason: 'eyes-closed-or-invalid',
        eyeLookDownLeft: 0.8,
      });
  });
});
