import { describe, expect, it } from 'vitest';
import {
  RECORDING_DURATION_MS,
  createScreenAttentionDiagnosticRecorder,
} from './screenAttentionDiagnosticRecorder.js';

function sample(overrides = {}) {
  return {
    headYaw: -5.3,
    headPitch: -0.4,
    leftEyeHorizontal: 0.1,
    leftEyeVertical: -0.2,
    rightEyeHorizontal: 0.12,
    rightEyeVertical: -0.18,
    eyeMeasurementReliability: 'reliable',
    eyeReliabilityReason: 'Reason unavailable',
    combinedYaw: 2,
    combinedPitch: -4,
    screenAttentionState: 'LIKELY_ON_SCREEN',
    screenAttentionReason: 'Reason unavailable',
    smoothedScreenAttentionState: 'LIKELY_ON_SCREEN',
    eyeLookDownLeft: 0.717,
    eyeLookDownRight: 0.73,
    ...overrides,
  };
}

describe('screen attention diagnostic recorder', () => {
  it('clears previous recording samples when a new recording starts', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(100);
    recorder.record(sample(), 200);
    recorder.stop(300);

    recorder.start(1000);

    expect(recorder.getSnapshot()).toMatchObject({
      recording: true,
      totalSamples: 0,
      startedAt: 1000,
      stoppedAt: null,
    });
  });

  it('stores synchronized values with a timestamp relative to the start', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(10_000);
    recorder.record(sample(), 10_200);
    const [recorded] = recorder.getSnapshot().samples;

    expect(recorded).toMatchObject({
      timestampMs: 200,
      headYaw: -5.3,
      headPitch: -0.4,
      leftEyeHorizontal: 0.1,
      rightEyeVertical: -0.18,
      combinedYaw: 2,
      combinedPitch: -4,
      screenAttentionState: 'LIKELY_ON_SCREEN',
      eyeLookDownLeft: 0.717,
      eyeLookDownRight: 0.73,
    });
    expect(recorded).not.toHaveProperty('faceLandmarks');
    expect(recorded).not.toHaveProperty('image');
  });

  it('stores unavailable reasons as provided without inventing a classification reason', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(0);
    recorder.record(sample({
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'eyes-closed-or-invalid',
      combinedYaw: null,
      combinedPitch: null,
      screenAttentionState: 'UNKNOWN',
      screenAttentionReason: 'unreliable-measurements',
      smoothedScreenAttentionState: 'UNKNOWN',
    }), 200);

    expect(recorder.getSnapshot().samples[0]).toMatchObject({
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'eyes-closed-or-invalid',
      combinedYaw: null,
      combinedPitch: null,
      screenAttentionState: 'UNKNOWN',
      screenAttentionReason: 'unreliable-measurements',
    });
  });

  it('stops accepting samples at the ten-second limit', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(0);
    recorder.record(sample(), RECORDING_DURATION_MS - 1);
    expect(recorder.record(sample(), RECORDING_DURATION_MS)).toBe(false);

    expect(recorder.getSnapshot()).toMatchObject({
      recording: false,
      totalSamples: 1,
      durationMs: RECORDING_DURATION_MS,
    });
  });

  it('exports counts and samples as JSON without image or landmark fields', () => {
    const recorder = createScreenAttentionDiagnosticRecorder();
    recorder.start(0);
    recorder.record(sample(), 200);
    recorder.record(sample({
      eyeMeasurementReliability: 'unreliable',
      screenAttentionState: 'LIKELY_OFF_SCREEN',
    }), 400);
    recorder.record(sample({
      screenAttentionState: 'UNKNOWN',
    }), 600);

    const exported = JSON.parse(recorder.serialize());

    expect(exported).toMatchObject({
      schemaVersion: 1,
      recordingDurationLimitMs: RECORDING_DURATION_MS,
      sampleCount: 3,
      reliableSampleCount: 2,
      stateSampleCounts: {
        likelyOnScreen: 1,
        likelyOffScreen: 1,
        unknown: 1,
      },
    });
    expect(exported.samples).toHaveLength(3);
    expect(JSON.stringify(exported)).not.toMatch(/faceLandmarks|image|videoFrame/i);
  });
});
