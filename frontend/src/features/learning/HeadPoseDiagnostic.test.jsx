import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeadPoseDiagnostic from './HeadPoseDiagnostic.jsx';

describe('HeadPoseDiagnostic', () => {
  const validDetectionSample = {
    current: {
      matrix: {
        rows: 4,
        columns: 4,
        data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.1, 0.2, 0.3, 1],
      },
      pose: { yaw: 2.2, pitch: 0.4, roll: -2.1, direction: 'forward' },
    },
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows an explicit unknown state when no face pose is available', () => {
    render(<HeadPoseDiagnostic detectionStatus="off" poseRef={{ current: null }} />);

    expect(screen.getByLabelText('אבחון תנוחת ראש')).toHaveTextContent('Yaw—');
    expect(screen.getByLabelText('אבחון תנוחת ראש')).toHaveTextContent('Pitch—');
    expect(screen.getByLabelText('אבחון תנוחת ראש')).toHaveTextContent('Roll—');
    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
  });

  it('displays raw pose angles and marks direction labels as provisional', () => {
    const poseRef = {
      current: { yaw: -26.4, pitch: 8.25, roll: 1, direction: 'left' },
    };
    render(<HeadPoseDiagnostic detectionStatus="detected" poseRef={poseRef} />);

    expect(screen.getByText('-26.4°')).toBeInTheDocument();
    expect(screen.getByText('8.3°')).toBeInTheDocument();
    expect(screen.getByText('1.0°')).toBeInTheDocument();
    expect(screen.getByText('שמאלה')).toBeInTheDocument();
    expect(screen.getAllByText(/זמני/)).toHaveLength(2);
  });

  it('reads updated pose values at a limited 400ms interval', () => {
    vi.useFakeTimers();
    const poseRef = {
      current: { yaw: 10, pitch: 0, roll: 0, direction: 'forward' },
    };
    render(<HeadPoseDiagnostic detectionStatus="detected" poseRef={poseRef} />);

    expect(screen.getByText('10.0°')).toBeInTheDocument();
    poseRef.current = { yaw: 30, pitch: 0, roll: 0, direction: 'right' };

    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByText('30.0°')).not.toBeInTheDocument();
    expect(screen.getByText('10.0°')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('30.0°')).toBeInTheDocument();
    expect(screen.getByText('ימינה')).toBeInTheDocument();
  });

  it.each(['off', 'no-face', 'error', 'ready'])('clears stale values when status becomes %s', (status) => {
    const poseRef = {
      current: { yaw: 32, pitch: -4, roll: 3, direction: 'right' },
    };
    const { rerender } = render(
      <HeadPoseDiagnostic detectionStatus="detected" poseRef={poseRef} />,
    );
    expect(screen.getByText('32.0°')).toBeInTheDocument();

    poseRef.current = null;
    rerender(<HeadPoseDiagnostic detectionStatus={status} poseRef={poseRef} />);

    expect(screen.queryByText('32.0°')).not.toBeInTheDocument();
    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
  });

  it('displays unknown when pose angles are invalid', () => {
    const poseRef = {
      current: { yaw: null, pitch: null, roll: null, direction: 'unknown' },
    };
    render(<HeadPoseDiagnostic detectionStatus="detected" poseRef={poseRef} />);

    expect(screen.getByText('לא ידוע')).toBeInTheDocument();
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });

  it('only enables pose capture while the camera is active and a valid face matrix is available', () => {
    const captureButtonName = 'לכידת מצב ניטרלי';
    const { rerender } = render(
      <HeadPoseDiagnostic
        cameraActive
        detectionStatus="detected"
        poseRef={{ current: validDetectionSample.current.pose }}
        detectionSampleRef={{ current: null }}
      />,
    );
    expect(screen.getByRole('button', { name: captureButtonName })).toBeDisabled();

    rerender(
      <HeadPoseDiagnostic
        cameraActive
        detectionStatus="detected"
        poseRef={{ current: validDetectionSample.current.pose }}
        detectionSampleRef={validDetectionSample}
      />,
    );
    expect(screen.getByRole('button', { name: captureButtonName })).toBeEnabled();

    rerender(
      <HeadPoseDiagnostic
        cameraActive={false}
        detectionStatus="detected"
        poseRef={{ current: validDetectionSample.current.pose }}
        detectionSampleRef={validDetectionSample}
      />,
    );
    expect(screen.getByRole('button', { name: captureButtonName })).toBeDisabled();
  });

  it('captures labeled raw matrices and calculated angles, then copies the three samples as JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });
    const detectionSampleRef = { current: validDetectionSample.current };
    render(
      <HeadPoseDiagnostic
        cameraActive
        detectionStatus="detected"
        poseRef={{ current: validDetectionSample.current.pose }}
        detectionSampleRef={detectionSampleRef}
      />,
    );

    const neutralButton = screen.getByRole('button', { name: 'לכידת מצב ניטרלי' });
    const upButton = screen.getByRole('button', { name: 'לכידת הטיה למעלה' });
    const rightButton = screen.getByRole('button', { name: 'לכידת סיבוב ימינה' });
    const copyButton = screen.getByRole('button', { name: 'העתקת JSON' });
    expect(copyButton).toBeDisabled();

    fireEvent.click(neutralButton);
    detectionSampleRef.current = {
      ...validDetectionSample.current,
      matrix: { ...validDetectionSample.current.matrix, data: [2, ...validDetectionSample.current.matrix.data.slice(1)] },
      pose: { yaw: 1.1, pitch: 12.5, roll: 0.2 },
    };
    fireEvent.click(upButton);
    detectionSampleRef.current = {
      ...validDetectionSample.current,
      matrix: { ...validDetectionSample.current.matrix, data: [3, ...validDetectionSample.current.matrix.data.slice(1)] },
      pose: { yaw: 20.5, pitch: 1.2, roll: -0.5 },
    };
    fireEvent.click(rightButton);

    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    expect(await screen.findByText('הדגימות הועתקו ללוח.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(1);
    const exported = JSON.parse(writeText.mock.calls[0][0]);
    expect(exported.samples).toHaveLength(3);
    expect(exported.samples.map(({ label }) => label)).toEqual(['neutral', 'up', 'right']);
    expect(exported.samples[0]).toMatchObject({
      labelText: 'Neutral - ראש מול המצלמה',
      matrix: {
        rows: 4,
        columns: 4,
        data: validDetectionSample.current.matrix.data,
      },
      pose: { yaw: 2.2, pitch: 0.4, roll: -2.1 },
    });
    expect(JSON.stringify(exported)).not.toMatch(/image|video|frame/i);
  });

  it('does not capture malformed matrices or pose results', () => {
    const invalidSampleRef = {
      current: {
        matrix: { rows: 4, columns: 4, data: [1, 2, 3] },
        pose: { yaw: 0, pitch: 0, roll: 0 },
      },
    };
    render(
      <HeadPoseDiagnostic
        cameraActive
        detectionStatus="detected"
        poseRef={{ current: null }}
        detectionSampleRef={invalidSampleRef}
      />,
    );
    expect(screen.getByRole('button', { name: 'לכידת מצב ניטרלי' })).toBeDisabled();
  });
});
