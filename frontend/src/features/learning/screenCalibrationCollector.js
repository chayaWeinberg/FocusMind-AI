import { MINIMUM_CALIBRATION_SAMPLES } from './attentionCalibrationRequirements.js';

const CALIBRATION_TARGETS = Object.freeze([
  Object.freeze({ label: 'CENTER', xPercent: 50, yPercent: 50 }),
  Object.freeze({ label: 'TOP', xPercent: 50, yPercent: 18 }),
  Object.freeze({ label: 'BOTTOM', xPercent: 50, yPercent: 82 }),
  Object.freeze({ label: 'LEFT', xPercent: 18, yPercent: 50 }),
  Object.freeze({ label: 'RIGHT', xPercent: 82, yPercent: 50 }),
]);

const KEYBOARD_TARGET = Object.freeze({ label: 'KEYBOARD' });
const OFFSCREEN_TARGETS = Object.freeze([
  Object.freeze({
    label: 'LOOK_AWAY_LEFT',
    movementModes: Object.freeze(['eyes', 'head']),
  }),
  Object.freeze({
    label: 'LOOK_AWAY_RIGHT',
    movementModes: Object.freeze(['eyes', 'head']),
  }),
  Object.freeze({
    label: 'LOOK_AWAY_UP',
    movementModes: Object.freeze(['eyes', 'head']),
  }),
  Object.freeze({
    label: 'LOOK_AWAY_DOWN',
    movementModes: Object.freeze(['eyes', 'head']),
  }),
]);
const CALIBRATION_TARGET_DURATION_MS = 4_000;
const COUNTDOWN_DURATION_MS = 3_000;
const OFFSCREEN_TARGET_DURATION_MS = 2_500;
const OFFSCREEN_COUNTDOWN_MS = 1_500;
const MINIMUM_RELIABLE_SAMPLES = 12;
// Retain the newest 500 rejected samples per target; aggregate rejection counts remain complete.
const MAX_REJECTED_SAMPLES_PER_TARGET = 500;

const MEASUREMENT_FIELDS = Object.freeze([
  'headYaw',
  'headPitch',
  'headRoll',
  'leftEyeHorizontal',
  'leftEyeVertical',
  'rightEyeHorizontal',
  'rightEyeVertical',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
]);

