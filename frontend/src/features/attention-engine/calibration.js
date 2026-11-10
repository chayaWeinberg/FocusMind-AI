// Personalized calibration.
//
// The user looks at 9 points on the screen. For each frame we keep head pose
// (yaw, pitch) and iris offset (horizontal, vertical). Ridge regression then
// maps those features to screen coordinates (0..1 = inside the viewport).
// Intercepts and gains absorb the differences between users, cameras and
// camera placement (above/below/next to the screen).
//
// Two models are fitted:
//   full      head pose + eyes, used when the eyes are measurable
//   headOnly  head pose only, fallback during blinks, glare, glasses...
// Each model's expected error is measured honestly with leave-one-target-out
// cross-validation, and that error drives the confidence of live estimates.

import { fitRidgeRegression, isFiniteNumber, median, robustScale } from './math.js';

export const CALIBRATION_TARGETS = Object.freeze([
  [0.5, 0.5], [0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.9, 0.5],
  [0.9, 0.9], [0.5, 0.9], [0.1, 0.9], [0.1, 0.5],
].map(([x, y], index) => Object.freeze({ id: index, x, y })));

export const CALIBRATION_DEFAULTS = Object.freeze({
  settleMs: 800,
  collectMs: 1400,
  minimumSamplesPerTarget: 6,
  retriesPerTarget: 1,
  ridgeLambda: 2,
  // Cross-validated error (fraction of the screen) above which a model is unusable.
  maximumUsableError: 0.4,
});

export const CALIBRATION_FAILURES = Object.freeze({
  FACE_NOT_DETECTED: 'face-not-detected',
  NOT_ENOUGH_VARIATION: 'not-enough-variation',
  INACCURATE: 'inaccurate',
  CANCELLED: 'cancelled',
});

function fullFeatures(signals) {
  return [signals.head.yaw, signals.head.pitch, signals.eyes.horizontal, signals.eyes.vertical];
}

function headFeatures(signals) {
  return [signals.head.yaw, signals.head.pitch];
}

/** Whether a frame is good enough to be used as a calibration sample. */
export function isUsableCalibrationSample(signals) {
  return Boolean(
    signals?.faceDetected
    && signals.head.valid
    && signals.quality.face >= 0.5
    && signals.quality.head >= 0.5,
  );
}

/** Removes samples far from the target's median (blinks, glances, jitter). */
function rejectOutliers(samples, featureOf) {
  const vectors = samples.map(featureOf);
  const featureCount = vectors[0]?.length ?? 0;
  const centers = [];
  const scales = [];
  for (let feature = 0; feature < featureCount; feature += 1) {
    const values = vectors.map((vector) => vector[feature]);
    centers.push(median(values));
    scales.push(Math.max(robustScale(values), 1e-6));
  }
  return samples.filter((_, index) => vectors[index].every((value, feature) => (
    Math.abs(value - centers[feature]) <= 3.5 * scales[feature] + 1e-9
  )));
}

function targetMedian(samples, featureOf) {
  const vectors = samples.map(featureOf);
  return vectors[0].map((_, feature) => median(vectors.map((vector) => vector[feature])));
}

