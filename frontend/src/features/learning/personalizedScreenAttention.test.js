import { describe, expect, it } from 'vitest';
import {
  classifyPersonalizedScreenAttention,
  createPersonalizedAttentionSmoother,
  createPersonalizedScreenAttentionModel,
  getPersonalizedScreenAttentionReadiness,
} from './personalizedScreenAttention.js';

const SCREEN_TARGETS = {
  CENTER: { yaw: 0, pitch: 0, roll: 0, horizontal: 0, vertical: 0 },
  TOP: { yaw: 0, pitch: -10, roll: 0, horizontal: 0, vertical: -0.3 },
  BOTTOM: { yaw: 0, pitch: 10, roll: 0, horizontal: 0, vertical: 0.3 },
  LEFT: { yaw: -10, pitch: 0, roll: 0, horizontal: -0.3, vertical: 0 },
  RIGHT: { yaw: 10, pitch: 0, roll: 0, horizontal: 0.3, vertical: 0 },
};

const OFFSCREEN_TARGETS = {
  LOOK_AWAY_LEFT: {
    eyes: { yaw: 0, pitch: 0, horizontal: -0.9, vertical: 0 },
    head: { yaw: -45, pitch: 0, horizontal: 0, vertical: 0 },
  },
  LOOK_AWAY_RIGHT: {
    eyes: { yaw: 0, pitch: 0, horizontal: 0.9, vertical: 0 },
    head: { yaw: 45, pitch: 0, horizontal: 0, vertical: 0 },
  },
  LOOK_AWAY_UP: {
    eyes: { yaw: 0, pitch: 0, horizontal: 0, vertical: -0.9 },
    head: { yaw: 0, pitch: -40, horizontal: 0, vertical: 0 },
  },
  LOOK_AWAY_DOWN: {
    eyes: { yaw: 0, pitch: 0, horizontal: 0, vertical: 0.9 },
    head: { yaw: 0, pitch: 40, horizontal: 0, vertical: 0 },
  },
};

function createMeasurement({ yaw, pitch, roll = 0, horizontal, vertical }, index = 0) {
  const jitter = (index % 5 - 2) * 0.006;
  const down = Math.max(0.05, vertical > 0.6 ? 0.85 : 0.1);
  const up = Math.max(0.05, vertical < -0.6 ? 0.85 : 0.1);
  const outLeft = horizontal < -0.6 ? 0.85 : 0.1;
  const inRight = horizontal < -0.6 ? 0.8 : 0.1;
  const inLeft = horizontal > 0.6 ? 0.85 : 0.1;
  const outRight = horizontal > 0.6 ? 0.8 : 0.1;

  return {
    faceDetected: true,
    headPoseValid: true,
    headYaw: yaw + jitter,
    headPitch: pitch + jitter,
    headRoll: roll + jitter,
    leftEyeValid: true,
    leftEyeHorizontal: horizontal + jitter,
    leftEyeVertical: vertical + jitter,
    rightEyeValid: true,
    rightEyeHorizontal: horizontal + jitter,
    rightEyeVertical: vertical + jitter,
    blendshapesValid: true,
    eyeLookDownLeft: down + jitter,
    eyeLookDownRight: down + jitter,
    eyeLookUpLeft: up + jitter,
    eyeLookUpRight: up + jitter,
    eyeLookInLeft: inLeft + jitter,
    eyeLookOutLeft: outLeft + jitter,
    eyeLookInRight: inRight + jitter,
    eyeLookOutRight: outRight + jitter,
  };
}

function repeatedSamples(target, movementMode, center) {
  return Array.from({ length: 10 }, (_, index) => ({
    ...createMeasurement(center, index),
    target,
    ...(movementMode ? { movementMode } : {}),
  }));
}

function createCalibration() {
  const screenCalibration = Object.fromEntries(
    Object.entries(SCREEN_TARGETS).map(([label, center]) => [
      label,
      { acceptedSamples: repeatedSamples(label, null, center) },
    ]),
  );
  const offscreenTargets = Object.fromEntries(
    Object.entries(OFFSCREEN_TARGETS).map(([label, modes]) => [
      label,
      {
        acceptedSamples: Object.entries(modes).flatMap(([movementMode, center]) => (
          repeatedSamples(label, movementMode, center)
        )),
      },
    ]),
  );
  return { screenCalibration, offscreenTargets, keyboardEvaluation: { acceptedSamples: [] } };
}

