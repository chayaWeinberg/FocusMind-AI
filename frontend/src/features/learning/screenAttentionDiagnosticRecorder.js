const RECORDING_DURATION_MS = 10_000;

const SAMPLE_FIELDS = Object.freeze([
  'timestampMs',
  'headYaw',
  'headPitch',
  'leftEyeHorizontal',
  'leftEyeVertical',
  'rightEyeHorizontal',
  'rightEyeVertical',
  'eyeMeasurementReliability',
  'eyeReliabilityReason',
  'combinedYaw',
  'combinedPitch',
  'screenAttentionState',
  'screenAttentionReason',
  'smoothedScreenAttentionState',
  'eyeLookDownLeft',
  'eyeLookDownRight',
]);

function isFiniteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function snapshotSample(sample) {
  return Object.fromEntries(SAMPLE_FIELDS.map((field) => [field, sample[field] ?? null]));
}

function createScreenAttentionDiagnosticRecorder() {
  let startedAt = null;
  let stoppedAt = null;
  let recording = false;
  let samples = [];

  function start(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic recording start time must be finite.');
    }
    samples = [];
    startedAt = timestamp;
    stoppedAt = null;
    recording = true;
  }

  function stop(timestamp) {
    if (!recording) return;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic recording stop time must be finite.');
    }
    stoppedAt = Math.max(timestamp, startedAt);
    recording = false;
  }

  function record(sample, timestamp) {
    if (!recording) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic sample time must be finite.');
    }
    const elapsed = timestamp - startedAt;
    if (elapsed < 0) {
      throw new RangeError('Diagnostic sample time cannot precede recording start.');
    }
    if (elapsed >= RECORDING_DURATION_MS) {
      stop(timestamp);
      return false;
    }
    samples.push(snapshotSample({
      ...sample,
      timestampMs: elapsed,
    }));
    return true;
  }

  function reset() {
    recording = false;
    startedAt = null;
    stoppedAt = null;
    samples = [];
  }

  function getSnapshot() {
    const reliableSamples = samples.filter(
      (sample) => sample.eyeMeasurementReliability === 'reliable',
    ).length;
    const counts = {
      LIKELY_ON_SCREEN: 0,
      LIKELY_OFF_SCREEN: 0,
      UNKNOWN: 0,
    };
    samples.forEach((sample) => {
      if (Object.prototype.hasOwnProperty.call(counts, sample.screenAttentionState)) {
        counts[sample.screenAttentionState] += 1;
      }
    });
    return {
      recording,
      startedAt,
      stoppedAt,
      durationMs: startedAt === null
        ? 0
        : Math.min(RECORDING_DURATION_MS, (stoppedAt ?? startedAt) - startedAt),
      totalSamples: samples.length,
      reliableSamples,
      onScreenSamples: counts.LIKELY_ON_SCREEN,
      offScreenSamples: counts.LIKELY_OFF_SCREEN,
      unknownSamples: counts.UNKNOWN,
      samples: samples.map((sample) => ({ ...sample })),
    };
  }

  function toJSON() {
    const snapshot = getSnapshot();
    return {
      schemaVersion: 1,
      recordingDurationLimitMs: RECORDING_DURATION_MS,
      sampleCount: snapshot.totalSamples,
      reliableSampleCount: snapshot.reliableSamples,
      stateSampleCounts: {
        likelyOnScreen: snapshot.onScreenSamples,
        likelyOffScreen: snapshot.offScreenSamples,
        unknown: snapshot.unknownSamples,
      },
      samples: snapshot.samples,
    };
  }

  function serialize() {
    return JSON.stringify(toJSON(), null, 2);
  }

  return { start, stop, record, reset, getSnapshot, toJSON, serialize };
}

export {
  RECORDING_DURATION_MS,
  createScreenAttentionDiagnosticRecorder,
};