function fitModel(groups, featureOf, lambda) {
  const usable = groups
    .map(({ target, samples }) => ({ target, samples: samples.length ? rejectOutliers(samples, featureOf) : [] }))
    .filter(({ samples }) => samples.length >= 3);
  if (usable.length < 6) return null;

  const fit = (subset) => {
    const inputs = subset.flatMap(({ samples }) => samples.map(featureOf));
    const outputs = subset.flatMap(({ target, samples }) => samples.map(() => [target.x, target.y]));
    return fitRidgeRegression(inputs, outputs, { lambda: lambda * Math.sqrt(inputs.length) });
  };
  const model = fit(usable);
  if (!model) return null;

  // Leave-one-target-out error: how far a *new* gaze point is predicted.
  const errors = [];
  for (let index = 0; index < usable.length; index += 1) {
    const heldOut = usable[index];
    const partial = fit(usable.filter((_, other) => other !== index));
    if (!partial) return null;
    const [x, y] = partial.predict(targetMedian(heldOut.samples, featureOf));
    errors.push(Math.hypot(x - heldOut.target.x, y - heldOut.target.y));
  }
  const crossValidatedError = Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length);

  // Predicted spread of the targets: a model that predicts (almost) the same
  // point everywhere has not learned anything.
  const predicted = usable.map(({ samples }) => model.predict(targetMedian(samples, featureOf)));
  const spreadX = Math.max(...predicted.map(([x]) => x)) - Math.min(...predicted.map(([x]) => x));
  const spreadY = Math.max(...predicted.map(([, y]) => y)) - Math.min(...predicted.map(([, y]) => y));

  return {
    regression: model,
    error: crossValidatedError,
    spread: Math.min(spreadX, spreadY),
    targetsUsed: usable.length,
    samplesUsed: usable.reduce((sum, { samples }) => sum + samples.length, 0),
  };
}

export function describeCalibrationQuality(error) {
  if (!isFiniteNumber(error)) return 'none';
  if (error <= 0.1) return 'excellent';
  if (error <= 0.17) return 'good';
  if (error <= 0.27) return 'fair';
  return 'poor';
}

/**
 * Fits the calibration model from samples grouped by target.
 * @param {{ target: {x:number,y:number}, samples: object[] }[]} groups
 * @returns {{ ok: true, model: object } | { ok: false, reason: string }}
 */
export function fitCalibration(groups, options = {}) {
  const { ridgeLambda, maximumUsableError } = { ...CALIBRATION_DEFAULTS, ...options };
  const headGroups = groups.map(({ target, samples }) => ({
    target,
    samples: samples.filter(isUsableCalibrationSample),
  }));
  const eyeGroups = headGroups.map(({ target, samples }) => ({
    target,
    samples: samples.filter((sample) => sample.eyes.valid && sample.quality.eyes >= 0.4),
  }));

  const headOnly = fitModel(headGroups, headFeatures, ridgeLambda);
  if (!headOnly) return { ok: false, reason: CALIBRATION_FAILURES.FACE_NOT_DETECTED };
  const full = fitModel(eyeGroups, fullFeatures, ridgeLambda);

  const usableFull = full && full.error <= maximumUsableError && full.spread >= 0.3 ? full : null;
  const usableHead = headOnly.error <= maximumUsableError && headOnly.spread >= 0.3 ? headOnly : null;
  if (!usableFull && !usableHead) {
    const spread = Math.max(full?.spread ?? 0, headOnly.spread);
    return {
      ok: false,
      reason: spread < 0.3 ? CALIBRATION_FAILURES.NOT_ENOUGH_VARIATION : CALIBRATION_FAILURES.INACCURATE,
    };
  }

  const allSamples = headGroups.flatMap(({ samples }) => samples);
  const yaws = allSamples.map((sample) => sample.head.yaw);
  const pitches = allSamples.map((sample) => sample.head.pitch);
  const translations = allSamples.map((sample) => sample.head.translation).filter(Boolean);
  const faceWidths = allSamples.map((sample) => sample.face?.width).filter(isFiniteNumber);
  const faceCentersX = allSamples.map((sample) => sample.face?.centerX).filter(isFiniteNumber);
  const faceCentersY = allSamples.map((sample) => sample.face?.centerY).filter(isFiniteNumber);

  return {
    ok: true,
    model: {
      full: usableFull,
      headOnly: usableHead,
      error: (usableFull || usableHead).error,
      quality: describeCalibrationQuality((usableFull || usableHead).error),
      headRange: {
        yawMin: Math.min(...yaws),
        yawMax: Math.max(...yaws),
        pitchMin: Math.min(...pitches),
        pitchMax: Math.max(...pitches),
      },
      reference: {
        translation: translations.length ? {
          x: median(translations.map((value) => value.x)),
          y: median(translations.map((value) => value.y)),
          z: median(translations.map((value) => value.z)),
        } : null,
        faceWidth: faceWidths.length ? median(faceWidths) : null,
        faceCenterX: faceCentersX.length ? median(faceCentersX) : null,
        faceCenterY: faceCentersY.length ? median(faceCentersY) : null,
      },
      createdAt: Date.now(),
    },
  };
}

