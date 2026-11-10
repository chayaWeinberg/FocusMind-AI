// Possible fatigue indicators. These are *possible signs* only: blink rate and
// yawns vary with lighting, dry eyes, talking, screens and individual habits.
// They are reported next to the attention state and never change it.

import { FATIGUE_INDICATORS } from './contracts.js';
import { eyesClosed } from './signals.js';
import { isFiniteNumber } from './math.js';

export const FATIGUE_DEFAULTS = Object.freeze({
  blinkMinimumMs: 40,
  blinkMaximumMs: 500,
  blinkWindowMs: 60_000,
  minimumObservationMs: 20_000,
  highBlinkRatePerMinute: 30,
  longClosureMs: 1500,
  longClosureHoldMs: 5000,
  yawnJawOpen: 0.55,
  yawnMinimumMs: 1200,
  yawnHoldMs: 10_000,
  yawnWindowMs: 5 * 60_000,
});

export function createFatigueMonitor(options = {}) {
  const config = { ...FATIGUE_DEFAULTS, ...options };
  let blinks = [];
  let yawns = [];
  let closedSince = null;
  let lastLongClosureAt = null;
  let jawOpenSince = null;
  let yawnCountedForCurrentOpening = false;
  let observedMs = 0;
  let lastTimestamp = null;

  function reset() {
    blinks = [];
    yawns = [];
    closedSince = null;
    lastLongClosureAt = null;
    jawOpenSince = null;
    yawnCountedForCurrentOpening = false;
    observedMs = 0;
    lastTimestamp = null;
  }

  function summary(timestamp, closed, jawOpen) {
    const windowMs = Math.min(config.blinkWindowMs, observedMs);
    const blinkRate = observedMs >= config.minimumObservationMs && windowMs > 0
      ? (blinks.length / windowMs) * 60_000
      : null;
    const eyesClosedMs = closedSince === null ? 0 : timestamp - closedSince;
    const indicators = [];
    if (blinkRate !== null && blinkRate > config.highBlinkRatePerMinute) {
      indicators.push(FATIGUE_INDICATORS.BLINK_RATE_HIGH);
    }
    if (
      eyesClosedMs >= config.longClosureMs
      || (lastLongClosureAt !== null && timestamp - lastLongClosureAt <= config.longClosureHoldMs)
    ) {
      indicators.push(FATIGUE_INDICATORS.LONG_EYE_CLOSURE);
    }
    if (yawns.length && timestamp - yawns[yawns.length - 1] <= config.yawnHoldMs) {
      indicators.push(FATIGUE_INDICATORS.YAWN);
    }
    return {
      indicators,
      blinkRatePerMinute: blinkRate,
      blinksInWindow: blinks.length,
      observedSeconds: Math.round(observedMs / 1000),
      eyesClosed: closed,
      eyesClosedMs,
      jawOpen,
      yawnsInWindow: yawns.length,
    };
  }

  return {
    reset,
    update(signals, timestamp) {
      const dt = lastTimestamp === null ? 0 : Math.max(0, timestamp - lastTimestamp);
      lastTimestamp = timestamp;
      blinks = blinks.filter((time) => timestamp - time <= config.blinkWindowMs);
      yawns = yawns.filter((time) => timestamp - time <= config.yawnWindowMs);

      const closed = eyesClosed(signals);
      if (closed === null) {
        // No face / no eye data: interrupt running episodes, do not count time.
        closedSince = null;
        jawOpenSince = null;
        yawnCountedForCurrentOpening = false;
        return summary(timestamp, null, null);
      }
      if (dt < 1000) observedMs += dt;

      if (closed) {
        if (closedSince === null) closedSince = timestamp;
        if (timestamp - closedSince >= config.longClosureMs) lastLongClosureAt = timestamp;
      } else if (closedSince !== null) {
        const duration = timestamp - closedSince;
        if (duration >= config.blinkMinimumMs && duration <= config.blinkMaximumMs) blinks.push(timestamp);
        closedSince = null;
      }

      const jawOpen = signals.blendshapes?.jawOpen;
      if (isFiniteNumber(jawOpen) && jawOpen >= config.yawnJawOpen) {
        if (jawOpenSince === null) jawOpenSince = timestamp;
        if (!yawnCountedForCurrentOpening && timestamp - jawOpenSince >= config.yawnMinimumMs) {
          yawns.push(timestamp);
          yawnCountedForCurrentOpening = true;
        }
      } else {
        jawOpenSince = null;
        yawnCountedForCurrentOpening = false;
      }
      return summary(timestamp, closed, isFiniteNumber(jawOpen) ? jawOpen : null);
    },
  };
}
