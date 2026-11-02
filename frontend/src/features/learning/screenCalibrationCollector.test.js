import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_TARGETS,
  MAX_REJECTED_SAMPLES_PER_TARGET,
  createScreenCalibrationCollector,
  createScreenCalibrationSession,
} from './screenCalibrationCollector.js';

function validSample(overrides = {}) {
  return {
    faceDetected: true,
    headPose: { yaw: 2, pitch: -1, roll: 0.5 },
    eyeGaze: {
      leftEye: { horizontal: 0.1, vertical: -0.2 },
      rightEye: { horizontal: 0.12, vertical: -0.18 },
      reliability: 'reliable',
      reason: null,
    },
    blendshapes: {
      eyeLookDownLeft: 0.3,
      eyeLookDownRight: 0.31,
      eyeLookUpLeft: 0.1,
      eyeLookUpRight: 0.11,
    },
    ...overrides,
  };
}

function advanceTarget(session, startAt, targetLabel) {
  session.tick(startAt + 3000);
  expect(session.getSnapshot(startAt + 3000).status).toBe('collecting');
  session.recordSample(validSample(), startAt + 3000);
  session.recordSample(validSample({ headPose: { yaw: 4, pitch: -1, roll: 1 } }), startAt + 3200);
  expect(session.getSnapshot(startAt + 3300).target.label).toBe(targetLabel);
  session.tick(startAt + 7000);
}

