const DEFAULT_OPTIONS = Object.freeze({
  windowMs: 10_000,
  maxSampleGapMs: 600,
  noiseFloor: 0.035,
  significantMovementThreshold: 0.18,
  minimumReliableMeasurements: 5,
  stableRateThreshold: 0.08,
  variableRateThreshold: 0.35,
  variableSignificantChanges: 4,
});

function isFiniteEye(eye) {
  return Number.isFinite(eye?.horizontal) && Number.isFinite(eye?.vertical);
}

function isReliableMeasurement(measurement) {
  return measurement?.reliability === 'reliable'
    && isFiniteEye(measurement.leftEye)
    && isFiniteEye(measurement.rightEye);
}

function snapshotMeasurement(measurement, timestamp) {
  const reliable = isReliableMeasurement(measurement);
  return {
    timestamp,
    leftEye: reliable
      ? {
        horizontal: measurement.leftEye.horizontal,
        vertical: measurement.leftEye.vertical,
      }
      : null,
    rightEye: reliable
      ? {
        horizontal: measurement.rightEye.horizontal,
        vertical: measurement.rightEye.vertical,
      }
      : null,
    reliability: reliable ? 'reliable' : 'unreliable',
  };
}

function movementMagnitude(previous, current) {
  const differences = [
    current.leftEye.horizontal - previous.leftEye.horizontal,
    current.leftEye.vertical - previous.leftEye.vertical,
    current.rightEye.horizontal - previous.rightEye.horizontal,
    current.rightEye.vertical - previous.rightEye.vertical,
  ];
  return Math.sqrt(differences.reduce((sum, difference) => sum + difference ** 2, 0) / differences.length);
}

function isValidOptions(options) {
  const positiveValues = [
    options.windowMs,
    options.maxSampleGapMs,
    options.minimumReliableMeasurements,
  ];
  const nonNegativeValues = [
    options.noiseFloor,
    options.significantMovementThreshold,
    options.stableRateThreshold,
    options.variableRateThreshold,
    options.variableSignificantChanges,
  ];
  return positiveValues.every((value) => Number.isFinite(value) && value > 0)
    && nonNegativeValues.every((value) => Number.isFinite(value) && value >= 0);
}

export function createEyeMovementTracker(config = {}) {
  const options = { ...DEFAULT_OPTIONS, ...config };
  if (!isValidOptions(options)) {
    throw new TypeError('Eye movement tracker options must be finite and within valid ranges.');
  }

  let samples = [];

  function prune(now) {
    const oldestTimestamp = now - options.windowMs;
    samples = samples.filter((sample) => sample.timestamp >= oldestTimestamp);
  }

  function addSample(measurement, timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Eye movement sample timestamp must be finite.');
    }

    const sample = snapshotMeasurement(measurement, timestamp);
    const lastSample = samples.at(-1);
    if (lastSample && timestamp <= lastSample.timestamp) {
      throw new RangeError('Eye movement sample timestamps must increase monotonically.');
    }
    samples.push(sample);
    prune(timestamp);
    return getSummary(timestamp);
  }

  function getSummary(now = samples.at(-1)?.timestamp ?? 0) {
    if (!Number.isFinite(now)) {
      throw new TypeError('Eye movement summary timestamp must be finite.');
    }
    prune(now);
    const reliableSamples = samples.filter((sample) => sample.reliability === 'reliable');
    const validMeasurements = reliableSamples.length;
    const totalMeasurements = samples.length;
    const reliablePercentage = totalMeasurements
      ? (validMeasurements / totalMeasurements) * 100
      : 0;
    const movements = [];

    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      const elapsedMs = current.timestamp - previous.timestamp;
      if (
        previous.reliability !== 'reliable'
        || current.reliability !== 'reliable'
        || elapsedMs <= 0
        || elapsedMs > options.maxSampleGapMs
      ) {
        continue;
      }

      const rawMagnitude = movementMagnitude(previous, current);
      const filteredMagnitude = Math.max(0, rawMagnitude - options.noiseFloor);
      movements.push({
        magnitude: filteredMagnitude,
        elapsedSeconds: elapsedMs / 1000,
      });
    }

    const elapsedMovementSeconds = movements.reduce(
      (total, movement) => total + movement.elapsedSeconds,
      0,
    );
    const totalFilteredMovement = movements.reduce(
      (total, movement) => total + movement.magnitude,
      0,
    );
    const averageMovementMagnitude = movements.length
      ? totalFilteredMovement / movements.length
      : null;
    const averageMovementRate = elapsedMovementSeconds > 0
      ? totalFilteredMovement / elapsedMovementSeconds
      : null;
    const significantMovementCount = movements.filter(
      (movement) => movement.magnitude >= options.significantMovementThreshold,
    ).length;
    const insufficientData = validMeasurements < options.minimumReliableMeasurements;
    let gazeStability = 'insufficient-data';
    if (!insufficientData) {
      if (
        (averageMovementRate ?? 0) <= options.stableRateThreshold
        && significantMovementCount === 0
      ) {
        gazeStability = 'stable';
      } else if (
        (averageMovementRate ?? 0) >= options.variableRateThreshold
        || significantMovementCount >= options.variableSignificantChanges
      ) {
        gazeStability = 'variable';
      } else {
        gazeStability = 'some-movement';
      }
    }

    return {
      validMeasurements,
      totalMeasurements,
      reliablePercentage,
      averageMovementMagnitude,
      averageMovementRate,
      significantMovementCount,
      gazeStability,
      insufficientData,
    };
  }

  function reset() {
    samples = [];
  }

  function getSamples() {
    return samples.map((sample) => ({
      ...sample,
      leftEye: sample.leftEye ? { ...sample.leftEye } : null,
      rightEye: sample.rightEye ? { ...sample.rightEye } : null,
    }));
  }

  return { addSample, getSummary, getSamples, reset };
}

export { DEFAULT_OPTIONS };
