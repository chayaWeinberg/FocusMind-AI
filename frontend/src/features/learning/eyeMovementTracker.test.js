import { describe, expect, it } from 'vitest';
import { createEyeMovementTracker } from './eyeMovementTracker.js';

function gaze({
  leftHorizontal = 0,
  leftVertical = 0,
  rightHorizontal = 0,
  rightVertical = 0,
  reliability = 'reliable',
} = {}) {
  return {
    leftEye: { horizontal: leftHorizontal, vertical: leftVertical },
    rightEye: { horizontal: rightHorizontal, vertical: rightVertical },
    reliability,
  };
}

describe('createEyeMovementTracker', () => {
  it('classifies repeated stable gaze as relatively stable', () => {
    const tracker = createEyeMovementTracker();
    for (let index = 0; index < 5; index += 1) {
      tracker.addSample(gaze(), 1000 + index * 200);
    }

    expect(tracker.getSummary(1800)).toMatchObject({
      validMeasurements: 5,
      totalMeasurements: 5,
      reliablePercentage: 100,
      averageMovementMagnitude: 0,
      averageMovementRate: 0,
      significantMovementCount: 0,
      gazeStability: 'stable',
      insufficientData: false,
    });
  });

  it('filters small gradual movement and uses elapsed time for movement rate', () => {
    const tracker = createEyeMovementTracker();
    for (let index = 0; index < 6; index += 1) {
      const shift = index * 0.01;
      tracker.addSample(gaze({
        leftHorizontal: shift,
        rightHorizontal: shift,
      }), 1000 + index * 200);
    }

    const summary = tracker.getSummary(2000);
    expect(summary.averageMovementMagnitude).toBe(0);
    expect(summary.averageMovementRate).toBe(0);
    expect(summary.significantMovementCount).toBe(0);
  });

  it('counts significant eye movement without relying on coarse direction labels', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);
    tracker.addSample(gaze({
      leftHorizontal: 0.4,
      rightHorizontal: 0.4,
    }), 1200);
    for (let index = 2; index < 6; index += 1) {
      tracker.addSample(gaze({
        leftHorizontal: 0.4,
        rightHorizontal: 0.4,
      }), 1000 + index * 200);
    }

    const summary = tracker.getSummary(2000);
    expect(summary.significantMovementCount).toBe(1);
    expect(summary.averageMovementMagnitude).toBeGreaterThan(0);
    expect(summary.averageMovementRate).toBeGreaterThan(0);
    expect(summary.gazeStability).not.toBe('stable');
  });

  it('filters small noisy changes below the conservative movement floor', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);
    tracker.addSample(gaze({
      leftHorizontal: 0.01,
      rightHorizontal: -0.01,
      leftVertical: -0.01,
      rightVertical: 0.01,
    }), 1200);
    for (let index = 2; index < 6; index += 1) {
      tracker.addSample(gaze(), 1000 + index * 200);
    }

    expect(tracker.getSummary(2000)).toMatchObject({
      significantMovementCount: 0,
      averageMovementMagnitude: 0,
      gazeStability: 'stable',
    });
  });

  it('records blinks and missing measurements as unreliable gaps, not zero motion', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);
    tracker.addSample({ reliability: 'unreliable' }, 1200);
    tracker.addSample(null, 1400);
    tracker.addSample(gaze({
      leftHorizontal: 0.5,
      rightHorizontal: 0.5,
    }), 1600);

    const samples = tracker.getSamples();
    expect(samples.map((sample) => sample.reliability)).toEqual([
      'reliable',
      'unreliable',
      'unreliable',
      'reliable',
    ]);
    expect(samples[1].leftEye).toBeNull();
    expect(tracker.getSummary(1600)).toMatchObject({
      validMeasurements: 2,
      totalMeasurements: 4,
      reliablePercentage: 50,
      significantMovementCount: 0,
      averageMovementMagnitude: null,
    });
  });

  it('does not count a large displacement across an excessive time gap', () => {
    const tracker = createEyeMovementTracker({ maxSampleGapMs: 600 });
    tracker.addSample(gaze(), 1000);
    tracker.addSample(gaze({
      leftHorizontal: 0.5,
      rightHorizontal: 0.5,
    }), 1700);
    tracker.addSample(gaze({
      leftHorizontal: 0.5,
      rightHorizontal: 0.5,
    }), 1900);

    expect(tracker.getSummary(1900)).toMatchObject({
      significantMovementCount: 0,
      averageMovementMagnitude: 0,
    });
  });

  it('keeps only samples in the rolling ten-second window', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);
    tracker.addSample({ reliability: 'unreliable' }, 5000);
    tracker.addSample(gaze(), 10_000);
    const summary = tracker.getSummary(11_001);

    expect(tracker.getSamples().map(({ timestamp }) => timestamp)).toEqual([5000, 10_000]);
    expect(summary.totalMeasurements).toBe(2);
    expect(summary.validMeasurements).toBe(1);
    expect(summary.reliablePercentage).toBe(50);
  });

  it('reports insufficient data until the minimum reliable sample count is reached', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);

    expect(tracker.getSummary(1000)).toMatchObject({
      validMeasurements: 1,
      gazeStability: 'insufficient-data',
      insufficientData: true,
    });
  });

  it('resets all in-memory samples and summary data', () => {
    const tracker = createEyeMovementTracker();
    tracker.addSample(gaze(), 1000);
    tracker.reset();

    expect(tracker.getSamples()).toEqual([]);
    expect(tracker.getSummary(1000)).toMatchObject({
      totalMeasurements: 0,
      validMeasurements: 0,
      reliablePercentage: 0,
      significantMovementCount: 0,
      gazeStability: 'insufficient-data',
      insufficientData: true,
    });
  });

  it('rejects invalid and non-monotonic timestamps explicitly', () => {
    const tracker = createEyeMovementTracker();
    expect(() => tracker.addSample(gaze(), Number.NaN)).toThrow(TypeError);
    tracker.addSample(gaze(), 1000);
    expect(() => tracker.addSample(gaze(), 1000)).toThrow(RangeError);
  });
});
