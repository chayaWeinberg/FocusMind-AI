const CALIBRATION_TARGETS = Object.freeze([
  Object.freeze({ label: 'CENTER', xPercent: 50, yPercent: 50 }),
  Object.freeze({ label: 'TOP', xPercent: 50, yPercent: 18 }),
  Object.freeze({ label: 'BOTTOM', xPercent: 50, yPercent: 82 }),
  Object.freeze({ label: 'LEFT', xPercent: 18, yPercent: 50 }),
  Object.freeze({ label: 'RIGHT', xPercent: 82, yPercent: 50 }),
]);

const KEYBOARD_TARGET = Object.freeze({ label: 'KEYBOARD' });
const CALIBRATION_TARGET_DURATION_MS = 4_000;
const COUNTDOWN_DURATION_MS = 3_000;
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

function snapshotSample(target, timestampMs, sample) {
  const blendshapes = sample.blendshapes;
  const values = {
    target,
    timestampMs: finiteOrNull(timestampMs),
    headYaw: finiteOrNull(sample.headPose.yaw),
    headPitch: finiteOrNull(sample.headPose.pitch),
    headRoll: finiteOrNull(sample.headPose.roll),
    leftEyeHorizontal: finiteOrNull(sample.eyeGaze.leftEye.horizontal),
    leftEyeVertical: finiteOrNull(sample.eyeGaze.leftEye.vertical),
    rightEyeHorizontal: finiteOrNull(sample.eyeGaze.rightEye.horizontal),
    rightEyeVertical: finiteOrNull(sample.eyeGaze.rightEye.vertical),
    eyeMeasurementReliability: sample.eyeGaze.reliability,
    eyeReliabilityReason: typeof sample.eyeGaze.reason === 'string'
      ? sample.eyeGaze.reason
      : null,
    eyeLookDownLeft: finiteOrNull(blendshapes?.eyeLookDownLeft),
    eyeLookDownRight: finiteOrNull(blendshapes?.eyeLookDownRight),
    eyeLookUpLeft: finiteOrNull(blendshapes?.eyeLookUpLeft),
    eyeLookUpRight: finiteOrNull(blendshapes?.eyeLookUpRight),
  };
  return values;
}

