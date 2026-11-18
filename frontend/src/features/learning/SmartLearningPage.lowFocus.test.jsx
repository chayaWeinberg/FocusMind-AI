// The low-concentration alert on the Smart Learning page. The attention
// monitor is replaced by a stub, so the test controls the concentration
// estimate (0-100) the page receives.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SmartLearningPage, { LOW_FOCUS } from './SmartLearningPage.jsx';

let report;
vi.mock('./AttentionMonitor.jsx', () => ({
  default: ({ onStateChange }) => {
    report = onStateChange;
    return <section aria-label="Focus Monitor (stub)" />;
  },
}));

function advance(milliseconds) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

/** Reports the same estimate every 500 ms for `milliseconds`. */
function concentration(score, milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 500) {
    act(() => report('ON_SCREEN', score));
    advance(500);
  }
}

function startLocalVideo() {
  render(<SmartLearningPage />);
  const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' });
  fireEvent.change(screen.getByLabelText('בחירת סרטון מהמכשיר'), { target: { files: [file] } });
  const video = screen.getByLabelText('נגן וידאו: lesson.mp4');
  vi.spyOn(video, 'pause').mockImplementation(() => {});
  fireEvent.playing(video);
  return video;
}

describe('SmartLearningPage low-concentration alert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T08:00:00Z'));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:lesson'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('alerts only after the estimate stays low, and hides it once it recovers', () => {
    startLocalVideo();
    concentration(30, LOW_FOCUS.holdMs - 1000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    concentration(30, 2000);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('נראה שהריכוז ירד (30%)');
    expect(alert).toHaveTextContent(`נמוכה מ-${LOW_FOCUS.belowScore}%`);

    concentration(65, 2000); // between the thresholds: stays
    expect(screen.getByRole('alert')).toBeInTheDocument();
    concentration(LOW_FOCUS.recoverScore, 500);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rewinds the video, and stays hidden after "הבנתי" until it recovers', () => {
    const video = startLocalVideo();
    video.currentTime = 95;
    concentration(20, LOW_FOCUS.holdMs + 1000);
    fireEvent.click(screen.getByRole('button', { name: `חזרה ${LOW_FOCUS.rewindSeconds} שניות אחורה` }));
    expect(video.currentTime).toBe(85);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    concentration(20, LOW_FOCUS.holdMs + 1000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // dismissed until recovery

    concentration(LOW_FOCUS.recoverScore + 5, 500);
    concentration(20, LOW_FOCUS.holdMs + 1000);
    fireEvent.click(screen.getByRole('button', { name: 'הבנתי' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the course model score (0..1) when there is one', () => {
    startLocalVideo();
    // The concentration estimate looks fine, but the model says attention is low.
    for (let elapsed = 0; elapsed < LOW_FOCUS.holdMs + 1000; elapsed += 500) {
      act(() => report('ON_SCREEN', 90, 0.31));
      advance(500);
    }
    expect(screen.getByRole('alert')).toHaveTextContent('נראה שהקשב ירד (ציון 0.31)');
    expect(screen.getByRole('alert')).toHaveTextContent(`ציון הקשב נמוך מ-${(LOW_FOCUS.belowScore / 100).toFixed(1)}`);

    act(() => report('ON_SCREEN', 20, 0.8)); // model recovered: hidden, whatever the estimate says
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never alerts while the session is paused or without an estimate', () => {
    const video = startLocalVideo();
    fireEvent.pause(video);
    concentration(10, LOW_FOCUS.holdMs + 2000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.playing(video);
    concentration(null, LOW_FOCUS.holdMs + 2000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