function liveMeasurement(target, movementMode = null, overrides = {}) {
  const center = movementMode
    ? OFFSCREEN_TARGETS[target][movementMode]
    : SCREEN_TARGETS[target];
  return { ...createMeasurement(center), ...overrides };
}

describe('personalized screen attention classifier', () => {
  it.each(Object.keys(SCREEN_TARGETS))('classifies calibrated screen target %s as on-screen', (target) => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    const result = classifyPersonalizedScreenAttention(model, liveMeasurement(target));
    expect(result.state)
      .toBe('LOOKING_AT_SCREEN');
  });

  it.each([
    ['LOOK_AWAY_LEFT', 'eyes'],
    ['LOOK_AWAY_RIGHT', 'eyes'],
    ['LOOK_AWAY_UP', 'eyes'],
    ['LOOK_AWAY_DOWN', 'eyes'],
    ['LOOK_AWAY_LEFT', 'head'],
    ['LOOK_AWAY_RIGHT', 'head'],
    ['LOOK_AWAY_UP', 'head'],
    ['LOOK_AWAY_DOWN', 'head'],
  ])('detects %s using %s movement', (target, movementMode) => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(
      model,
      liveMeasurement(target, movementMode),
    )).toMatchObject({
      state: 'LOOKING_AWAY',
      reason: null,
    });
  });

  it('uses the calibrated off-screen down target for keyboard gaze', () => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(
      model,
      liveMeasurement('LOOK_AWAY_DOWN', 'eyes'),
    )).toMatchObject({ state: 'LOOKING_AWAY' });
  });

  it.each([
    ['tilted', { headYaw: 0, headPitch: 0, headRoll: 65 }],
    ['slouched', { headYaw: 0, headPitch: 75, headRoll: 0 }],
    ['turned', { headYaw: 90, headPitch: 0, headRoll: 0 }],
  ])('returns unknown and suggests recalibration for %s posture drift', (posture, pose) => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(model, liveMeasurement('CENTER', null, pose))).toMatchObject({
      state: 'UNKNOWN',
      reason: 'calibration-drift',
      calibrationDrift: true,
      diagnostics: {
        decision: { reason: 'calibration-drift' },
        posture: {
          evaluated: true,
          calibrationDrift: true,
          closestHeadPoseProfile: { id: expect.any(String), distance: expect.any(Number) },
        },
      },
    });
  });

  it('returns unknown for a face loss or unavailable measurements', () => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(model, {
      ...liveMeasurement('CENTER'),
      faceDetected: false,
    })).toMatchObject({ state: 'UNKNOWN', reason: 'face-not-detected' });
    expect(classifyPersonalizedScreenAttention(model, liveMeasurement('CENTER', null, {
      headPoseValid: false,
      leftEyeValid: false,
      rightEyeValid: false,
      blendshapesValid: false,
    })).state).toBe('UNKNOWN');
  });

  it('does not interpret non-finite head measurements as posture drift', () => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(model, liveMeasurement('CENTER', null, {
      headRoll: Number.NaN,
      headPoseValid: true,
    })).calibrationDrift).toBe(false);
  });

  it('uses available eye features while ignoring unavailable head pose and blendshapes', () => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());

    expect(classifyPersonalizedScreenAttention(model, liveMeasurement('LOOK_AWAY_LEFT', 'eyes', {
      headPoseValid: false,
      blendshapesValid: false,
    }))).toMatchObject({
      state: 'LOOKING_AWAY',
      availableFeatureGroups: expect.arrayContaining(['eyeGaze']),
    });
  });

  it('does not build a model until every off-screen direction and movement mode is calibrated', () => {
    const calibration = createCalibration();
    calibration.offscreenTargets.LOOK_AWAY_UP.acceptedSamples = calibration.offscreenTargets
      .LOOK_AWAY_UP.acceptedSamples.filter((sample) => sample.movementMode !== 'head');

    expect(createPersonalizedScreenAttentionModel(calibration)).toBeNull();
  });

  it('exposes actual matching distances, coverage, and rejection diagnostics without changing the state', () => {
    const calibration = createCalibration();
    const model = createPersonalizedScreenAttentionModel(calibration);

    expect(getPersonalizedScreenAttentionReadiness(calibration)).toMatchObject({
      ready: true,
      missingRequirements: [],
    });
    const result = classifyPersonalizedScreenAttention(model, liveMeasurement('CENTER'));
    expect(result).toMatchObject({
      state: 'LOOKING_AT_SCREEN',
      reason: null,
      diagnostics: {
        closestScreenProfile: {
          id: 'screen:CENTER',
          distance: expect.any(Number),
          coverageGroups: expect.arrayContaining(['headPose', 'eyeGaze', 'blendshapes']),
        },
        closestOffscreenProfile: {
          id: expect.stringMatching(/^away:/),
          distance: expect.any(Number),
        },
        decision: {
          reason: null,
          minimumEvidence: expect.any(Number),
          hasCoverage: true,
          selectedState: 'LOOKING_AT_SCREEN',
        },
      },
    });
  });

  it('lists the actual missing target classes required to construct the model', () => {
    const calibration = createCalibration();
    calibration.offscreenTargets.LOOK_AWAY_LEFT.acceptedSamples = [];

    expect(getPersonalizedScreenAttentionReadiness(calibration)).toMatchObject({
      ready: false,
      missingRequirements: expect.arrayContaining([
        'away:LOOK_AWAY_LEFT:eyes:0/3',
        'away:LOOK_AWAY_LEFT:head:0/3',
      ]),
    });
  });

  it('exposes the actual conflicting feature groups when the classifier rejects a sample', () => {
    const model = createPersonalizedScreenAttentionModel(createCalibration());
    const result = classifyPersonalizedScreenAttention(
      model,
      {
        ...liveMeasurement('RIGHT'),
        headYaw: -45,
      },
    );
    expect(result).toMatchObject({
      state: 'UNKNOWN',
      reason: 'conflicting-feature-evidence',
      diagnostics: {
        decision: { reason: 'conflicting-feature-evidence' },
        conflict: {
          evaluated: true,
          detected: true,
          positiveFeatureGroups: expect.arrayContaining(['eyeGaze']),
          negativeFeatureGroups: expect.arrayContaining(['headPose']),
        },
      },
    });
  });
});