function snapshotRejectedSample(target, timestampMs, rejectionReason, sample) {
  const headPose = sample?.headPose;
  const eyeGaze = sample?.eyeGaze;
  const blendshapes = sample?.blendshapes;
  const measurements = {
    headYaw: headPose?.yaw,
    headPitch: headPose?.pitch,
    headRoll: headPose?.roll,
    leftEyeHorizontal: eyeGaze?.leftEye?.horizontal,
    leftEyeVertical: eyeGaze?.leftEye?.vertical,
    rightEyeHorizontal: eyeGaze?.rightEye?.horizontal,
    rightEyeVertical: eyeGaze?.rightEye?.vertical,
    eyeLookDownLeft: blendshapes?.eyeLookDownLeft,
    eyeLookDownRight: blendshapes?.eyeLookDownRight,
    eyeLookUpLeft: blendshapes?.eyeLookUpLeft,
    eyeLookUpRight: blendshapes?.eyeLookUpRight,
  };
  const values = Object.fromEntries(
    Object.entries(measurements).map(([key, value]) => [key, finiteOrNull(value)]),
  );
  const validity = Object.fromEntries(
    Object.entries(measurements).map(([key, value]) => [`${key}Finite`, Number.isFinite(value)]),
  );
  const eyeValuesFinite = [
    measurements.leftEyeHorizontal,
    measurements.leftEyeVertical,
    measurements.rightEyeHorizontal,
    measurements.rightEyeVertical,
  ].every(Number.isFinite);
  const headPoseValid = Number.isFinite(measurements.headYaw)
    && Number.isFinite(measurements.headPitch);

  return {
    target,
    timestampMs: finiteOrNull(timestampMs),
    rejectionReason,
    faceDetected: Boolean(sample?.faceDetected),
    headPoseAvailable: Boolean(headPose),
    headPoseValid,
    ...values,
    ...validity,
    eyeMeasurementReliability: typeof eyeGaze?.reliability === 'string'
      ? eyeGaze.reliability
      : null,
    eyeReliabilityReason: typeof eyeGaze?.reason === 'string' ? eyeGaze.reason : null,
    eyeMeasurementsReliable: eyeGaze?.reliability === 'reliable',
    eyeMeasurementsFinite: eyeValuesFinite,
    blendshapesAvailable: Boolean(blendshapes),
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
  let recordingStartedAt = null;

  function reset(timestamp = null) {
    screenTargets = Object.fromEntries(
      CALIBRATION_TARGETS.map(({ label }) => [label, createTargetBucket(label)]),
    );
    keyboardEvaluation = createTargetBucket(KEYBOARD_TARGET.label);
    recordingStartedAt = timestamp;
  }

  function record(target, sample, timestamp) {
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
      : screenTargets[target];
    if (!bucket) throw new RangeError(`Unknown calibration target: ${target}`);

    const rejectionReason = validateSample(sample);
    if (rejectionReason) {
      bucket.rejectedSampleCount += 1;
      bucket.rejectionReasons[rejectionReason] = (
        bucket.rejectionReasons[rejectionReason] || 0
      ) + 1;
      bucket.rejectedSamples.push(
        snapshotRejectedSample(target, timestampMs, rejectionReason, sample),
      );
      if (bucket.rejectedSamples.length > MAX_REJECTED_SAMPLES_PER_TARGET) {
        bucket.rejectedSamples.shift();
      }
      return { accepted: false, rejectionReason };
    }

    bucket.acceptedSamples.push(snapshotSample(target, timestampMs, sample));
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
    return { targets, keyboardEvaluation: keyboard };
  }

  function toJSON() {
    const snapshot = getSnapshot();
    return {
      schemaVersion: 2,
      dataScope: 'browser-memory-only',
      rejectedSampleDiagnostics: {
        perTargetBufferLimit: MAX_REJECTED_SAMPLES_PER_TARGET,
        retention: 'newest-samples-per-target',
        rejectedSampleCount: 'complete-for-current-session',
      },
      calibrationTargets: CALIBRATION_TARGETS.map((target) => ({ ...target })),
      keyboardEvaluationTarget: { ...KEYBOARD_TARGET },
      screenCalibration: snapshot.targets,
      keyboardEvaluation: snapshot.keyboardEvaluation,
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
  let stageStartedAt = null;
  let currentPhase = 'screen';

  function start(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration start time must be finite.');
    }
    collector.reset(timestamp);
    targetIndex = 0;
    currentPhase = 'screen';
    stageStartedAt = timestamp;
    status = 'countdown';
  }

  function currentTarget() {
    return currentPhase === 'keyboard'
      ? KEYBOARD_TARGET
      : CALIBRATION_TARGETS[targetIndex] ?? null;
  }

  function currentBucket() {
    const snapshot = collector.getSnapshot();
    return currentPhase === 'keyboard'
      ? snapshot.keyboardEvaluation
      : snapshot.targets[currentTarget()?.label];
  }

  function advance(timestamp) {
    if (status === 'countdown' && timestamp - stageStartedAt >= countdownMs) {
      status = 'collecting';
      stageStartedAt += countdownMs;
    }
    if (status !== 'collecting' || timestamp - stageStartedAt < targetDurationMs) return;

    if (currentPhase === 'keyboard') {
      status = 'complete';
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
      status = 'awaiting-keyboard-or-complete';
      stageStartedAt = timestamp;
      return;
    }
    status = 'countdown';
    stageStartedAt = timestamp;
  }

  function recordSample(sample, timestamp) {
    advance(timestamp);
    if (status !== 'collecting') return { accepted: false, rejectionReason: null };
    return collector.record(currentTarget().label, sample, timestamp);
  }

  function tick(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Calibration tick time must be finite.');
    }
    advance(timestamp);
    return getSnapshot(timestamp);
  }

  function repeatTarget(timestamp) {
    if (status !== 'needs-repeat' || currentPhase !== 'screen') return false;
    stageStartedAt = timestamp;
    status = 'countdown';
    return true;
  }

  function startKeyboardEvaluation(timestamp) {
    if (status !== 'awaiting-keyboard-or-complete') return false;
    currentPhase = 'keyboard';
    stageStartedAt = timestamp;
    status = 'countdown';
    return true;
  }

  function completeWithoutKeyboard() {
    if (status !== 'awaiting-keyboard-or-complete') return false;
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
      || status === 'awaiting-keyboard-or-complete'
    ) {
      status = 'interrupted';
      return true;
    }
    return false;
  }

  function getSnapshot(now = stageStartedAt ?? 0) {
    const target = currentTarget();
    const elapsed = stageStartedAt === null ? 0 : Math.max(0, now - stageStartedAt);
    const duration = status === 'countdown' ? countdownMs : targetDurationMs;
    const secondsRemaining = status === 'countdown'
      ? Math.ceil(Math.max(0, countdownMs - elapsed) / 1000)
      : status === 'collecting'
        ? Math.ceil(Math.max(0, targetDurationMs - elapsed) / 1000)
        : 0;
    const bucket = target ? currentBucket() : null;
    return {
      status,
      phase: currentPhase,
      target: target ? { ...target } : null,
      targetIndex,
      screenTargetCount: CALIBRATION_TARGETS.length,
      totalSampleDurationMs: duration,
      countdownMs,
      targetDurationMs,
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
    tick,
    recordSample,
    repeatTarget,
    startKeyboardEvaluation,
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
  MINIMUM_RELIABLE_SAMPLES,
  createScreenCalibrationCollector,
  createScreenCalibrationSession,
};
