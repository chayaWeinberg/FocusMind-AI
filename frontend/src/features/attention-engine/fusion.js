// Per-frame fusion: signals + adaptive baseline -> raw state, confidence, reason.
//
// The main decision uses the *combined* gaze direction (head + eyes, see
// combinedGaze in signals.js): people look away with the head and the eyes
// together, so checking each separately misses natural glances away and
// flags a turned head whose eyes still look at the screen.
// The gaze offset from the learned baseline is divided by the tolerance
// (degrees); the larger of the horizontal and vertical ratios z decides:
//   P(on screen) = logistic(steepness * (1 - z))
// so z = 1 (exactly at the tolerance) is 50/50 and reported as uncertain.
// Without measurable eyes the head alone decides, with a lower confidence
// ceiling. The temporal layer smooths these raw decisions.

import { ATTENTION_REASONS as R, ATTENTION_STATES as S } from './contracts.js';
import { clamp, isFiniteNumber, logistic } from './math.js';
import { combinedGaze } from './signals.js';

export const FUSION_DEFAULTS = Object.freeze({
  steepness: 6,
  onScreenProbability: 0.62,
  offScreenProbability: 0.38,
  // Head turned this far from the baseline is away, whatever the eyes say.
  extremeYaw: 40,
  extremePitch: 35,
  minimumFaceQuality: 0.35,
  minimumEyeQuality: 0.45,
  headOnlyConfidenceCeiling: 0.75,
});

function result(state, confidence, reason, extra = {}) {
  return {
    state,
    confidence: clamp(confidence, 0, 1),
    reason,
    onScreenProbability: null,
    deviation: null,
    offset: null,
    tolerance: null,
    channel: null,
    modelUsed: 'none',
    ...extra,
  };
}

function normalizedDeviation(value, center, tolerance) {
  if (!isFiniteNumber(value) || !isFiniteNumber(center) || !(tolerance > 0)) return null;
  return Math.abs(value - center) / tolerance;
}

/**
 * @param {object} signals output of extractSignals()
 * @param {object|null} baseline createAdaptiveBaseline().getBaseline()
 */
export function fuseSignals(signals, baseline, options = {}) {
  const config = { ...FUSION_DEFAULTS, ...options };

  if (!signals?.faceDetected) return result(S.FACE_ABSENT, 0.9, R.NO_FACE);
  if (!signals.head.valid || signals.quality.face < config.minimumFaceQuality) {
    return result(S.UNCERTAIN, 0.6, R.LOW_LANDMARK_QUALITY);
  }
  if (!baseline) return result(S.UNCERTAIN, 0.5, R.ADAPTING);

  const { head, eyes } = signals;
  const { tolerances } = baseline;
  const deviation = {
    yaw: normalizedDeviation(head.yaw, baseline.yaw, tolerances.yaw),
    pitch: normalizedDeviation(head.pitch, baseline.pitch, tolerances.pitch),
    gazeH: null,
    gazeV: null,
  };
  const headZ = Math.max(deviation.yaw ?? 0, deviation.pitch ?? 0);

  if (Math.abs(head.yaw - baseline.yaw) > config.extremeYaw
    || Math.abs(head.pitch - baseline.pitch) > config.extremePitch) {
    return result(S.OFF_SCREEN, 0.6 + 0.3 * signals.quality.head, R.HEAD_TURNED_AWAY, {
      deviation,
      offset: { horizontal: head.yaw - baseline.yaw, vertical: head.pitch - baseline.pitch },
      tolerance: { horizontal: tolerances.yaw, vertical: tolerances.pitch },
      channel: 'head',
      modelUsed: 'head',
    });
  }

  const gaze = signals.quality.eyes >= config.minimumEyeQuality
    && isFiniteNumber(baseline.gazeH) && isFiniteNumber(baseline.gazeV)
    ? combinedGaze(signals)
    : null;

  let z;
  let offset;
  let tolerance;
  if (gaze) {
    deviation.gazeH = normalizedDeviation(gaze.horizontal, baseline.gazeH, tolerances.gazeH);
    deviation.gazeV = normalizedDeviation(gaze.vertical, baseline.gazeV, tolerances.gazeV);
    z = Math.max(deviation.gazeH, deviation.gazeV);
    offset = { horizontal: gaze.horizontal - baseline.gazeH, vertical: gaze.vertical - baseline.gazeV };
    tolerance = { horizontal: tolerances.gazeH, vertical: tolerances.gazeV };
  } else {
    z = headZ;
    offset = { horizontal: head.yaw - baseline.yaw, vertical: head.pitch - baseline.pitch };
    tolerance = { horizontal: tolerances.yaw, vertical: tolerances.pitch };
  }

  const probability = logistic(config.steepness * (1 - z));
  const modelUsed = gaze ? 'head+eyes' : 'head';
  // "head" when the head alone is already past its tolerance, otherwise the eyes made the difference.
  const channel = gaze && headZ < 1 ? 'eyes' : 'head';
  const extra = { onScreenProbability: probability, deviation, offset, tolerance, channel, modelUsed };

  const quality = gaze
    ? Math.min(signals.quality.face, signals.quality.head, Math.max(signals.quality.eyes, 0.5))
    : Math.min(signals.quality.face, signals.quality.head);
  const qualityFactor = 0.55 + 0.45 * quality;
  const ceiling = gaze ? 1 : config.headOnlyConfidenceCeiling;

  if (probability >= config.onScreenProbability) {
    // A frontal head with unmeasurable eyes is plausible but not confirmed.
    return result(S.ON_SCREEN, Math.min(probability * qualityFactor, ceiling), R.GAZE_ON_SCREEN, extra);
  }
  if (probability <= config.offScreenProbability) {
    const reason = channel === 'eyes' ? R.GAZE_OFF_SCREEN : R.HEAD_TURNED_AWAY;
    return result(S.OFF_SCREEN, Math.min((1 - probability) * qualityFactor, gaze ? 1 : 0.85), reason, extra);
  }
  const reason = !gaze && eyes.reason === 'eyes-closed' ? R.EYES_NOT_MEASURABLE : R.NEAR_SCREEN_EDGE;
  return result(S.UNCERTAIN, 0.5, reason, extra);
}
