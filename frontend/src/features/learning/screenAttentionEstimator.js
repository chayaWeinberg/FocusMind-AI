const DEFAULT_THRESHOLDS = Object.freeze({
  headYawSign: -1,
  headPitchSign: 1,
  eyeHorizontalDegreesPerUnit: 25,
  eyeVerticalDegreesPerUnit: 20,
  maximumEyeDisagreement: 0.55,
  onScreenHorizontal: 48,
  offScreenHorizontal: 62,
  onScreenPitchMinimum: -35,
  onScreenPitchMaximum: 55,
  offScreenPitchMinimum: -55,
  offScreenPitchMaximum: 75,
});

const UNKNOWN_ESTIMATE = Object.freeze({
  state: 'UNKNOWN',
  measurementQuality: 'unreliable',
  qualityScore: 0,
  combinedYaw: null,
  combinedPitch: null,
  reason: 'insufficient-measurements',
});

function isFiniteEye(eye) {
  return Number.isFinite(eye?.horizontal) && Number.isFinite(eye?.vertical);
}

function unknownEstimate(reason, qualityScore = 0) {
  return {
    ...UNKNOWN_ESTIMATE,
    qualityScore,
    reason,
  };
}

function validThresholds(thresholds) {
  const signsAreValid = [thresholds.headYawSign, thresholds.headPitchSign]
    .every((sign) => Number.isFinite(sign) && Math.abs(sign) === 1);
  const nonNegative = [
    thresholds.eyeHorizontalDegreesPerUnit,
    thresholds.eyeVerticalDegreesPerUnit,
    thresholds.maximumEyeDisagreement,
  ].every((value) => Number.isFinite(value) && value >= 0);
  const ordered = thresholds.onScreenHorizontal < thresholds.offScreenHorizontal
    && thresholds.offScreenPitchMinimum < thresholds.onScreenPitchMinimum
    && thresholds.onScreenPitchMinimum < thresholds.onScreenPitchMaximum
    && thresholds.onScreenPitchMaximum < thresholds.offScreenPitchMaximum;
  return signsAreValid
    && nonNegative
    && ordered
    && Number.isFinite(thresholds.offScreenPitchMinimum)
    && Number.isFinite(thresholds.offScreenPitchMaximum);
}

/**
 * Gives a provisional screen-orientation estimate, not a concentration score
 * or calibrated gaze point. Eye offsets are combined with head yaw/pitch using
 * intentionally configurable heuristic scaling.
 */
export function estimateScreenAttention(pose, gaze, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options };
  if (!validThresholds(thresholds)) {
    return unknownEstimate('invalid-thresholds');
  }
  if (
    !Number.isFinite(pose?.yaw)
    || !Number.isFinite(pose?.pitch)
    || gaze?.reliability !== 'reliable'
    || !isFiniteEye(gaze?.leftEye)
    || !isFiniteEye(gaze?.rightEye)
  ) {
    return unknownEstimate('unreliable-measurements');
  }

  const horizontalDisagreement = Math.abs(
    gaze.leftEye.horizontal - gaze.rightEye.horizontal,
  );
  const verticalDisagreement = Math.abs(gaze.leftEye.vertical - gaze.rightEye.vertical);
  const disagreement = Math.hypot(horizontalDisagreement, verticalDisagreement);
  if (disagreement > thresholds.maximumEyeDisagreement) {
    return unknownEstimate('conflicting-eye-measurements');
  }

  const physicalHeadYaw = pose.yaw * thresholds.headYawSign;
  const physicalHeadPitch = pose.pitch * thresholds.headPitchSign;
  const combinedYaw = physicalHeadYaw
    + gaze.horizontal * thresholds.eyeHorizontalDegreesPerUnit;
  const combinedPitch = physicalHeadPitch
    + gaze.vertical * thresholds.eyeVerticalDegreesPerUnit;
  if (![combinedYaw, combinedPitch].every(Number.isFinite)) {
    return unknownEstimate('non-finite-combined-measurement');
  }

  const qualityScore = Math.max(
    0,
    Math.min(1, 1 - disagreement / (thresholds.maximumEyeDisagreement * 2 || 1)),
  );
  const measurementQuality = qualityScore >= 0.65 ? 'reliable' : 'degraded';
  const horizontalMagnitude = Math.abs(combinedYaw);
  const withinOnScreenHorizontal = horizontalMagnitude <= thresholds.onScreenHorizontal;
  const beyondOffScreenHorizontal = horizontalMagnitude >= thresholds.offScreenHorizontal;
  const withinOnScreenPitch = combinedPitch >= thresholds.onScreenPitchMinimum
    && combinedPitch <= thresholds.onScreenPitchMaximum;
  const beyondOffScreenPitch = combinedPitch <= thresholds.offScreenPitchMinimum
    || combinedPitch >= thresholds.offScreenPitchMaximum;

  if (measurementQuality === 'degraded') {
    return {
      state: 'UNKNOWN',
      measurementQuality,
      qualityScore,
      combinedYaw,
      combinedPitch,
      reason: 'low-measurement-quality',
    };
  }

  if (withinOnScreenHorizontal && withinOnScreenPitch) {
    return {
      state: 'LIKELY_ON_SCREEN',
      measurementQuality,
      qualityScore,
      combinedYaw,
      combinedPitch,
      reason: null,
    };
  }
  if (beyondOffScreenHorizontal || beyondOffScreenPitch) {
    return {
      state: 'LIKELY_OFF_SCREEN',
      measurementQuality,
      qualityScore,
      combinedYaw,
      combinedPitch,
      reason: null,
    };
  }
  return {
    state: 'UNKNOWN',
    measurementQuality: 'degraded',
    qualityScore,
    combinedYaw,
    combinedPitch,
    reason: 'ambiguous-screen-orientation',
  };
}

export { DEFAULT_THRESHOLDS };
