import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EyeGazeDiagnostic from './EyeGazeDiagnostic.jsx';

describe('EyeGazeDiagnostic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an unknown and unreliable state when gaze is unavailable', () => {
    render(<EyeGazeDiagnostic detectionStatus="off" gazeRef={{ current: null }} />);

    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
    expect(screen.getByText('אמינות: לא אמינה / לא זמינה')).toBeInTheDocument();
    expect(screen.getByText(/"מרכז" אינו מעיד שהמבט מופנה למסך/)).toBeInTheDocument();
  });

  it('displays a reliable gaze estimate in Hebrew', () => {
    render(
      <EyeGazeDiagnostic
        detectionStatus="detected"
        gazeRef={{
          current: {
            horizontal: -0.42,
            vertical: 0.1,
            leftEye: { horizontal: -0.4, vertical: 0.08 },
            rightEye: { horizontal: -0.44, vertical: 0.12 },
            direction: 'right',
            reliability: 'reliable',
            reason: null,
          },
        }}
      />,
    );

    expect(screen.getByText('ימינה')).toBeInTheDocument();
    expect(screen.getByText('סיווג:')).toBeInTheDocument();
    expect(screen.getByText('אופקי - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('אופקי - עין ימין')).toBeInTheDocument();
    expect(screen.getByText('אנכי - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('אנכי - עין ימין')).toBeInTheDocument();
    expect(screen.getByText('אופקי משולב')).toBeInTheDocument();
    expect(screen.getByText('אנכי משולב')).toBeInTheDocument();
    expect(screen.getByText('-0.400')).toBeInTheDocument();
    expect(screen.getByText('-0.440')).toBeInTheDocument();
    expect(screen.getByText('0.080')).toBeInTheDocument();
    expect(screen.getByText('0.120')).toBeInTheDocument();
    expect(screen.getByText('-0.420')).toBeInTheDocument();
    expect(screen.getByText('0.100')).toBeInTheDocument();
    expect(screen.getByText('אמינות: מדידה זמינה')).toBeInTheDocument();
    expect(screen.getByText('ניסוי')).toBeInTheDocument();
  });

  it('displays all eight raw MediaPipe eye-look blendshape scores', () => {
    const blendshapes = {
      eyeLookInLeft: 0.11,
      eyeLookOutLeft: 0.22,
      eyeLookInRight: 0.33,
      eyeLookOutRight: 0.44,
      eyeLookUpLeft: 0.55,
      eyeLookUpRight: 0.66,
      eyeLookDownLeft: 0.77,
      eyeLookDownRight: 0.88,
    };
    render(
      <EyeGazeDiagnostic
        detectionStatus="detected"
        gazeRef={{ current: null }}
        blendshapesRef={{ current: blendshapes }}
      />,
    );

    expect(screen.getByLabelText('ציוני מבט עיניים של MediaPipe')).toHaveTextContent(
      'ציוני Blendshape זמינים',
    );
    expect(screen.getByText('מבט פנימה - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('מבט החוצה - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('מבט פנימה - עין ימין')).toBeInTheDocument();
    expect(screen.getByText('מבט החוצה - עין ימין')).toBeInTheDocument();
    expect(screen.getByText('מבט למעלה - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('מבט למעלה - עין ימין')).toBeInTheDocument();
    expect(screen.getByText('מבט למטה - עין שמאל')).toBeInTheDocument();
    expect(screen.getByText('מבט למטה - עין ימין')).toBeInTheDocument();
    for (const score of Object.values(blendshapes)) {
      expect(screen.getByText(score.toFixed(3))).toBeInTheDocument();
    }
  });

  it('handles missing blendshape data and clears stale scores when detection stops', () => {
    const blendshapesRef = {
      current: { eyeLookInLeft: 0.4 },
    };
    const { rerender } = render(
      <EyeGazeDiagnostic
        detectionStatus="detected"
        gazeRef={{ current: null }}
        blendshapesRef={blendshapesRef}
      />,
    );
    expect(screen.getByText('ציוני Blendshape זמינים')).toBeInTheDocument();
    expect(screen.getByText('0.400')).toBeInTheDocument();

    blendshapesRef.current = null;
    rerender(
      <EyeGazeDiagnostic
        detectionStatus="off"
        gazeRef={{ current: null }}
        blendshapesRef={blendshapesRef}
      />,
    );
    expect(screen.getByText('ציוני Blendshape אינם זמינים')).toBeInTheDocument();
    expect(screen.queryByText('0.400')).not.toBeInTheDocument();
  });

  it('refreshes ref values at a limited 400ms interval', () => {
    vi.useFakeTimers();
    const gazeRef = {
      current: {
        horizontal: -0.4,
        vertical: 0,
        leftEye: { horizontal: -0.4, vertical: 0 },
        rightEye: { horizontal: -0.4, vertical: 0 },
        direction: 'right',
        reliability: 'reliable',
        reason: null,
      },
    };
    render(<EyeGazeDiagnostic detectionStatus="detected" gazeRef={gazeRef} />);

    expect(screen.getByText('ימינה')).toBeInTheDocument();
    gazeRef.current = {
      horizontal: 0.4,
      vertical: 0,
      leftEye: { horizontal: 0.4, vertical: 0 },
      rightEye: { horizontal: 0.4, vertical: 0 },
      direction: 'left',
      reliability: 'reliable',
      reason: null,
    };

    act(() => vi.advanceTimersByTime(399));
    expect(screen.getByText('ימינה')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('שמאלה')).toBeInTheDocument();
  });

  it.each(['off', 'no-face', 'ready', 'error'])(
    'clears stale values when detection status changes to %s',
    (detectionStatus) => {
      const gazeRef = {
        current: {
          horizontal: -0.4,
          vertical: 0,
          leftEye: { horizontal: -0.4, vertical: 0 },
          rightEye: { horizontal: -0.4, vertical: 0 },
          direction: 'right',
          reliability: 'reliable',
          reason: null,
        },
      };
      const { rerender } = render(
        <EyeGazeDiagnostic detectionStatus="detected" gazeRef={gazeRef} />,
      );
      expect(screen.getByText('ימינה')).toBeInTheDocument();

      gazeRef.current = null;
      rerender(<EyeGazeDiagnostic detectionStatus={detectionStatus} gazeRef={gazeRef} />);

      expect(screen.getByText('לא ידוע')).toBeInTheDocument();
      expect(screen.queryByText('-0.400')).not.toBeInTheDocument();
    },
  );

  it('does not present an unknown/unreliable estimator result as center', () => {
    render(
      <EyeGazeDiagnostic
        detectionStatus="detected"
        gazeRef={{
          current: {
            horizontal: null,
            vertical: null,
            leftEye: { horizontal: null, vertical: null },
            rightEye: { horizontal: null, vertical: null },
            direction: 'unknown',
            reliability: 'unreliable',
            reason: 'eyes-closed-or-invalid',
          },
        }}
      />,
    );

    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
    expect(screen.queryByText('מרכז')).not.toBeInTheDocument();
    expect(screen.getByText('אמינות: לא אמינה / לא זמינה')).toBeInTheDocument();
  });
});