describe('personalized attention temporal smoothing', () => {
  it('holds state through brief unknown samples and transitions only after a stable change', () => {
    const smoother = createPersonalizedAttentionSmoother({
      transitionHoldMs: 400,
      unknownHoldMs: 300,
    });
    const screen = { state: 'LOOKING_AT_SCREEN' };
    const away = { state: 'LOOKING_AWAY' };
    const unknown = { state: 'UNKNOWN' };

    expect(smoother.addSample(screen, 0)).toBe('UNKNOWN');
    expect(smoother.addSample(screen, 200)).toBe('UNKNOWN');
    expect(smoother.addSample(screen, 400)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample(unknown, 600)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample(screen, 800)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample(away, 1000)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample(away, 1200)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample(away, 1400)).toBe('LOOKING_AWAY');
    expect(smoother.addSample(unknown, 1600)).toBe('LOOKING_AWAY');
    expect(smoother.addSample(unknown, 1900)).toBe('UNKNOWN');
  });

  it('immediately clears the status when the face disappears or posture drifts', () => {
    const smoother = createPersonalizedAttentionSmoother({ transitionHoldMs: 0 });

    expect(smoother.addSample({ state: 'LOOKING_AT_SCREEN' }, 0)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample({
      state: 'UNKNOWN',
      reason: 'face-not-detected',
    }, 200)).toBe('UNKNOWN');
    expect(smoother.addSample({ state: 'LOOKING_AT_SCREEN' }, 400)).toBe('LOOKING_AT_SCREEN');
    expect(smoother.addSample({
      state: 'UNKNOWN',
      reason: 'calibration-drift',
    }, 600)).toBe('UNKNOWN');
  });
});
