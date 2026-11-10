export const WEBGAZER_STATES = Object.freeze({
  SCREEN: 'LOOKING_AT_SCREEN',
  AWAY: 'LOOKING_AWAY',
  UNKNOWN: 'UNKNOWN',
});

export const WEBGAZER_QUALITY_WINDOW_MS = 1500;
export const WEBGAZER_MIN_STABLE_PREDICTIONS = 6;
export const WEBGAZER_MAX_STABLE_SPREAD_PX = 110;
export const WEBGAZER_OFFSCREEN_MARGIN_RATIO = 0.1;
const MIN_SAMPLE_INTERVAL_MS = 200;

function isFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function getSpread(points) {
  if (!points.length) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return Math.sqrt(points.reduce((sum, point) => (
    sum + ((point.x - meanX) ** 2) + ((point.y - meanY) ** 2)
  ), 0) / points.length);
}

export function assessWebGazerPrediction({
  prediction,
  history = [],
  now,
  bounds,
  calibrated,
}) {
  const predictionAvailable = isFinitePoint(prediction);
  const x = predictionAvailable ? prediction.x : null;
  const y = predictionAvailable ? prediction.y : null;
  const validBounds = Number.isFinite(bounds?.width)
    && bounds.width > 0
    && Number.isFinite(bounds?.height)
    && bounds.height > 0;
  const insideScreenBounds = predictionAvailable && validBounds
    ? x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height
    : null;
  const recentPoints = history.filter((point) => (
    isFinitePoint(point)
    && Number.isFinite(point.timestamp)
    && now - point.timestamp <= WEBGAZER_QUALITY_WINDOW_MS
  ));
  const spreadPx = getSpread(recentPoints);
  const isStable = recentPoints.length >= WEBGAZER_MIN_STABLE_PREDICTIONS
    && spreadPx <= WEBGAZER_MAX_STABLE_SPREAD_PX;
  let state = WEBGAZER_STATES.UNKNOWN;
  let reason = 'prediction-unavailable';

  if (predictionAvailable && !validBounds) {
    reason = 'screen-bounds-unavailable';
  } else if (predictionAvailable && !calibrated) {
    reason = 'calibration-incomplete';
  } else if (predictionAvailable && !isStable) {
    reason = 'prediction-not-stable';
  } else if (predictionAvailable && insideScreenBounds) {
    state = WEBGAZER_STATES.SCREEN;
    reason = 'stable-prediction-inside-screen';
  } else if (predictionAvailable && isStable) {
    const marginX = bounds.width * WEBGAZER_OFFSCREEN_MARGIN_RATIO;
    const marginY = bounds.height * WEBGAZER_OFFSCREEN_MARGIN_RATIO;
    const beyondScreen = x < -marginX
      || x > bounds.width + marginX
      || y < -marginY
      || y > bounds.height + marginY;
    if (beyondScreen) {
      state = WEBGAZER_STATES.AWAY;
      reason = 'stable-prediction-beyond-screen-margin';
    } else {
      reason = 'prediction-near-screen-boundary';
    }
  }

  return {
    x,
    y,
    screenBounds: validBounds ? { width: bounds.width, height: bounds.height } : null,
    insideScreenBounds,
    predictionAvailable,
    calibrated: Boolean(calibrated),
    state,
    reason,
    quality: {
      recentPredictionCount: recentPoints.length,
      spreadPx,
      stable: isStable,
      confidence: null,
      confidenceAvailable: false,
    },
  };
}

function emptyStateCounts() {
  return {
    [WEBGAZER_STATES.SCREEN]: 0,
    [WEBGAZER_STATES.AWAY]: 0,
    [WEBGAZER_STATES.UNKNOWN]: 0,
  };
}

