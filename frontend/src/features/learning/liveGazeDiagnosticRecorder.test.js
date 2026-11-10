import { describe, expect, it } from 'vitest';
import { createLiveGazeDiagnosticRecorder } from './liveGazeDiagnosticRecorder.js';

function diagnosticSample(rawClassifierState, smoothedState) {
  return {
    modelReady: true,
    missingRequirements: [],
    liveFeatures: {
      faceDetected: true,
      headPoseValid: true,
      headYaw: 1.2,
      leftEyeValid: true,
      leftEyeHorizontal: -0.3,
    },
    rawClassifierState,
    smoothedState,
    classifierReason: rawClassifierState === 'UNKNOWN' ? 'ambiguous-calibration-match' : null,
    classifierScore: 0.4,
    availableFeatureGroups: ['headPose', 'eyeGaze'],
    calibrationDrift: false,
    classifierDiagnostics: {
      closestScreenProfile: { id: 'screen:CENTER', distance: 0.2 },
      closestOffscreenProfile: { id: 'away:LOOK_AWAY_LEFT:eyes', distance: 0.6 },
      decision: { reason: rawClassifierState === 'UNKNOWN' ? 'ambiguous-calibration-match' : null },
    },
  };
}

describe('live gaze diagnostic recorder', () => {
  it('records only the active expected stage and summarizes raw and smoothed predictions', () => {
    const recorder = createLiveGazeDiagnosticRecorder();
    recorder.start(100);
    const sample = diagnosticSample('LOOKING_AT_SCREEN', 'UNKNOWN');
    expect(recorder.record(sample, 120)).toBe(false);

    recorder.setStage({
      id: 'CENTER_BEFORE',
      expectedLabel: 'CENTER',
      expectedState: 'LOOKING_AT_SCREEN',
    }, 200);
    expect(recorder.record(sample, 250)).toBe(true);
    expect(recorder.record(diagnosticSample('UNKNOWN', 'LOOKING_AT_SCREEN'), 300)).toBe(true);
    recorder.endStage(400);
    expect(recorder.record(sample, 410)).toBe(false);

    recorder.setStage({
      id: 'LOOK_AWAY_LEFT',
      expectedLabel: 'LOOK_AWAY_LEFT',
      expectedState: 'LOOKING_AWAY',
    }, 500);
    recorder.record(diagnosticSample('LOOKING_AWAY', 'LOOKING_AWAY'), 550);
    recorder.stop(600);

    const snapshot = recorder.getSnapshot();
    expect(snapshot).toMatchObject({
      dataScope: 'browser-memory-only',
      recording: false,
      sampleCount: 3,
      stageSummaries: [
        {
          id: 'CENTER_BEFORE',
          expectedState: 'LOOKING_AT_SCREEN',
          sampleCount: 2,
          rawClassifierStateCounts: {
            LOOKING_AT_SCREEN: 1,
            LOOKING_AWAY: 0,
            UNKNOWN: 1,
          },
          smoothedStateCounts: {
            LOOKING_AT_SCREEN: 1,
            LOOKING_AWAY: 0,
            UNKNOWN: 1,
          },
        },
        {
          id: 'LOOK_AWAY_LEFT',
          expectedState: 'LOOKING_AWAY',
          sampleCount: 1,
        },
      ],
    });
    expect(snapshot.samples[0]).toMatchObject({
      timestampMs: 150,
      expectedStage: 'CENTER_BEFORE',
      expectedLabel: 'CENTER',
      classifierReason: null,
      classifierDiagnostics: {
        closestScreenProfile: { id: 'screen:CENTER', distance: 0.2 },
      },
    });
    expect(JSON.parse(recorder.serialize())).toEqual(snapshot);
  });

  it('cancels the active stage and rejects further samples', () => {
    const recorder = createLiveGazeDiagnosticRecorder();
    recorder.start(0);
    recorder.setStage({
      id: 'CENTER_BEFORE',
      expectedLabel: 'CENTER',
      expectedState: 'LOOKING_AT_SCREEN',
    }, 100);
    recorder.record(diagnosticSample('UNKNOWN', 'UNKNOWN'), 120);

    expect(recorder.stop(200)).toBe(true);
    expect(recorder.getSnapshot()).toMatchObject({
      recording: false,
      sampleCount: 1,
      stageSummaries: [{ endedAtMs: 200 }],
    });
    expect(recorder.record(diagnosticSample('UNKNOWN', 'UNKNOWN'), 220)).toBe(false);
    expect(recorder.stop(300)).toBe(false);
  });
});
