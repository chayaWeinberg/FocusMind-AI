import { describe, expect, it } from 'vitest';
import {
  assessWebGazerPrediction,
  createWebGazerExperimentRecorder,
  WEBGAZER_STATES,
} from './webGazerExperiment.js';

const BOUNDS = { width: 1000, height: 800 };

function stableHistory(x, y, now = 1000) {
  return Array.from({ length: 8 }, (_, index) => ({
    x: x + (index % 2),
    y: y + (index % 2),
    timestamp: now - (7 - index) * 100,
  }));
}

describe('WebGazer experiment assessment', () => {
  it('classifies a stable in-bounds calibrated estimate as a screen estimate', () => {
    expect(assessWebGazerPrediction({
      prediction: { x: 500, y: 400 },
      history: stableHistory(500, 400),
      now: 1000,
      bounds: BOUNDS,
      calibrated: true,
    })).toMatchObject({
      state: WEBGAZER_STATES.SCREEN,
      insideScreenBounds: true,
      predictionAvailable: true,
      quality: { stable: true, confidence: null, confidenceAvailable: false },
    });
  });

  it('only estimates looking away for stable predictions beyond a generous margin', () => {
    expect(assessWebGazerPrediction({
      prediction: { x: 1200, y: 400 },
      history: stableHistory(1200, 400),
      now: 1000,
      bounds: BOUNDS,
      calibrated: true,
    })).toMatchObject({
      state: WEBGAZER_STATES.AWAY,
      insideScreenBounds: false,
      reason: 'stable-prediction-beyond-screen-margin',
    });
  });

  it('returns unknown for near-edge out-of-bounds estimates instead of treating them as proof', () => {
    expect(assessWebGazerPrediction({
      prediction: { x: -20, y: 400 },
      history: stableHistory(-20, 400),
      now: 1000,
      bounds: BOUNDS,
      calibrated: true,
    })).toMatchObject({
      state: WEBGAZER_STATES.UNKNOWN,
      insideScreenBounds: false,
      reason: 'prediction-near-screen-boundary',
    });
  });

  it('returns unknown before calibration and when predictions are unstable or missing', () => {
    const history = stableHistory(500, 400);
    expect(assessWebGazerPrediction({
      prediction: { x: 500, y: 400 },
      history,
      now: 1000,
      bounds: BOUNDS,
      calibrated: false,
    }).reason).toBe('calibration-incomplete');
    expect(assessWebGazerPrediction({
      prediction: { x: 500, y: 400 },
      history: [{ x: 500, y: 400, timestamp: 1000 }],
      now: 1000,
      bounds: BOUNDS,
      calibrated: true,
    }).state).toBe(WEBGAZER_STATES.UNKNOWN);
    expect(assessWebGazerPrediction({
      prediction: null,
      history,
      now: 1000,
      bounds: BOUNDS,
      calibrated: true,
    })).toMatchObject({
      state: WEBGAZER_STATES.UNKNOWN,
      predictionAvailable: false,
      insideScreenBounds: null,
    });
  });
});

describe('WebGazer experiment diagnostic recorder', () => {
  it('stores expected conditions, measured values, quality and missing pose without images', () => {
    const recorder = createWebGazerExperimentRecorder();
    recorder.start(100);
    recorder.setStage({
      id: 'B_EYES_ONLY_AWAY',
      expectedCondition: 'B — מחוץ למסך, עיניים בלבד',
      expectedState: WEBGAZER_STATES.AWAY,
    }, 200);

    expect(recorder.record({
      x: 1200,
      y: 400,
      screenBounds: BOUNDS,
      state: WEBGAZER_STATES.AWAY,
      predictionAvailable: true,
      quality: { recentPredictionCount: 8, spreadPx: 4, stable: true, confidence: null },
    }, 300)).toBe(true);

    const snapshot = recorder.getSnapshot();
    expect(snapshot).toMatchObject({
      dataScope: 'browser-memory-only',
      limitations: {
        outOfBoundsIsNotProofOfLookingAway: true,
        confidenceAvailable: false,
        headPoseAvailable: false,
      },
      samples: [{
        timestampMs: 200,
        expectedCondition: 'B — מחוץ למסך, עיניים בלבד',
        expectedState: WEBGAZER_STATES.AWAY,
        gazeCoordinates: { x: 1200, y: 400 },
        screenBounds: BOUNDS,
        predictedState: WEBGAZER_STATES.AWAY,
        estimationAvailable: true,
        quality: {
          recentPredictionCount: 8,
          spreadPx: 4,
          stable: true,
          confidence: null,
          confidenceAvailable: false,
        },
        headPose: { available: false, yaw: null, pitch: null, roll: null },
      }],
    });
    expect(snapshot.samples[0]).not.toHaveProperty('image');
    expect(snapshot.samples[0]).not.toHaveProperty('video');
    expect(snapshot.samples[0]).not.toHaveProperty('audio');
    expect(JSON.parse(recorder.serialize())).toMatchObject({
      sampleCount: 1,
      stageSummaries: [{
        expectedCondition: 'B — מחוץ למסך, עיניים בלבד',
        predictedStateCounts: { [WEBGAZER_STATES.AWAY]: 1 },
      }],
    });
  });

  it('rate limits sample collection and stops an active stage cleanly', () => {
    const recorder = createWebGazerExperimentRecorder();
    recorder.start(0);
    recorder.setStage({
      id: 'A_SCREEN_HEAD_STILL',
      expectedCondition: 'A — מסך, ראש יציב',
      expectedState: WEBGAZER_STATES.SCREEN,
    }, 10);
    const estimate = {
      state: WEBGAZER_STATES.UNKNOWN,
      predictionAvailable: false,
      quality: {},
    };

    expect(recorder.record(estimate, 100)).toBe(true);
    expect(recorder.record(estimate, 150)).toBe(false);
    expect(recorder.record(estimate, 300)).toBe(true);
    expect(recorder.stop(400)).toBe(true);
    expect(recorder.getSnapshot()).toMatchObject({
      recording: false,
      sampleCount: 2,
      stageSummaries: [{
        expectedState: WEBGAZER_STATES.SCREEN,
        predictedStateCounts: { [WEBGAZER_STATES.UNKNOWN]: 2 },
      }],
    });
  });
});
