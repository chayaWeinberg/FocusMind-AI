// Per-frame fusion: signals + calibration model -> raw state, confidence, reason.
// The temporal layer smooths these raw decisions.

import { ATTENTION_REASONS as R, ATTENTION_STATES as S } from './contracts.js';
import { predictGazePoint } from './calibration.js';
import { clamp, isFiniteNumber, logistic } from './math.js';

export const FUSION_DEFAULTS = Object.freeze({
  // The viewport is slightly smaller than the physical screen (browser UI), so
  // the "screen" is the viewport expanded by this margin.
  screenMargin: 0.05,
  // Probability thresholds for a decisive per-frame decision.
  onScreenProbability: 0.7,
  offScreenProbability: 0.3,
  // Head turned this far beyond the calibrated range = looking away, whatever the eyes say.
  headBeyondRangeYaw: 18,
  headBeyondRangePitch: 15,
  // Uncalibrated fallback: only an obvious head turn is decisive.
  uncalibratedYaw: 40,
  uncalibratedPitch: 35,
  // The user moved relative to calibration (distance / sideways).
  maximumDistanceRatio: 1.35,
  minimumDistanceRatio: 0.72,
  maximumLateralShift: 0.3,
  minimumFaceQuality: 0.35,
  minimumEyeQuality: 0.45,
});

/** Signed distance from point to the rectangle [lo, hi]^2: + inside, - outside. */
function signedDistanceToScreen({ x, y }, margin) {
  const low = -margin;
  const high = 1 + margin;
  const inside = x >= low && x <= high && y >= low && y <= high;
  if (inside) return Math.min(x - low, high - x, y - low, high - y);
  const dx = Math.max(low - x, 0, x - high);
  const dy = Math.max(low - y, 0, y - high);
  return -Math.hypot(dx, dy);
}

/** Probability that the true gaze point is on screen, given model error sigma. */
export function onScreenProbability(point, sigma, margin) {
  const distance = signedDistanceToScreen(point, margin);
  // Logistic approximation of the normal CDF (1.7 ≈ π/√3 scaling).
  return logistic((1.7 * distance) / Math.max(sigma, 0.03));
}

function positionDrift(signals, reference, config) {
  if (!reference) return false;
  const current = signals.head.translation;
  const ref = reference.translation;
  if (current && ref && isFiniteNumber(ref.z) && Math.abs(ref.z) > 1e-6) {
    const distanceRatio = current.z / ref.z;
    const lateralShift = Math.hypot(current.x - ref.x, current.y - ref.y) / Math.abs(ref.z);
    return distanceRatio > config.maximumDistanceRatio
      || distanceRatio < config.minimumDistanceRatio
      || lateralShift > config.maximumLateralShift;
  }
  if (signals.face && isFiniteNumber(reference.faceWidth) && reference.faceWidth > 0) {
    const sizeRatio = signals.face.width / reference.faceWidth;
    const shift = Math.hypot(
      signals.face.centerX - reference.faceCenterX,
      signals.face.centerY - reference.faceCenterY,
    );
    return sizeRatio > config.maximumDistanceRatio
      || sizeRatio < config.minimumDistanceRatio
      || shift > config.maximumLateralShift;
  }
  return false;
}

function headBeyondCalibratedRange(head, range, config) {
  if (!range) return false;
  return head.yaw < range.yawMin - config.headBeyondRangeYaw
    || head.yaw > range.yawMax + config.headBeyondRangeYaw
    || head.pitch < range.pitchMin - config.headBeyondRangePitch
    || head.pitch > range.pitchMax + config.headBeyondRangePitch;
}

function result(state, confidence, reason, extra = {}) {
  return {
    state,
    confidence: clamp(confidence, 0, 1),
    reason,
    gazePoint: null,
    onScreenProbability: null,
    modelUsed: 'none',
    recalibrationSuggested: false,
    ...extra,
  };
}

/**
 * @param {object} signals output of extractSignals()
 * @param {object|null} model calibration model (fitCalibration().model)
 */
export function fuseSignals(signals, model, options = {}) {
  const config = { ...FUSION_DEFAULTS, ...options };

  if (!signals?.faceDetected) return result(S.FACE_ABSENT, 0.9, R.NO_FACE);
  if (!signals.head.valid || signals.quality.face < config.minimumFaceQuality) {
    return result(S.UNCERTAIN, 0.6, R.LOW_LANDMARK_QUALITY);
  }

  const { head } = signals;
  if (!model) {
    if (Math.abs(head.yaw) > config.uncalibratedYaw || Math.abs(head.pitch) > config.uncalibratedPitch) {
      return result(S.OFF_SCREEN, 0.65, R.HEAD_TURNED_AWAY);
    }
    return result(S.UNCERTAIN, 0.5, R.NOT_CALIBRATED);
  }

  if (headBeyondCalibratedRange(head, model.headRange, config)) {
    return result(S.OFF_SCREEN, 0.6 + 0.3 * signals.quality.head, R.HEAD_TURNED_AWAY, {
      modelUsed: 'head-range',
    });
  }
  if (positionDrift(signals, model.reference, config)) {
    return result(S.UNCERTAIN, 0.6, R.OUTSIDE_CALIBRATION, { recalibrationSuggested: true });
  }

  const eyesUsable = signals.eyes.valid && signals.quality.eyes >= config.minimumEyeQuality;
  const headPoint = predictGazePoint(model.headOnly, signals);
  const fullPoint = eyesUsable ? predictGazePoint(model.full, signals) : null;
  const usingFull = Boolean(fullPoint);
  const point = fullPoint || headPoint;
  if (!point) {
    return result(S.UNCERTAIN, 0.55, R.EYES_NOT_MEASURABLE, { modelUsed: 'none' });
  }

  const sigma = usingFull ? model.full.error : model.headOnly.error;
  const probability = onScreenProbability(point, sigma, config.screenMargin);
  const signalQuality = usingFull
    ? Math.min(signals.quality.face, signals.quality.head, Math.max(signals.quality.eyes, 0.5))
    : Math.min(signals.quality.face, signals.quality.head) * 0.8;
  const modelUsed = usingFull ? 'full' : 'head-only';
  const extra = { gazePoint: point, onScreenProbability: probability, modelUsed };

  // Both models are decisive and contradict each other: do not guess.
  if (usingFull && headPoint && model.headOnly) {
    const headProbability = onScreenProbability(headPoint, model.headOnly.error, config.screenMargin);
    const contradicting = (probability > 0.85 && headProbability < 0.05)
      || (probability < 0.15 && headProbability > 0.95);
    if (contradicting && signals.quality.eyes < 0.8) {
      return result(S.UNCERTAIN, 0.55, R.SIGNALS_DISAGREE, extra);
    }
  }

  const qualityFactor = 0.55 + 0.45 * signalQuality;
  if (probability >= config.onScreenProbability) {
    return result(S.ON_SCREEN, probability * qualityFactor, R.GAZE_ON_SCREEN, extra);
  }
  if (probability <= config.offScreenProbability) {
    const reason = usingFull ? R.GAZE_OFF_SCREEN : R.HEAD_TURNED_AWAY;
    return result(S.OFF_SCREEN, (1 - probability) * qualityFactor, reason, extra);
  }
  const reason = !eyesUsable && signals.eyes.reason === 'eyes-closed'
    ? R.EYES_NOT_MEASURABLE
    : R.NEAR_SCREEN_EDGE;
  return result(S.UNCERTAIN, 0.5, reason, extra);
}
