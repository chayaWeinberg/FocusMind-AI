// Estimated concentration score (0-100) from observable signals only.
//
// It is an *estimate*, not a measurement of thinking: a learner can look at
// the screen without focusing, and look away while thinking. It combines:
//
//   score = 100 x gazeShare x (1 - fatiguePenalty)
//
// - gazeShare: recency-weighted share of time looking at the screen
//   (exponential average, time constant ~12 s). Off screen and face absent
//   count against it; eyes closed for more than a second count as not looking.
//   Uncertain moments are neutral (they change nothing).
// - fatiguePenalty (bounded): eye closure share (PERCLOS) above normal
//   blinking, long eye closures in the last 2 minutes, possible yawns in the
//   last 5 minutes, and a high blink rate.
// - While the eyes are closed for a long time right now the score is capped.

import { ATTENTION_STATES as S, FATIGUE_INDICATORS as F } from './contracts.js';
import { clamp } from './math.js';

export const CONCENTRATION_LEVELS = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });

export const CONCENTRATION_FACTORS = Object.freeze({
  LOOKING_AWAY: 'looking-away',
  EYES_CLOSED_NOW: 'eyes-closed-now',
  EYE_CLOSURE: 'eye-closure',
  LONG_CLOSURES: 'long-closures',
  YAWNS: 'yawns',
  BLINK_RATE: 'blink-rate',
});

export const CONCENTRATION_DEFAULTS = Object.freeze({
  gazeTauMs: 12_000,
  perclosTauMs: 30_000,
  minimumMeasuredMs: 8_000,
  closedAsAwayAfterMs: 1_000,
  maximumStepMs: 1_000,
  normalPerclos: 0.12,
  severePerclos: 0.4,
  perclosPenalty: 0.35,
  longClosurePenalty: 0.15,
  longClosureMaximumPenalty: 0.3,
  yawnPenalty: 0.12,
  yawnMaximumPenalty: 0.3,
  highBlinkRatePenalty: 0.1,
  maximumFatiguePenalty: 0.6,
  eyesClosedNowAfterMs: 1_500,
  eyesClosedNowCap: 25,
  lookingAwayBelowShare: 0.8,
  highLevel: 75,
  mediumLevel: 50,
});

function levelOf(score, config) {
  if (score >= config.highLevel) return CONCENTRATION_LEVELS.HIGH;
  if (score >= config.mediumLevel) return CONCENTRATION_LEVELS.MEDIUM;
  return CONCENTRATION_LEVELS.LOW;
}

/** Bias-corrected exponential average (no warm-up bias toward 0). */
function createAverage(tauMs) {
  let weighted = 0;
  let weight = 0;
  return {
    add(value, dt) {
      const decay = Math.exp(-dt / tauMs);
      weighted = weighted * decay + value * (1 - decay);
      weight = weight * decay + (1 - decay);
    },
    value() {
      return weight > 1e-9 ? weighted / weight : null;
    },
    reset() {
      weighted = 0;
      weight = 0;
    },
  };
}

export function createConcentrationEstimator(options = {}) {
  const config = { ...CONCENTRATION_DEFAULTS, ...options };
  const gaze = createAverage(config.gazeTauMs);
  const closure = createAverage(config.perclosTauMs);
  let measuredMs = 0;
  let lastTimestamp = null;
  let latest = null;

  function reset() {
    gaze.reset();
    closure.reset();
    measuredMs = 0;
    lastTimestamp = null;
    latest = null;
  }

  function build(fatigue) {
    const ready = measuredMs >= config.minimumMeasuredMs;
    const onScreenShare = gaze.value();
    const perclos = closure.value();
    const eyesClosedMs = fatigue?.eyesClosedMs ?? 0;
    const eyesClosedNow = eyesClosedMs >= config.eyesClosedNowAfterMs;
    const longClosures = fatigue?.longClosuresInWindow ?? 0;
    const yawns = fatigue?.yawnsInWindow ?? 0;
    const blinkRateHigh = Boolean(fatigue?.indicators?.includes(F.BLINK_RATE_HIGH));

    const penalties = {
      eyeClosure: perclos === null ? 0 : config.perclosPenalty
        * clamp((perclos - config.normalPerclos) / (config.severePerclos - config.normalPerclos), 0, 1),
      longClosures: Math.min(longClosures * config.longClosurePenalty, config.longClosureMaximumPenalty),
      yawns: Math.min(yawns * config.yawnPenalty, config.yawnMaximumPenalty),
      blinkRate: blinkRateHigh ? config.highBlinkRatePenalty : 0,
    };
    const fatiguePenalty = Math.min(
      Object.values(penalties).reduce((sum, value) => sum + value, 0),
      config.maximumFatiguePenalty,
    );

    let score = null;
    if (ready && onScreenShare !== null) {
      score = Math.round(100 * onScreenShare * (1 - fatiguePenalty));
      if (eyesClosedNow) score = Math.min(score, config.eyesClosedNowCap);
      score = clamp(score, 0, 100);
    }

    const factors = [];
    if (eyesClosedNow) factors.push(CONCENTRATION_FACTORS.EYES_CLOSED_NOW);
    if (onScreenShare !== null && onScreenShare < config.lookingAwayBelowShare) {
      factors.push(CONCENTRATION_FACTORS.LOOKING_AWAY);
    }
    if (penalties.longClosures > 0) factors.push(CONCENTRATION_FACTORS.LONG_CLOSURES);
    if (penalties.yawns > 0) factors.push(CONCENTRATION_FACTORS.YAWNS);
    if (penalties.eyeClosure > 0) factors.push(CONCENTRATION_FACTORS.EYE_CLOSURE);
    if (penalties.blinkRate > 0) factors.push(CONCENTRATION_FACTORS.BLINK_RATE);

    return {
      ready,
      progress: clamp(measuredMs / config.minimumMeasuredMs, 0, 1),
      score,
      level: score === null ? null : levelOf(score, config),
      onScreenShare,
      perclos,
      fatiguePenalty,
      penalties,
      eyesClosedNow,
      longClosures,
      yawns,
      blinkRatePerMinute: fatigue?.blinkRatePerMinute ?? null,
      factors,
    };
  }

  return {
    reset,
    /**
     * @param {{ state: string, fatigue: object }} input smoothed state + fatigue summary of this frame
     * @param {number} timestamp ms
     */
    update({ state, fatigue }, timestamp) {
      const dt = lastTimestamp === null ? 0 : clamp(timestamp - lastTimestamp, 0, config.maximumStepMs);
      lastTimestamp = timestamp;

      const eyesMeasured = fatigue?.eyesClosed === true || fatigue?.eyesClosed === false;
      const closedLong = (fatigue?.eyesClosedMs ?? 0) >= config.closedAsAwayAfterMs;
      let looking = null; // null = neutral
      if (state === S.OFF_SCREEN || state === S.FACE_ABSENT) looking = 0;
      else if (closedLong) looking = 0;
      else if (state === S.ON_SCREEN) looking = 1;

      if (dt > 0) {
        if (looking !== null) {
          gaze.add(looking, dt);
          measuredMs += dt;
        }
        if (eyesMeasured) closure.add(fatigue.eyesClosed ? 1 : 0, dt);
      }
      latest = build(fatigue);
      return latest;
    },
    snapshot() {
      return latest ?? build(null);
    },
  };
}
