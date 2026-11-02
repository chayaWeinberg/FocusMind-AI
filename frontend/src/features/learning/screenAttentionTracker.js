const DEFAULT_OPTIONS = Object.freeze({
  windowMs: 10_000,
  maxSampleGapMs: 600,
  transitionHoldMs: 400,
});

const STATES = Object.freeze([
  'LIKELY_ON_SCREEN',
  'LIKELY_OFF_SCREEN',
  'UNKNOWN',
]);

function isValidOptions(options) {
  return [options.windowMs, options.maxSampleGapMs]
    .every((value) => Number.isFinite(value) && value > 0)
    && Number.isFinite(options.transitionHoldMs)
    && options.transitionHoldMs >= 0;
}

function createScreenAttentionTracker(config = {}) {
  const options = { ...DEFAULT_OPTIONS, ...config };
  if (!isValidOptions(options)) {
    throw new TypeError('Screen attention tracker options must be finite and within valid ranges.');
  }

  let samples = [];
  let currentState = 'UNKNOWN';
  let candidateState = null;
  let candidateStartedAt = null;

  function prune(now) {
    const oldestTimestamp = now - options.windowMs;
    const firstSampleInWindow = samples.findIndex(
      (sample) => sample.timestamp >= oldestTimestamp,
    );
    if (firstSampleInWindow < 0) {
      samples = samples.slice(-1);
    } else if (firstSampleInWindow > 0) {
      samples = samples.slice(firstSampleInWindow - 1);
    }
  }

  function smoothState(rawState, timestamp) {
    if (!STATES.includes(rawState) || rawState === 'UNKNOWN') {
      currentState = 'UNKNOWN';
      candidateState = null;
      candidateStartedAt = null;
      return currentState;
    }

    if (rawState === currentState) {
      candidateState = null;
      candidateStartedAt = null;
      return currentState;
    }

    if (candidateState !== rawState) {
      candidateState = rawState;
      candidateStartedAt = timestamp;
      if (options.transitionHoldMs === 0) {
        currentState = rawState;
        candidateState = null;
        candidateStartedAt = null;
        return currentState;
      }
      currentState = 'UNKNOWN';
      return currentState;
    }

    if (timestamp - candidateStartedAt >= options.transitionHoldMs) {
      currentState = rawState;
      candidateState = null;
      candidateStartedAt = null;
    } else {
      currentState = 'UNKNOWN';
    }
    return currentState;
  }

  function addSample(estimate, timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Screen attention sample timestamp must be finite.');
    }
    const lastSample = samples.at(-1);
    if (lastSample && timestamp <= lastSample.timestamp) {
      throw new RangeError('Screen attention sample timestamps must increase monotonically.');
    }
    if (lastSample && timestamp - lastSample.timestamp > options.maxSampleGapMs) {
      currentState = 'UNKNOWN';
      candidateState = null;
      candidateStartedAt = null;
    }

    const state = smoothState(estimate?.state, timestamp);
    samples.push({
      timestamp,
      state,
      measurementQuality: estimate?.measurementQuality === 'reliable'
        || estimate?.measurementQuality === 'degraded'
        ? estimate.measurementQuality
        : 'unreliable',
      qualityScore: Number.isFinite(estimate?.qualityScore)
        ? Math.max(0, Math.min(1, estimate.qualityScore))
        : 0,
    });
    prune(timestamp);
    return getSummary(timestamp);
  }

  function getSummary(now = samples.at(-1)?.timestamp ?? 0) {
    if (!Number.isFinite(now)) {
      throw new TypeError('Screen attention summary timestamp must be finite.');
    }
    prune(now);
    const durations = {
      LIKELY_ON_SCREEN: 0,
      LIKELY_OFF_SCREEN: 0,
      UNKNOWN: 0,
    };
    const oldestTimestamp = now - options.windowMs;

    samples.forEach((sample, index) => {
      const nextSample = samples[index + 1];
      const intervalEnd = nextSample?.timestamp ?? now;
      if (intervalEnd <= sample.timestamp) return;

      const observedEnd = Math.min(intervalEnd, sample.timestamp + options.maxSampleGapMs);
      const observedStart = Math.max(sample.timestamp, oldestTimestamp);
      const clippedEnd = Math.min(observedEnd, now);
      if (clippedEnd > observedStart) {
        durations[sample.state] += clippedEnd - observedStart;
      }

      const gapStart = Math.max(sample.timestamp + options.maxSampleGapMs, oldestTimestamp);
      const gapEnd = Math.min(intervalEnd, now);
      if (gapEnd > gapStart) durations.UNKNOWN += gapEnd - gapStart;
    });

    const latest = samples.at(-1);
    return {
      currentState: latest?.state ?? 'UNKNOWN',
      onScreenMs: durations.LIKELY_ON_SCREEN,
      offScreenMs: durations.LIKELY_OFF_SCREEN,
      unknownMs: durations.UNKNOWN,
      measurementQuality: latest?.measurementQuality ?? 'unreliable',
      qualityScore: latest?.qualityScore ?? 0,
      sampleCount: samples.filter((sample) => sample.timestamp >= oldestTimestamp).length,
      windowMs: options.windowMs,
    };
  }

  function reset() {
    samples = [];
    currentState = 'UNKNOWN';
    candidateState = null;
    candidateStartedAt = null;
  }

  function getSamples() {
    return samples.map((sample) => ({ ...sample }));
  }

  return { addSample, getSummary, getSamples, reset };
}

export { DEFAULT_OPTIONS, createScreenAttentionTracker };
