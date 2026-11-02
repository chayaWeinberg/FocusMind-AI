import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScreenAttentionDiagnostic from './ScreenAttentionDiagnostic.jsx';
import { createScreenAttentionDiagnosticRecorder } from './screenAttentionDiagnosticRecorder.js';

function summary(state = 'LIKELY_ON_SCREEN') {
  return {
    currentState: state,
    onScreenMs: 1200,
    offScreenMs: 400,
    unknownMs: 800,
    measurementQuality: 'reliable',
    qualityScore: 0.9,
  };
}

describe('ScreenAttentionDiagnostic', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows current state, durations, and measurement quality', () => {
    render(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={{ current: summary() }}
      />,
    );

    expect(screen.getByText('כנראה מול המסך')).toBeInTheDocument();
    expect(screen.getByText('00:01')).toBeInTheDocument();
    expect(screen.getAllByText('00:00')).toHaveLength(2);
    expect(screen.getByText('טובה')).toBeInTheDocument();
    expect(screen.getByText(/אינו מעיד על ריכוז/)).toBeInTheDocument();
  });

  it('refreshes the summary at a limited cadence', () => {
    vi.useFakeTimers();
    const summaryRef = { current: summary() };
    render(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={summaryRef}
      />,
    );
    expect(screen.getByText('כנראה מול המסך')).toBeInTheDocument();

    summaryRef.current = summary('LIKELY_OFF_SCREEN');
    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByText('כנראה לא מול המסך')).toBeInTheDocument();
  });

  it('clears stale summary data when playback pauses', () => {
    const summaryRef = { current: summary() };
    const { rerender } = render(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={summaryRef}
      />,
    );
    expect(screen.getByText('00:01')).toBeInTheDocument();

    summaryRef.current = null;
    rerender(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="paused"
        summaryRef={summaryRef}
      />,
    );

    expect(screen.getByText('המעקב מושהה')).toBeInTheDocument();
    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
    expect(screen.getAllByText('00:00')).toHaveLength(3);
  });

  it('shows camera unavailable when its track is unavailable', () => {
    render(
      <ScreenAttentionDiagnostic
        cameraAvailable={false}
        videoPlaybackState="playing"
        summaryRef={{ current: null }}
      />,
    );

    expect(screen.getByText('המצלמה אינה זמינה')).toBeInTheDocument();
  });

  it('starts a new diagnostic test, displays synchronized details, and resets prior samples', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    const recorderRef = { current: recorder };
    const startRecording = vi.fn(() => {
      recorder.start(1000);
      return true;
    });
    const resetRecording = vi.fn(() => recorder.reset());
    const stopRecording = vi.fn(() => recorder.stop(1200));
    const props = {
      cameraAvailable: true,
      videoPlaybackState: 'playing',
      summaryRef: { current: summary() },
      recorderRef,
      startRecording,
      stopRecording,
      resetRecording,
    };
    render(<ScreenAttentionDiagnostic {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'התחלת בדיקה' }));
    expect(startRecording).toHaveBeenCalledTimes(1);
    recorder.record({
      timestampMs: 0,
      headYaw: 1,
      headPitch: 2,
      leftEyeHorizontal: 0,
      leftEyeVertical: 0,
      rightEyeHorizontal: 0,
      rightEyeVertical: 0,
      eyeMeasurementReliability: 'reliable',
      eyeReliabilityReason: 'Reason unavailable',
      combinedYaw: 1,
      combinedPitch: 2,
      screenAttentionState: 'LIKELY_ON_SCREEN',
      screenAttentionReason: 'Reason unavailable',
      smoothedScreenAttentionState: 'UNKNOWN',
      eyeLookDownLeft: 0.7,
      eyeLookDownRight: 0.72,
    }, 1100);
    fireEvent.click(screen.getByRole('button', { name: 'עצירת בדיקה' }));

    fireEvent.click(screen.getByText('פרטי דגימות הבדיקה'));
    expect(screen.getByText(/סיבת אמינות: Reason unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/סיבת סיווג: Reason unavailable/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'איפוס בדיקה' }));
    expect(resetRecording).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('פרטי דגימות הבדיקה')).not.toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(5);
  });

  it('disallows starting a recording while playback is paused', () => {
    const startRecording = vi.fn();
    render(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="paused"
        summaryRef={{ current: null }}
        startRecording={startRecording}
      />,
    );

    expect(screen.getByRole('button', { name: 'התחלת בדיקה' })).toBeDisabled();
    expect(startRecording).not.toHaveBeenCalled();
  });

  it('downloads the recorder JSON without sending it anywhere', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(1000);
    recorder.record({
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'eyes-closed-or-invalid',
      screenAttentionState: 'UNKNOWN',
      screenAttentionReason: 'unreliable-measurements',
    }, 1200);
    recorder.stop(1300);
    const createObjectURL = vi.fn(() => 'blob:diagnostic-json');
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <ScreenAttentionDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={{ current: summary() }}
        recorderRef={{ current: recorder }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'הורדת JSON' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