export function createWebGazerExperimentRecorder() {
  let startedAt = null;
  let stoppedAt = null;
  let activeStage = null;
  let samples = [];
  let stages = [];
  let lastSampleAt = null;

  function start(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Experiment start timestamp must be finite.');
    }
    startedAt = timestamp;
    stoppedAt = null;
    activeStage = null;
    samples = [];
    stages = [];
    lastSampleAt = null;
    return true;
  }

  function setStage(stage, timestamp) {
    if (startedAt === null || stoppedAt !== null || !stage?.id || !stage?.expectedCondition) {
      return false;
    }
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Experiment stage timestamp must be finite.');
    }
    activeStage = {
      id: stage.id,
      expectedCondition: stage.expectedCondition,
      expectedState: stage.expectedState,
      startedAt: timestamp,
      endedAt: null,
    };
    stages.push(activeStage);
    lastSampleAt = null;
    return true;
  }

  function endStage(timestamp) {
    if (!activeStage || stoppedAt !== null) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Experiment stage end timestamp must be finite.');
    }
    activeStage.endedAt = timestamp;
    activeStage = null;
    lastSampleAt = null;
    return true;
  }

  function record(estimate, timestamp, headPose = null) {
    if (startedAt === null || stoppedAt !== null || !activeStage) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Experiment sample timestamp must be finite.');
    }
    if (lastSampleAt !== null && timestamp - lastSampleAt < MIN_SAMPLE_INTERVAL_MS) return false;
    const validPose = headPose && ['yaw', 'pitch', 'roll']
      .every((field) => Number.isFinite(headPose[field]));
    samples.push({
      timestampMs: timestamp - startedAt,
      expectedCondition: activeStage.expectedCondition,
      expectedState: activeStage.expectedState,
      gazeCoordinates: {
        x: Number.isFinite(estimate?.x) ? estimate.x : null,
        y: Number.isFinite(estimate?.y) ? estimate.y : null,
      },
      screenBounds: estimate?.screenBounds ?? null,
      predictedState: Object.values(WEBGAZER_STATES).includes(estimate?.state)
        ? estimate.state
        : WEBGAZER_STATES.UNKNOWN,
      estimationAvailable: Boolean(estimate?.predictionAvailable),
      quality: {
        recentPredictionCount: Number.isFinite(estimate?.quality?.recentPredictionCount)
          ? estimate.quality.recentPredictionCount
          : 0,
        spreadPx: Number.isFinite(estimate?.quality?.spreadPx)
          ? estimate.quality.spreadPx
          : null,
        stable: Boolean(estimate?.quality?.stable),
        confidence: null,
        confidenceAvailable: false,
      },
      headPose: validPose
        ? { available: true, yaw: headPose.yaw, pitch: headPose.pitch, roll: headPose.roll }
        : { available: false, yaw: null, pitch: null, roll: null },
    });
    lastSampleAt = timestamp;
    return true;
  }

  function stop(timestamp) {
    if (startedAt === null || stoppedAt !== null) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Experiment stop timestamp must be finite.');
    }
    if (activeStage) endStage(timestamp);
    stoppedAt = timestamp;
    return true;
  }

  function getSnapshot() {
    const stageSummaries = stages.map((stage) => {
      const stageSamples = samples.filter((sample) => (
        sample.expectedCondition === stage.expectedCondition
      ));
      const stateCounts = stageSamples.reduce((counts, sample) => {
        counts[sample.predictedState] += 1;
        return counts;
      }, emptyStateCounts());
      return {
        id: stage.id,
        expectedCondition: stage.expectedCondition,
        expectedState: stage.expectedState,
        startedAtMs: stage.startedAt - startedAt,
        endedAtMs: Number.isFinite(stage.endedAt) ? stage.endedAt - startedAt : null,
        sampleCount: stageSamples.length,
        predictedStateCounts: stateCounts,
      };
    });
    return {
      schemaVersion: 1,
      dataScope: 'browser-memory-only',
      startedAtMs: startedAt,
      stoppedAtMs: stoppedAt,
      recording: startedAt !== null && stoppedAt === null,
      activeStage: activeStage ? { ...activeStage } : null,
      limitations: {
        outOfBoundsIsNotProofOfLookingAway: true,
        confidenceAvailable: false,
        headPoseAvailable: samples.some((sample) => sample.headPose.available),
        stabilityMetric: 'root-mean-square coordinate spread in the recent prediction window',
      },
      stageSummaries,
      sampleCount: samples.length,
      samples: samples.map((sample) => ({ ...sample })),
    };
  }

  return {
    start,
    setStage,
    endStage,
    record,
    stop,
    getSnapshot,
    serialize: () => JSON.stringify(getSnapshot(), null, 2),
  };
}