const HEAD_POSE_FIELDS = Object.freeze(['headYaw', 'headPitch', 'headRoll']);
const LEFT_EYE_FIELDS = Object.freeze(['leftEyeHorizontal', 'leftEyeVertical']);
const RIGHT_EYE_FIELDS = Object.freeze(['rightEyeHorizontal', 'rightEyeVertical']);
const BLENDSHAPE_FIELDS = Object.freeze([
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
]);

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeSamples(samples) {
  const medians = {};
  const spread = {};
  MEASUREMENT_FIELDS.forEach((field) => {
    const values = samples
      .map((sample) => sample[field])
      .filter(Number.isFinite);
    medians[field] = median(values);
    spread[field] = values.length
      ? {
        minimum: Math.min(...values),
        maximum: Math.max(...values),
        range: Math.max(...values) - Math.min(...values),
      }
      : null;
  });
  return { medians, spread };
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function getFeatureMeasurements(sample) {
  const faceDetected = Boolean(sample?.faceDetected);
  const headPose = sample?.headPose;
  const eyeGaze = sample?.eyeGaze;
  const blendshapes = sample?.blendshapes;
  const rawMeasurements = {
    headYaw: headPose?.yaw,
    headPitch: headPose?.pitch,
    headRoll: headPose?.roll,
    leftEyeHorizontal: eyeGaze?.leftEye?.horizontal,
    leftEyeVertical: eyeGaze?.leftEye?.vertical,
    rightEyeHorizontal: eyeGaze?.rightEye?.horizontal,
    rightEyeVertical: eyeGaze?.rightEye?.vertical,
    ...Object.fromEntries(BLENDSHAPE_FIELDS.map((field) => [field, blendshapes?.[field]])),
  };
  const headPoseValid = faceDetected && HEAD_POSE_FIELDS
    .every((field) => Number.isFinite(rawMeasurements[field]));
  const leftEyeValid = faceDetected
    && LEFT_EYE_FIELDS.every((field) => Number.isFinite(rawMeasurements[field]));
  const rightEyeValid = faceDetected
    && RIGHT_EYE_FIELDS.every((field) => Number.isFinite(rawMeasurements[field]));
  const blendshapesValid = faceDetected
    && BLENDSHAPE_FIELDS.some((field) => Number.isFinite(rawMeasurements[field]));
  const validity = {
    headPoseValid,
    leftEyeValid,
    rightEyeValid,
    blendshapesValid,
  };
  const invalidFeatureGroups = Object.entries(validity)
    .filter(([, valid]) => !valid)
    .map(([feature]) => feature.replace(/Valid$/, ''));
  const measurements = Object.fromEntries(
    Object.entries(rawMeasurements).map(([field, value]) => {
      const featureValid = HEAD_POSE_FIELDS.includes(field)
        ? headPoseValid
        : LEFT_EYE_FIELDS.includes(field)
          ? leftEyeValid
          : RIGHT_EYE_FIELDS.includes(field)
            ? rightEyeValid
            : blendshapesValid;
      return [field, featureValid ? finiteOrNull(value) : null];
    }),
  );

  return {
    validity,
    invalidFeatureGroups,
    measurements,
    headPoseAvailable: Boolean(headPose),
    blendshapesAvailable: Boolean(blendshapes),
    eyeMeasurementReliability: typeof eyeGaze?.reliability === 'string'
      ? eyeGaze.reliability
      : null,
    eyeReliabilityReason: typeof eyeGaze?.reason === 'string' ? eyeGaze.reason : null,
    eyeMeasurementsReliable: eyeGaze?.reliability === 'reliable'
      && leftEyeValid
      && rightEyeValid,
    eyeMeasurementsFinite: LEFT_EYE_FIELDS.concat(RIGHT_EYE_FIELDS)
      .every((field) => Number.isFinite(rawMeasurements[field])),
  };
}

function validateSample(sample) {
  if (!sample?.faceDetected) return 'missing-face';
  if (
    !Number.isFinite(sample.headPose?.yaw)
    || !Number.isFinite(sample.headPose?.pitch)
  ) {
    return 'invalid-head-pose';
  }
  if (sample.eyeGaze?.reliability !== 'reliable') {
    return sample.eyeGaze?.reason || 'unreliable-eye-measurement';
  }
  const requiredValues = [
    sample.eyeGaze?.leftEye?.horizontal,
    sample.eyeGaze?.leftEye?.vertical,
    sample.eyeGaze?.rightEye?.horizontal,
    sample.eyeGaze?.rightEye?.vertical,
  ];
  if (!requiredValues.every(Number.isFinite)) return 'missing-required-measurement';
  return null;
}

function snapshotSample(target, timestampMs, sample, movementMode) {
  const features = getFeatureMeasurements(sample);
  return {
    target,
    ...(movementMode ? { movementMode } : {}),
    timestampMs: finiteOrNull(timestampMs),
    ...features.measurements,
    ...features.validity,
    invalidFeatureGroups: features.invalidFeatureGroups,
    originalRejectionReason: validateSample(sample),
    eyeMeasurementReliability: features.eyeMeasurementReliability,
    eyeReliabilityReason: features.eyeReliabilityReason,
    eyeMeasurementsReliable: features.eyeMeasurementsReliable,
    eyeMeasurementsFinite: features.eyeMeasurementsFinite,
    headPoseAvailable: features.headPoseAvailable,
    blendshapesAvailable: features.blendshapesAvailable,
  };
}

function snapshotRejectedSample(target, timestampMs, rejectionReason, sample, movementMode) {
  const features = getFeatureMeasurements(sample);

  return {
    target,
    ...(movementMode ? { movementMode } : {}),
    timestampMs: finiteOrNull(timestampMs),
    rejectionReason,
    originalRejectionReason: rejectionReason,
    faceDetected: Boolean(sample?.faceDetected),
    ...features.measurements,
    ...features.validity,
    invalidFeatureGroups: features.invalidFeatureGroups,
    eyeMeasurementReliability: features.eyeMeasurementReliability,
    eyeReliabilityReason: features.eyeReliabilityReason,
    eyeMeasurementsReliable: features.eyeMeasurementsReliable,
    eyeMeasurementsFinite: features.eyeMeasurementsFinite,
    headPoseAvailable: features.headPoseAvailable,
    blendshapesAvailable: features.blendshapesAvailable,
  };
}

function createTargetBucket(target) {
  return {
    target,
    acceptedSamples: [],
    rejectedSamples: [],
    rejectedSampleCount: 0,
    rejectionReasons: {},
  };
}

function createScreenCalibrationCollector() {
  let screenTargets = Object.fromEntries(
    CALIBRATION_TARGETS.map(({ label }) => [label, createTargetBucket(label)]),
  );
  let keyboardEvaluation = createTargetBucket(KEYBOARD_TARGET.label);
  let offscreenTargets = Object.fromEntries(
    OFFSCREEN_TARGETS.map(({ label }) => [label, createTargetBucket(label)]),
  );
  let recordingStartedAt = null;
  let diagnosticSummary = createDiagnosticSummary();

  function createDiagnosticSummary() {
    return {
      totalFramesObserved: 0,
      validHeadPoseSampleCount: 0,
      validLeftEyeMeasurementCount: 0,
      validRightEyeMeasurementCount: 0,
      validBlendshapeSampleCount: 0,
      rejectionReasons: {},
    };
  }

  function reset(timestamp = null) {
    screenTargets = Object.fromEntries(
      CALIBRATION_TARGETS.map(({ label }) => [label, createTargetBucket(label)]),
    );
    keyboardEvaluation = createTargetBucket(KEYBOARD_TARGET.label);
    offscreenTargets = Object.fromEntries(
      OFFSCREEN_TARGETS.map(({ label }) => [label, createTargetBucket(label)]),
    );
    recordingStartedAt = timestamp;
    diagnosticSummary = createDiagnosticSummary();
  }

  function record(target, sample, timestamp, movementMode = null) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration sample timestamp must be finite.');
    }
    if (recordingStartedAt === null) recordingStartedAt = timestamp;
    const relativeTimestamp = timestamp - recordingStartedAt;
    const timestampMs = Number.isFinite(relativeTimestamp)
      ? Math.max(0, relativeTimestamp)
      : null;
    const bucket = target === KEYBOARD_TARGET.label
      ? keyboardEvaluation
      : offscreenTargets[target] || screenTargets[target];
    if (!bucket) throw new RangeError(`Unknown calibration target: ${target}`);

    const features = getFeatureMeasurements(sample);
    diagnosticSummary.totalFramesObserved += 1;
    if (features.validity.headPoseValid) diagnosticSummary.validHeadPoseSampleCount += 1;
    if (features.validity.leftEyeValid) diagnosticSummary.validLeftEyeMeasurementCount += 1;
    if (features.validity.rightEyeValid) diagnosticSummary.validRightEyeMeasurementCount += 1;
    if (features.validity.blendshapesValid) diagnosticSummary.validBlendshapeSampleCount += 1;

    const originalRejectionReason = validateSample(sample);
    const keyboardHasValidFeature = Object.values(features.validity).some(Boolean);
    const isDiagnosticTarget = target === KEYBOARD_TARGET.label
      || Object.prototype.hasOwnProperty.call(offscreenTargets, target);
    const accepted = isDiagnosticTarget
      ? keyboardHasValidFeature
      : originalRejectionReason === null;
    const rejectionReason = accepted ? null : originalRejectionReason || 'no-valid-feature-groups';
    if (!accepted) {
      bucket.rejectedSampleCount += 1;
      bucket.rejectionReasons[rejectionReason] = (
        bucket.rejectionReasons[rejectionReason] || 0
      ) + 1;
      diagnosticSummary.rejectionReasons[rejectionReason] = (
        diagnosticSummary.rejectionReasons[rejectionReason] || 0
      ) + 1;
      bucket.rejectedSamples.push(
        snapshotRejectedSample(target, timestampMs, rejectionReason, sample, movementMode),
      );
      if (bucket.rejectedSamples.length > MAX_REJECTED_SAMPLES_PER_TARGET) {
        bucket.rejectedSamples.shift();
      }
      return { accepted: false, rejectionReason };
    }

    bucket.acceptedSamples.push(snapshotSample(target, timestampMs, sample, movementMode));
    return { accepted: true, rejectionReason: null };
  }

  function getSnapshot() {
    const targets = Object.fromEntries(Object.entries(screenTargets).map(([label, bucket]) => ([
      label,
      {
        target: bucket.target,
        acceptedSampleCount: bucket.acceptedSamples.length,
        rejectedSampleCount: bucket.rejectedSampleCount,
        rejectionReasons: { ...bucket.rejectionReasons },
        rejectedSamples: bucket.rejectedSamples.map((sample) => ({ ...sample })),
        acceptedSamples: bucket.acceptedSamples.map((sample) => ({ ...sample })),
        ...summarizeSamples(bucket.acceptedSamples),
      },
    ])));
    const keyboard = {
      target: keyboardEvaluation.target,
      acceptedSampleCount: keyboardEvaluation.acceptedSamples.length,
      rejectedSampleCount: keyboardEvaluation.rejectedSampleCount,
      rejectionReasons: { ...keyboardEvaluation.rejectionReasons },
      rejectedSamples: keyboardEvaluation.rejectedSamples.map((sample) => ({ ...sample })),
      acceptedSamples: keyboardEvaluation.acceptedSamples.map((sample) => ({ ...sample })),
      ...summarizeSamples(keyboardEvaluation.acceptedSamples),
    };
    const offscreen = Object.fromEntries(Object.entries(offscreenTargets).map(([label, bucket]) => ([
      label,
      {
        target: bucket.target,
        acceptedSampleCount: bucket.acceptedSamples.length,
        rejectedSampleCount: bucket.rejectedSampleCount,
        rejectionReasons: { ...bucket.rejectionReasons },
        rejectedSamples: bucket.rejectedSamples.map((sample) => ({ ...sample })),
        acceptedSamples: bucket.acceptedSamples.map((sample) => ({ ...sample })),
        ...summarizeSamples(bucket.acceptedSamples),
      },
    ])));
    return {
      targets,
      keyboardEvaluation: keyboard,
      offscreenTargets: offscreen,
      diagnosticSummary: {
        ...diagnosticSummary,
        rejectionReasons: { ...diagnosticSummary.rejectionReasons },
      },
    };
  }

  function toJSON() {
    const snapshot = getSnapshot();
    return {
      schemaVersion: 4,
      dataScope: 'browser-memory-only',
      diagnosticSummary: snapshot.diagnosticSummary,
      rejectedSampleDiagnostics: {
        perTargetBufferLimit: MAX_REJECTED_SAMPLES_PER_TARGET,
        retention: 'newest-samples-per-target',
        rejectedSampleCount: 'complete-for-current-session',
      },
      calibrationTargets: CALIBRATION_TARGETS.map((target) => ({ ...target })),
      keyboardEvaluationTarget: { ...KEYBOARD_TARGET },
      offscreenCalibrationTargets: OFFSCREEN_TARGETS.map((target) => ({ ...target })),
      screenCalibration: snapshot.targets,
      keyboardEvaluation: snapshot.keyboardEvaluation,
      offscreenTargets: snapshot.offscreenTargets,
    };
  }

  function serialize() {
    return JSON.stringify(toJSON(), null, 2);
  }

  return { reset, record, getSnapshot, toJSON, serialize };
}

