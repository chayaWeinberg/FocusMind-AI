import { describe, expect, it } from 'vitest';
import { createScreenAttentionTracker } from './screenAttentionTracker.js';

function estimate(state = 'LIKELY_ON_SCREEN', measurementQuality = 'reliable') {
  return { state, measurementQuality, qualityScore: 0.9 };
}

describe('screen attention tracker', () => {
  it('smooths transitions by requiring a stable candidate before changing state', () => {
    const tracker = createScreenAttentionTracker({ transitionHoldMs: 400 });
    expect(tracker.addSample(estimate(), 0).currentState).toBe('UNKNOWN');
    expect(tracker.addSample(estimate(), 200).currentState).toBe('UNKNOWN');
    expect(tracker.addSample(estimate(), 400).currentState).toBe('LIKELY_ON_SCREEN');

    expect(tracker.addSample(estimate('LIKELY_OFF_SCREEN'), 600).currentState).toBe('UNKNOWN');
    expect(tracker.addSample(estimate(), 800).currentState).toBe('UNKNOWN');
    expect(tracker.addSample(estimate(), 1000).currentState).toBe('UNKNOWN');
    expect(tracker.addSample(estimate(), 1200).currentState).toBe('LIKELY_ON_SCREEN');
  });

  it('keeps UNKNOWN time separate from likely off-screen time', () => {
    const tracker = createScreenAttentionTracker({ transitionHoldMs: 0 });
    tracker.addSample(estimate('LIKELY_OFF_SCREEN'), 0);
    tracker.addSample(estimate('LIKELY_OFF_SCREEN'), 200);
    tracker.addSample(estimate('UNKNOWN', 'unreliable'), 400);
    const summary = tracker.getSummary(600);

    expect(summary.offScreenMs).toBe(400);
    expect(summary.unknownMs).toBe(200);
    expect(summary.onScreenMs).toBe(0);
  });

  it('limits state durations to the rolling ten-second window', () => {
    const tracker = createScreenAttentionTracker({ transitionHoldMs: 0 });
    for (let timestamp = 0; timestamp <= 12_000; timestamp += 200) {
      tracker.addSample(estimate(), timestamp);
    }

    const summary = tracker.getSummary(12_000);
    expect(summary.onScreenMs).toBe(10_000);
    expect(summary.offScreenMs).toBe(0);
    expect(summary.unknownMs).toBe(0);
    expect(summary.sampleCount).toBe(51);
    expect(summary.windowMs).toBe(10_000);
  });

  it('counts long sampling gaps as unknown rather than extending a prior state', () => {
    const tracker = createScreenAttentionTracker({
      maxSampleGapMs: 300,
      transitionHoldMs: 0,
    });
    tracker.addSample(estimate(), 0);
    tracker.addSample(estimate(), 200);
    tracker.addSample(estimate('LIKELY_OFF_SCREEN'), 1000);
    const summary = tracker.getSummary(1200);

    expect(summary.onScreenMs).toBe(500);
    expect(summary.unknownMs).toBe(500);
    expect(summary.offScreenMs).toBe(200);
  });

  it('clears the active window and smoothing state on reset', () => {
    const tracker = createScreenAttentionTracker({ transitionHoldMs: 0 });
    tracker.addSample(estimate(), 0);
    tracker.addSample(estimate(), 200);

    tracker.reset();

    expect(tracker.getSamples()).toEqual([]);
    expect(tracker.getSummary()).toMatchObject({
      currentState: 'UNKNOWN',
      onScreenMs: 0,
      offScreenMs: 0,
      unknownMs: 0,
      measurementQuality: 'unreliable',
    });
  });
});
