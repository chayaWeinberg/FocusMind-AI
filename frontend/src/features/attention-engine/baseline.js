// Calibration-free, passive adaptation.
//
// Instead of asking the user to follow targets, the engine learns the user's
// *screen-facing direction* while they study:
//
// 1. Warm-up (~2.5 s after the camera starts): the robust median of head
//    yaw/pitch and of the combined head+eye gaze becomes the baseline. The UI
//    asks the user to look at the screen, which is what learners do anyway.
// 2. Adaptation: the baseline keeps following the user, but only from frames
//    that were clearly on screen. Looking away never moves the baseline.
//    Tolerances are the angular size of a typical screen, widened only by the
//    user's measurement noise (bounded).
// 3. Posture change: if the head position (distance or sideways) stays far
//    from the baseline for ~2 s, the baseline is re-learned automatically.
//
// The baseline absorbs the camera position (above/below/next to the screen)
// and the user's natural head posture.

import { clamp, isFiniteNumber, median, robustScale } from './math.js';
import { combinedGaze } from './signals.js';

const CHANNELS = Object.freeze(['yaw', 'pitch', 'gazeH', 'gazeV']);

export const BASELINE_DEFAULTS = Object.freeze({
  warmupMs: 2500,
  warmupMinimumSamples: 12,
  // Frames accepted during warm-up: roughly facing the camera.
  warmupMaximumYaw: 35,
  warmupMaximumPitch: 35,
  windowSamples: 600, // ~40 s of on-screen frames at 15 fps
  updateEveryMs: 1000,
  // Deviation (degrees) from the baseline that still counts as looking at a
  // typical laptop/desktop screen from ~50-70 cm. yaw/pitch: head only (used
  // when the eyes are not measurable); gazeH/gazeV: combined head + eyes.
  tolerance: Object.freeze({ yaw: 18, pitch: 14, gazeH: 22, gazeV: 15 }),
  noiseFactor: 2.5,
  maximumToleranceFactor: 1.4,
  minimumAdaptationProbability: 0.8,
  minimumEyeQuality: 0.4,
  posture: Object.freeze({ minimumDistanceRatio: 0.75, maximumDistanceRatio: 1.33, maximumLateralShift: 0.25 }),
  postureChangeMs: 2000,
});

function usableForWarmup(signals, config) {
  return Boolean(
    signals?.faceDetected
    && signals.head.valid
    && signals.quality.face >= 0.5
    && signals.quality.head >= 0.5
    && Math.abs(signals.head.yaw) <= config.warmupMaximumYaw
    && Math.abs(signals.head.pitch) <= config.warmupMaximumPitch,
  );
}

function sampleOf(signals, config) {
  const gaze = signals.quality.eyes >= config.minimumEyeQuality ? combinedGaze(signals) : null;
  return {
    yaw: signals.head.yaw,
    pitch: signals.head.pitch,
    gazeH: gaze?.horizontal ?? null,
    gazeV: gaze?.vertical ?? null,
    translation: signals.head.translation,
    faceWidth: signals.face?.width ?? null,
  };
}

/** Frame-to-frame measurement noise of one channel (robust). */
function jitterOf(list) {
  if (list.length < 10) return 0;
  const differences = [];
  for (let index = 1; index < list.length; index += 1) differences.push(list[index] - list[index - 1]);
  return robustScale(differences) / Math.SQRT2;
}

function computeBaseline(samples, config) {
  const values = (key) => samples.map((sample) => sample[key]).filter(isFiniteNumber);
  const tolerances = {};
  const center = {};
  CHANNELS.forEach((key) => {
    const list = values(key);
    center[key] = list.length >= 5 ? median(list) : null;
    const base = config.tolerance[key];
    tolerances[key] = list.length >= 30
      ? clamp(Math.hypot(base, config.noiseFactor * jitterOf(list)), base, base * config.maximumToleranceFactor)
      : base;
  });
  const translations = samples.map((sample) => sample.translation).filter(Boolean);
  const widths = values('faceWidth');
  return {
    ...center,
    tolerances,
    translation: translations.length ? {
      x: median(translations.map((value) => value.x)),
      y: median(translations.map((value) => value.y)),
      z: median(translations.map((value) => value.z)),
    } : null,
    faceWidth: widths.length ? median(widths) : null,
    samples: samples.length,
  };
}