export function predictGazePoint(modelPart, signals) {
  if (!modelPart) return null;
  const features = modelPart.regression.featureMeans.length === 4
    ? fullFeatures(signals)
    : headFeatures(signals);
  if (!features.every(isFiniteNumber)) return null;
  const [x, y] = modelPart.regression.predict(features);
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null;
}

/**
 * Time-driven calibration procedure (no DOM). The hook feeds every analysed
 * frame; the UI renders `getSnapshot()`.
 */
export function createCalibrationSession(options = {}) {
  const config = { ...CALIBRATION_DEFAULTS, ...options };
  const targets = options.targets || CALIBRATION_TARGETS;
  let status = 'idle';
  let targetIndex = 0;
  let targetStartedAt = 0;
  let retries = 0;
  let groups = [];
  let failure = null;
  let model = null;
  let now = 0;

  function beginTarget(index, timestamp) {
    targetIndex = index;
    targetStartedAt = timestamp;
  }

  function finish() {
    const result = fitCalibration(groups, config);
    if (result.ok) {
      status = 'done';
      model = result.model;
    } else {
      status = 'failed';
      failure = result.reason;
    }
  }

  function advance(timestamp) {
    now = timestamp;
    if (status !== 'running') return;
    const elapsed = timestamp - targetStartedAt;
    if (elapsed < config.settleMs + config.collectMs) return;

    const collected = groups[targetIndex].samples.filter(isUsableCalibrationSample).length;
    if (collected < config.minimumSamplesPerTarget) {
      if (retries < config.retriesPerTarget) {
        retries += 1;
        groups[targetIndex].samples = [];
        beginTarget(targetIndex, timestamp);
        return;
      }
      status = 'failed';
      failure = CALIBRATION_FAILURES.FACE_NOT_DETECTED;
      return;
    }
    retries = 0;
    if (targetIndex + 1 < targets.length) {
      beginTarget(targetIndex + 1, timestamp);
    } else {
      finish();
    }
  }

  return {
    start(timestamp) {
      status = 'running';
      failure = null;
      model = null;
      retries = 0;
      groups = targets.map((target) => ({ target, samples: [] }));
      beginTarget(0, timestamp);
      now = timestamp;
    },
    cancel() {
      if (status === 'running') {
        status = 'failed';
        failure = CALIBRATION_FAILURES.CANCELLED;
      }
    },
    reset() {
      status = 'idle';
      failure = null;
      model = null;
      groups = [];
    },
    /** Advances time; call on every analysed frame, with or without a face. */
    tick(timestamp) {
      advance(timestamp);
    },
    addSample(signals, timestamp) {
      if (status === 'running') {
        const inCollectWindow = timestamp - targetStartedAt >= config.settleMs;
        if (inCollectWindow && signals) groups[targetIndex].samples.push(signals);
      }
      advance(timestamp);
    },
    getModel() {
      return model;
    },
    getSnapshot() {
      const elapsed = Math.max(0, now - targetStartedAt);
      const perTarget = config.settleMs + config.collectMs;
      return {
        status,
        failure,
        targetIndex,
        targetCount: targets.length,
        target: status === 'running' ? targets[targetIndex] : null,
        phase: status !== 'running' ? null : elapsed < config.settleMs ? 'settle' : 'collect',
        targetProgress: status === 'running' ? Math.min(1, elapsed / perTarget) : 0,
        overallProgress: status === 'done'
          ? 1
          : status === 'running' ? (targetIndex + Math.min(1, elapsed / perTarget)) / targets.length : 0,
        retrying: retries > 0,
        samplesForTarget: status === 'running'
          ? groups[targetIndex].samples.filter(isUsableCalibrationSample).length
          : 0,
      };
    },
  };
}
