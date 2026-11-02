import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EyeMovementDiagnostic from './EyeMovementDiagnostic.jsx';

describe('EyeMovementDiagnostic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows insufficient data before enough valid samples are available', () => {
    render(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={{ current: null }}
      />,
    );

    expect(screen.getAllByText('נתונים לא מספיקים').length).toBeGreaterThan(0);
    expect(screen.getByText('יציבות מבט')).toBeInTheDocument();
    expect(screen.getByText('חלון של 10 שניות')).toBeInTheDocument();
  });

  it('displays the rolling movement summary', () => {
    render(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={{
          current: {
            validMeasurements: 8,
            totalMeasurements: 10,
            reliablePercentage: 80,
            averageMovementMagnitude: 0.04,
            averageMovementRate: 0.2,
            significantMovementCount: 2,
            gazeStability: 'some-movement',
            insufficientData: false,
          },
        }}
      />,
    );

    expect(screen.getByText('המעקב פעיל · מדידה ניסיונית בלבד')).toBeInTheDocument();
    expect(screen.getByText('80% (8/10)')).toBeInTheDocument();
    expect(screen.getByText('0.040')).toBeInTheDocument();
    expect(screen.getByText('0.200')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('נרשמה תנועה')).toBeInTheDocument();
    expect(screen.getByText(/אינו מודד קשב/)).toBeInTheDocument();
  });

  it('updates from its ref at a limited 400ms cadence', () => {
    vi.useFakeTimers();
    const summaryRef = {
      current: {
        validMeasurements: 5,
        totalMeasurements: 5,
        reliablePercentage: 100,
        averageMovementMagnitude: 0,
        averageMovementRate: 0,
        significantMovementCount: 0,
        gazeStability: 'stable',
        insufficientData: false,
      },
    };
    render(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={summaryRef}
      />,
    );

    expect(screen.getByText('יציב יחסית')).toBeInTheDocument();
    summaryRef.current = {
      ...summaryRef.current,
      significantMovementCount: 1,
      gazeStability: 'some-movement',
    };

    act(() => vi.advanceTimersByTime(399));
    expect(screen.getByText('יציב יחסית')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('נרשמה תנועה')).toBeInTheDocument();
  });

  it('shows a paused state and clears stale metrics when playback pauses', () => {
    const summaryRef = {
      current: {
        validMeasurements: 5,
        totalMeasurements: 5,
        reliablePercentage: 100,
        averageMovementMagnitude: 0,
        averageMovementRate: 0,
        significantMovementCount: 0,
        gazeStability: 'stable',
        insufficientData: false,
      },
    };
    const { rerender } = render(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={summaryRef}
      />,
    );
    expect(screen.getByText('יציב יחסית')).toBeInTheDocument();

    summaryRef.current = null;
    rerender(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="paused"
        summaryRef={summaryRef}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('המעקב מושהה');
    expect(screen.getAllByText('נתונים לא מספיקים').length).toBeGreaterThan(0);
    expect(screen.queryByText('100% (5/5)')).not.toBeInTheDocument();
  });

  it('prioritizes camera unavailability over playback state', () => {
    render(
      <EyeMovementDiagnostic
        cameraAvailable={false}
        videoPlaybackState="playing"
        summaryRef={{ current: null }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('המצלמה אינה זמינה');
  });

  it('reports insufficient data while playback is active and samples are not ready', () => {
    render(
      <EyeMovementDiagnostic
        cameraAvailable
        videoPlaybackState="playing"
        summaryRef={{ current: null }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('נתונים לא מספיקים');
  });
});