describe('screen calibration collector', () => {
  it('uses the five declared screen targets in sequence after each countdown and collection period', () => {
    const session = createScreenCalibrationSession({
      countdownMs: 3000,
      targetDurationMs: 4000,
      minimumReliableSamples: 2,
    });
    session.start(0);

    expect(session.getSnapshot(0)).toMatchObject({
      status: 'countdown',
      target: { label: 'CENTER', xPercent: 50, yPercent: 50 },
      secondsRemaining: 3,
    });

    CALIBRATION_TARGETS.forEach(({ label }, index) => {
      const startAt = index * 7000;
      advanceTarget(session, startAt, label);
      if (index < CALIBRATION_TARGETS.length - 1) {
        expect(session.getSnapshot(startAt + 7000)).toMatchObject({
          status: 'countdown',
          target: { label: CALIBRATION_TARGETS[index + 1].label },
        });
      }
    });
    expect(session.getSnapshot(35_000).status).toBe('awaiting-keyboard-or-complete');
  });

  it('rejects invalid measurements and retains rejection reason counts', () => {
    const collector = createScreenCalibrationCollector();
    collector.reset(100);

    expect(collector.record('CENTER', validSample({ faceDetected: false }), 200)).toMatchObject({
      accepted: false,
      rejectionReason: 'missing-face',
    });
    expect(collector.record('CENTER', validSample({
      headPose: { yaw: null, pitch: 0 },
    }), 300)).toMatchObject({
      accepted: false,
      rejectionReason: 'invalid-head-pose',
    });
    expect(collector.record('CENTER', validSample({
      eyeGaze: { reliability: 'unreliable', reason: 'eyes-closed-or-invalid' },
    }), 400)).toMatchObject({
      accepted: false,
      rejectionReason: 'eyes-closed-or-invalid',
    });
    expect(collector.record('CENTER', validSample({
      eyeGaze: {
        reliability: 'reliable',
        leftEye: { horizontal: 0, vertical: 0 },
        rightEye: { horizontal: Number.NaN, vertical: 0 },
      },
    }), 500)).toMatchObject({
      accepted: false,
      rejectionReason: 'missing-required-measurement',
    });

    expect(collector.getSnapshot().targets.CENTER).toMatchObject({
      acceptedSampleCount: 0,
      rejectedSampleCount: 4,
      rejectionReasons: {
        'missing-face': 1,
        'invalid-head-pose': 1,
        'eyes-closed-or-invalid': 1,
        'missing-required-measurement': 1,
      },
    });
    expect(collector.getSnapshot().targets.CENTER.rejectedSamples).toHaveLength(4);
    expect(collector.getSnapshot().targets.CENTER.acceptedSamples).toEqual([]);
  });

  it('preserves bounded scalar diagnostics for rejected samples without affecting accepted statistics', () => {
    const collector = createScreenCalibrationCollector();
    collector.reset(100);
    const rejectedSample = validSample({
      headPose: { yaw: 15, pitch: -6, roll: Number.POSITIVE_INFINITY },
      eyeGaze: {
        leftEye: { horizontal: 0.4, vertical: Number.NaN },
        rightEye: { horizontal: null, vertical: -0.2 },
        reliability: 'unreliable',
        reason: 'eyes-closed-or-invalid',
      },
      blendshapes: {
        eyeLookDownLeft: 0.8,
        eyeLookDownRight: Number.POSITIVE_INFINITY,
        eyeLookUpLeft: Number.NaN,
        eyeLookUpRight: 0.1,
      },
    });

    expect(collector.record('CENTER', rejectedSample, 250)).toMatchObject({
      accepted: false,
      rejectionReason: 'eyes-closed-or-invalid',
    });
    collector.record('CENTER', validSample(), 300);
    const report = JSON.parse(collector.serialize());
    const center = report.screenCalibration.CENTER;

    expect(report.schemaVersion).toBe(2);
    expect(report.rejectedSampleDiagnostics).toEqual({
      perTargetBufferLimit: MAX_REJECTED_SAMPLES_PER_TARGET,
      retention: 'newest-samples-per-target',
      rejectedSampleCount: 'complete-for-current-session',
    });
    expect(center).toMatchObject({
      acceptedSampleCount: 1,
      rejectedSampleCount: 1,
      medians: { headYaw: 2 },
    });
    expect(center.rejectedSamples[0]).toEqual({
      target: 'CENTER',
      timestampMs: 150,
      rejectionReason: 'eyes-closed-or-invalid',
      faceDetected: true,
      headPoseAvailable: true,
      headPoseValid: true,
      headYaw: 15,
      headPitch: -6,
      headRoll: null,
      leftEyeHorizontal: 0.4,
      leftEyeVertical: null,
      rightEyeHorizontal: null,
      rightEyeVertical: -0.2,
      eyeLookDownLeft: 0.8,
      eyeLookDownRight: null,
      eyeLookUpLeft: null,
      eyeLookUpRight: 0.1,
      headYawFinite: true,
      headPitchFinite: true,
      headRollFinite: false,
      leftEyeHorizontalFinite: true,
      leftEyeVerticalFinite: false,
      rightEyeHorizontalFinite: false,
      rightEyeVerticalFinite: true,
      eyeLookDownLeftFinite: true,
      eyeLookDownRightFinite: false,
      eyeLookUpLeftFinite: false,
      eyeLookUpRightFinite: true,
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'eyes-closed-or-invalid',
      eyeMeasurementsReliable: false,
      eyeMeasurementsFinite: false,
      blendshapesAvailable: true,
    });
    expect(center.acceptedSamples).toHaveLength(1);
    expect(center.acceptedSamples[0].headYaw).toBe(2);
    expect(report.screenCalibration.CENTER.rejectedSamples).not.toContainEqual(
      expect.objectContaining({ landmarks: expect.anything() }),
    );
    expect(() => JSON.stringify(report)).not.toThrow();
    expect(JSON.stringify(report)).not.toMatch(/NaN|Infinity/);
  });

  it('uses nulls and explicit availability flags when rejected measurements are missing', () => {
    const collector = createScreenCalibrationCollector();
    collector.reset(0);
    collector.record('TOP', {
      faceDetected: false,
      headPose: null,
      eyeGaze: {
        reliability: 'unreliable',
        reason: 'no-face',
      },
      blendshapes: null,
    }, 100);

    expect(collector.toJSON().screenCalibration.TOP.rejectedSamples[0]).toMatchObject({
      target: 'TOP',
      timestampMs: 100,
      rejectionReason: 'missing-face',
      faceDetected: false,
      headPoseAvailable: false,
      headPoseValid: false,
      headYaw: null,
      headYawFinite: false,
      leftEyeHorizontal: null,
      leftEyeHorizontalFinite: false,
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'no-face',
      eyeMeasurementsFinite: false,
      eyeLookDownLeft: null,
      eyeLookDownLeftFinite: false,
      blendshapesAvailable: false,
    });
  });

  it('bounds rejected diagnostics per target while preserving total rejection counts', () => {
    const collector = createScreenCalibrationCollector();
    collector.reset(0);
    const rejectedSample = validSample({
      eyeGaze: { reliability: 'unreliable', reason: 'eyes-closed-or-invalid' },
    });
    for (let index = 0; index < MAX_REJECTED_SAMPLES_PER_TARGET + 2; index += 1) {
      collector.record('RIGHT', rejectedSample, index);
    }

    const right = collector.getSnapshot().targets.RIGHT;
    expect(right.rejectedSampleCount).toBe(MAX_REJECTED_SAMPLES_PER_TARGET + 2);
    expect(right.rejectedSamples).toHaveLength(MAX_REJECTED_SAMPLES_PER_TARGET);
    expect(right.rejectedSamples[0].timestampMs).toBe(2);
    expect(right.rejectedSamples.at(-1).timestampMs)
      .toBe(MAX_REJECTED_SAMPLES_PER_TARGET + 1);
    expect(collector.getSnapshot().targets.LEFT.rejectedSamples).toEqual([]);
  });

  it('keeps accepted synchronized scalar samples and calculates per-target medians and spread', () => {
    const collector = createScreenCalibrationCollector();
    collector.reset(500);
    collector.record('CENTER', validSample(), 700);
    collector.record('CENTER', validSample({
      headPose: { yaw: 4, pitch: 1, roll: 1.5 },
      eyeGaze: {
        leftEye: { horizontal: 0.3, vertical: 0.1 },
        rightEye: { horizontal: 0.32, vertical: 0.12 },
        reliability: 'reliable',
        reason: null,
      },
    }), 900);

    const center = collector.getSnapshot().targets.CENTER;
    expect(center).toMatchObject({
      acceptedSampleCount: 2,
      rejectedSampleCount: 0,
      medians: {
        headYaw: 3,
        headPitch: 0,
        leftEyeHorizontal: 0.2,
      },
      spread: {
        headYaw: { minimum: 2, maximum: 4, range: 2 },
      },
    });
    expect(center.acceptedSamples[0]).toMatchObject({
      target: 'CENTER',
      timestampMs: 200,
      headRoll: 0.5,
      eyeLookUpLeft: 0.1,
      eyeLookDownRight: 0.31,
      eyeReliabilityReason: null,
    });
    expect(center.acceptedSamples[0]).not.toHaveProperty('faceDetected');
    expect(center.acceptedSamples[0]).not.toHaveProperty('landmarks');
  });

  it('requires the minimum accepted samples and permits repeating an insufficient target', () => {
    const session = createScreenCalibrationSession({
      countdownMs: 0,
      targetDurationMs: 4000,
      minimumReliableSamples: 3,
    });
    session.start(0);
    session.tick(0);
    session.recordSample(validSample(), 0);
    session.recordSample(validSample(), 100);
    session.tick(4000);

    expect(session.getSnapshot(4000)).toMatchObject({
      status: 'needs-repeat',
      target: { label: 'CENTER' },
      acceptedSampleCount: 2,
      minimumReliableSamples: 3,
    });
    expect(session.repeatTarget(4100)).toBe(true);
    session.tick(4100);
    session.recordSample(validSample(), 4100);
    session.recordSample(validSample(), 4200);
    session.tick(8100);

    expect(session.getSnapshot(8100)).toMatchObject({
      status: 'countdown',
      target: { label: 'TOP' },
    });
  });

  it('cancels, restarts cleanly, and interrupts when tracking is unavailable', () => {
    const session = createScreenCalibrationSession({ countdownMs: 0 });
    session.start(0);
    session.tick(0);
    expect(session.cancel()).toBe(true);
    expect(session.getSnapshot(10).status).toBe('cancelled');

    session.start(100);
    expect(session.getSnapshot(100)).toMatchObject({
      status: 'countdown',
      target: { label: 'CENTER' },
      collector: {
        targets: {
          CENTER: { acceptedSampleCount: 0, rejectedSampleCount: 0 },
        },
      },
    });
    expect(session.interrupt()).toBe(true);
    expect(session.getSnapshot(200).status).toBe('interrupted');
    expect(session.recordSample(validSample(), 300).accepted).toBe(false);
  });

  it('keeps keyboard evaluation data separate from the five-target screen calibration', () => {
    const session = createScreenCalibrationSession({
      countdownMs: 0,
      targetDurationMs: 4000,
      minimumReliableSamples: 1,
    });
    session.start(0);
    CALIBRATION_TARGETS.forEach(({ label }, index) => {
      const startAt = index * 4000;
      session.tick(startAt);
      session.recordSample(validSample(), startAt);
      session.tick(startAt + 4000);
    });
    expect(session.getSnapshot(20_000).status).toBe('awaiting-keyboard-or-complete');
    expect(session.startKeyboardEvaluation(20_000)).toBe(true);
    session.tick(20_000);
    session.recordSample(validSample(), 20_000);
    session.recordSample(validSample({
      eyeGaze: {
        reliability: 'unreliable',
        reason: 'eyes-closed-or-invalid',
      },
    }), 20_001);
    session.tick(24_000);

    const report = session.toJSON();
    expect(report.screenCalibration.CENTER.acceptedSampleCount).toBe(1);
    expect(report.screenCalibration).not.toHaveProperty('KEYBOARD');
    expect(report.screenCalibration.CENTER.rejectedSamples).toEqual([]);
    expect(report.keyboardEvaluation).toMatchObject({
      target: 'KEYBOARD',
      acceptedSampleCount: 1,
    });
    const reportWithKeyboardRejection = session.toJSON();
    expect(reportWithKeyboardRejection.keyboardEvaluation.rejectedSamples).toHaveLength(1);
    expect(reportWithKeyboardRejection.keyboardEvaluation.rejectedSamples[0]).toMatchObject({
      target: 'KEYBOARD',
      rejectionReason: 'eyes-closed-or-invalid',
    });
    expect(reportWithKeyboardRejection.screenCalibration)
      .not.toHaveProperty('KEYBOARD');
    expect(JSON.parse(session.serialize())).toEqual(reportWithKeyboardRejection);
  });

  it('clears rejected diagnostics when a calibration session restarts', () => {
    const session = createScreenCalibrationSession({ countdownMs: 0 });
    session.start(0);
    session.tick(0);
    session.recordSample(validSample({
      eyeGaze: { reliability: 'unreliable', reason: 'eyes-closed-or-invalid' },
    }), 10);
    expect(session.toJSON().screenCalibration.CENTER.rejectedSamples).toHaveLength(1);

    session.start(100);

    expect(session.toJSON().screenCalibration.CENTER).toMatchObject({
      acceptedSampleCount: 0,
      rejectedSampleCount: 0,
      rejectedSamples: [],
    });
    expect(session.toJSON().keyboardEvaluation.rejectedSamples).toEqual([]);
  });
});