function createScreenCalibrationSession({
  collector = createScreenCalibrationCollector(),
  countdownMs = COUNTDOWN_DURATION_MS,
  targetDurationMs = CALIBRATION_TARGET_DURATION_MS,
  minimumReliableSamples = MINIMUM_RELIABLE_SAMPLES,
} = {}) {
  if (
    !Number.isFinite(countdownMs) || countdownMs < 0
    || !Number.isFinite(targetDurationMs) || targetDurationMs <= 0
    || !Number.isInteger(minimumReliableSamples) || minimumReliableSamples < 1
  ) {
    throw new TypeError('Calibration session options must be within valid ranges.');
  }

  let status = 'idle';
  let targetIndex = 0;
  let offscreenTargetIndex = 0;
  let offscreenMovementModeIndex = 0;
  let stageStartedAt = null;
  let currentPhase = 'screen';
  let guidedMode = false;

  function resetSession(timestamp, guided) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration start time must be finite.');
    }
    collector.reset(timestamp);
    targetIndex = 0;
    offscreenTargetIndex = 0;
    offscreenMovementModeIndex = 0;
    currentPhase = 'screen';
    stageStartedAt = timestamp;
    guidedMode = guided;
    status = guided ? 'guided-transition' : 'countdown';
  }

  function start(timestamp) {
    resetSession(timestamp, false);
  }

  function startGuided(timestamp) {
    resetSession(timestamp, true);
  }

  function currentTarget() {
    if (currentPhase === 'keyboard') return KEYBOARD_TARGET;
    if (currentPhase === 'offscreen') {
      const target = OFFSCREEN_TARGETS[offscreenTargetIndex];
      if (!target) return null;
      return {
        ...target,
        movementMode: target.movementModes[offscreenMovementModeIndex],
      };
    }
    return CALIBRATION_TARGETS[targetIndex] ?? null;
  }

  function currentBucket() {
    const snapshot = collector.getSnapshot();
    if (currentPhase === 'keyboard') return snapshot.keyboardEvaluation;
    if (currentPhase === 'offscreen') return snapshot.offscreenTargets[currentTarget()?.label];
    return snapshot.targets[currentTarget()?.label];
  }

  function advance(timestamp) {
    if (guidedMode) return;
    const phaseCountdownMs = currentPhase === 'offscreen' ? OFFSCREEN_COUNTDOWN_MS : countdownMs;
    const phaseTargetDurationMs = currentPhase === 'offscreen'
      ? OFFSCREEN_TARGET_DURATION_MS
      : targetDurationMs;
    if (status === 'countdown' && timestamp - stageStartedAt >= phaseCountdownMs) {
      status = 'collecting';
      stageStartedAt += phaseCountdownMs;
    }
    if (status !== 'collecting' || timestamp - stageStartedAt < phaseTargetDurationMs) return;

    if (currentPhase === 'keyboard') {
      status = 'awaiting-offscreen-or-complete';
      stageStartedAt = timestamp;
      return;
    }
    if (currentPhase === 'offscreen') {
      if (currentBucket().acceptedSampleCount < MINIMUM_CALIBRATION_SAMPLES) {
        status = 'needs-repeat';
        stageStartedAt = timestamp;
        return;
      }
      const target = currentTarget();
      if (offscreenMovementModeIndex + 1 < target.movementModes.length) {
        offscreenMovementModeIndex += 1;
        status = 'countdown';
        stageStartedAt = timestamp;
        return;
      }
      offscreenTargetIndex += 1;
      offscreenMovementModeIndex = 0;
      if (offscreenTargetIndex >= OFFSCREEN_TARGETS.length) {
        status = 'complete';
        stageStartedAt = timestamp;
        return;
      }
      status = 'countdown';
      stageStartedAt = timestamp;
      return;
    }

    if (currentBucket().acceptedSampleCount < minimumReliableSamples) {
      status = 'needs-repeat';
      stageStartedAt = timestamp;
      return;
    }
    targetIndex += 1;
    if (targetIndex >= CALIBRATION_TARGETS.length) {
      status = 'awaiting-keyboard-or-offscreen-or-complete';
      stageStartedAt = timestamp;
      return;
    }
    status = 'countdown';
    stageStartedAt = timestamp;
  }

  function recordSample(sample, timestamp) {
    advance(timestamp);
    if (status !== 'collecting') return { accepted: false, rejectionReason: null };
    const target = currentTarget();
    return collector.record(target.label, sample, timestamp, target.movementMode ?? null);
  }

  function tick(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration tick time must be finite.');
    }
    advance(timestamp);
    return getSnapshot(timestamp);
  }

  function repeatTarget(timestamp) {
    if (status !== 'needs-repeat') return false;
    stageStartedAt = timestamp;
    status = guidedMode ? 'guided-transition' : 'countdown';
    return true;
  }

  function beginGuidedCollection(timestamp) {
    if (
      !guidedMode
      || (status !== 'guided-transition' && status !== 'needs-repeat')
    ) return false;
    stageStartedAt = timestamp;
    status = 'collecting';
    return true;
  }

  function finishGuidedTarget(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration finish time must be finite.');
    }
    if (!guidedMode || status !== 'collecting') return false;
    const minimumSamples = currentPhase === 'offscreen'
      ? MINIMUM_CALIBRATION_SAMPLES
      : minimumReliableSamples;
    if (currentBucket().acceptedSampleCount < minimumSamples) {
      status = 'needs-repeat';
      stageStartedAt = timestamp;
      return true;
    }

    if (currentPhase === 'screen') {
      targetIndex += 1;
      status = targetIndex >= CALIBRATION_TARGETS.length
        ? 'awaiting-keyboard-or-offscreen-or-complete'
        : 'guided-transition';
    } else if (currentPhase === 'offscreen') {
      const target = currentTarget();
      if (offscreenMovementModeIndex + 1 < target.movementModes.length) {
        offscreenMovementModeIndex += 1;
        status = 'guided-transition';
      } else {
        offscreenTargetIndex += 1;
        offscreenMovementModeIndex = 0;
        status = offscreenTargetIndex >= OFFSCREEN_TARGETS.length
          ? 'complete'
          : 'guided-transition';
      }
    } else {
      status = 'awaiting-offscreen-or-complete';
    }
    stageStartedAt = timestamp;
    return true;
  }

  function pauseGuided() {
    if (
      !guidedMode
      || !['guided-transition', 'collecting', 'needs-repeat'].includes(status)
    ) return false;
    status = 'guided-paused';
    return true;
  }

  function resumeGuided() {
    if (!guidedMode || status !== 'guided-paused') return false;
    status = 'guided-transition';
    return true;
  }

  function startKeyboardEvaluation(timestamp) {
    if (status !== 'awaiting-keyboard-or-offscreen-or-complete') return false;
    currentPhase = 'keyboard';
    stageStartedAt = timestamp;
    status = 'countdown';
    return true;
  }

  function startOffscreenCalibration(timestamp) {
    if (
      status !== 'awaiting-keyboard-or-offscreen-or-complete'
      && status !== 'awaiting-offscreen-or-complete'
    ) return false;
    currentPhase = 'offscreen';
    offscreenTargetIndex = 0;
    stageStartedAt = timestamp;
    status = guidedMode ? 'guided-transition' : 'countdown';
    return true;
  }

  function completeWithoutKeyboard() {
    if (status === 'awaiting-keyboard-or-offscreen-or-complete') {
      status = 'complete';
      return true;
    }
    if (status !== 'awaiting-offscreen-or-complete') return false;
    status = 'complete';
    return true;
  }

  function cancel() {
    if (status === 'idle' || status === 'complete' || status === 'cancelled') return false;
    status = 'cancelled';
    return true;
  }

  function interrupt() {
    if (
      status === 'countdown'
      || status === 'collecting'
      || status === 'needs-repeat'
      || status === 'guided-transition'
      || status === 'guided-paused'
      || status === 'awaiting-keyboard-or-offscreen-or-complete'
      || status === 'awaiting-offscreen-or-complete'
    ) {
      status = 'interrupted';
      return true;
    }
    return false;
  }

  function getSnapshot(now = stageStartedAt ?? 0) {
    const target = currentTarget();
    const elapsed = stageStartedAt === null ? 0 : Math.max(0, now - stageStartedAt);
    const isOffscreen = currentPhase === 'offscreen';
    const phaseCountdownMs = isOffscreen ? OFFSCREEN_COUNTDOWN_MS : countdownMs;
    const phaseTargetDurationMs = isOffscreen ? OFFSCREEN_TARGET_DURATION_MS : targetDurationMs;
    const duration = status === 'countdown' ? phaseCountdownMs : phaseTargetDurationMs;
    const secondsRemaining = status === 'countdown'
      ? Math.ceil(Math.max(0, phaseCountdownMs - elapsed) / 1000)
      : status === 'collecting'
        ? Math.ceil(Math.max(0, phaseTargetDurationMs - elapsed) / 1000)
        : 0;
    const bucket = target ? currentBucket() : null;
    return {
      status,
      phase: currentPhase,
      target: target ? { ...target } : null,
      targetIndex,
      screenTargetCount: CALIBRATION_TARGETS.length,
      offscreenTargetCount: OFFSCREEN_TARGETS.length,
      totalSampleDurationMs: duration,
      countdownMs,
      targetDurationMs,
      offscreenTargetDurationMs: OFFSCREEN_TARGET_DURATION_MS,
      offscreenCountdownMs: OFFSCREEN_COUNTDOWN_MS,
      minimumReliableSamples,
      secondsRemaining,
      acceptedSampleCount: bucket?.acceptedSampleCount ?? 0,
      rejectedSampleCount: bucket?.rejectedSampleCount ?? 0,
      rejectionReasons: { ...(bucket?.rejectionReasons ?? {}) },
      collector: collector.getSnapshot(),
    };
  }

  return {
    start,
    startGuided,
    tick,
    recordSample,
    beginGuidedCollection,
    finishGuidedTarget,
    pauseGuided,
    resumeGuided,
    repeatTarget,
    startKeyboardEvaluation,
    startOffscreenCalibration,
    completeWithoutKeyboard,
    cancel,
    interrupt,
    getSnapshot,
    toJSON: () => collector.toJSON(),
    serialize: () => collector.serialize(),
  };
}

export {
  CALIBRATION_TARGET_DURATION_MS,
  CALIBRATION_TARGETS,
  COUNTDOWN_DURATION_MS,
  KEYBOARD_TARGET,
  MAX_REJECTED_SAMPLES_PER_TARGET,
  OFFSCREEN_TARGETS,
  OFFSCREEN_COUNTDOWN_MS,
  OFFSCREEN_TARGET_DURATION_MS,
  MINIMUM_RELIABLE_SAMPLES,
  createScreenCalibrationCollector,
  createScreenCalibrationSession,
};