function postureMoved(signals, baseline, config) {
  const current = signals.head.translation;
  const reference = baseline.translation;
  if (current && reference && Math.abs(reference.z) > 1e-6) {
    const distanceRatio = current.z / reference.z;
    const lateral = Math.hypot(current.x - reference.x, current.y - reference.y) / Math.abs(reference.z);
    return distanceRatio < config.posture.minimumDistanceRatio
      || distanceRatio > config.posture.maximumDistanceRatio
      || lateral > config.posture.maximumLateralShift;
  }
  if (signals.face && isFiniteNumber(baseline.faceWidth) && baseline.faceWidth > 0) {
    const ratio = signals.face.width / baseline.faceWidth;
    return ratio < config.posture.minimumDistanceRatio || ratio > config.posture.maximumDistanceRatio;
  }
  return false;
}

export function createAdaptiveBaseline(options = {}) {
  const config = {
    ...BASELINE_DEFAULTS,
    ...options,
    tolerance: { ...BASELINE_DEFAULTS.tolerance, ...options.tolerance },
  };
  let warmup = [];
  let warmupStartedAt = null;
  let window = [];
  let baseline = null;
  let lastUpdateAt = 0;
  let movedSince = null;
  let adaptations = 0;

  function reset() {
    warmup = [];
    warmupStartedAt = null;
    window = [];
    baseline = null;
    movedSince = null;
  }

  return {
    reset,
    getBaseline() {
      return baseline;
    },
    getStatus(timestamp) {
      if (baseline) return { ready: true, progress: 1, adaptations };
      const elapsed = warmupStartedAt === null ? 0 : timestamp - warmupStartedAt;
      return {
        ready: false,
        progress: clamp(Math.min(elapsed / config.warmupMs, warmup.length / config.warmupMinimumSamples), 0, 1),
        adaptations,
      };
    },
    /**
     * Feed every analysed frame after fusion.
     * @param {object} signals extractSignals() output
     * @param {number} timestamp ms
     * @param {{ onScreenProbability?: number|null }} [decision] fusion result for this frame
     * @returns {'warming-up'|'ready'|'baseline-learned'|'posture-changed'}
     */
    observe(signals, timestamp, decision = {}) {
      if (!baseline) {
        if (!usableForWarmup(signals, config)) return 'warming-up';
        if (warmupStartedAt === null) warmupStartedAt = timestamp;
        warmup.push(sampleOf(signals, config));
        if (
          timestamp - warmupStartedAt >= config.warmupMs
          && warmup.length >= config.warmupMinimumSamples
        ) {
          window = warmup.slice(-config.windowSamples);
          baseline = computeBaseline(window, config);
          lastUpdateAt = timestamp;
          adaptations += 1;
          return 'baseline-learned';
        }
        return 'warming-up';
      }

      if (signals?.faceDetected && signals.head.valid) {
        if (postureMoved(signals, baseline, config)) {
          if (movedSince === null) movedSince = timestamp;
          if (timestamp - movedSince >= config.postureChangeMs) {
            reset();
            return 'posture-changed';
          }
        } else {
          movedSince = null;
        }
      }

      const probability = decision.onScreenProbability;
      if (
        isFiniteNumber(probability)
        && probability >= config.minimumAdaptationProbability
        && signals.quality.face >= 0.5
      ) {
        window.push(sampleOf(signals, config));
        if (window.length > config.windowSamples) window.shift();
        if (timestamp - lastUpdateAt >= config.updateEveryMs) {
          baseline = computeBaseline(window, config);
          lastUpdateAt = timestamp;
        }
      }
      return 'ready';
    },
  };
}
