// Temporal smoothing with evidence accumulation and hysteresis.
//
// Each raw frame adds `confidence` worth of evidence to its state; evidence
// decays exponentially (time constant tauMs). The published state changes
// only when another state has clearly more evidence (hysteresis) for at least
// that state's dwell time. This removes flicker from blinks and single bad
// frames without hiding real changes for long.

import { ATTENTION_REASONS, ATTENTION_STATES } from './contracts.js';

export const TEMPORAL_DEFAULTS = Object.freeze({
  tauMs: 450,
  hysteresis: 0.12,
  dwellMs: Object.freeze({
    ON_SCREEN: 350,
    OFF_SCREEN: 600,
    FACE_ABSENT: 900,
    UNCERTAIN: 800,
  }),
  // A gap longer than this (tab hidden, camera stalled) restarts the history.
  maximumGapMs: 2000,
});

const STATES = Object.values(ATTENTION_STATES);

export function createTemporalSmoother(options = {}) {
  const config = {
    ...TEMPORAL_DEFAULTS,
    ...options,
    dwellMs: { ...TEMPORAL_DEFAULTS.dwellMs, ...options.dwellMs },
  };
  let evidence;
  let current;
  let currentReason;
  let currentSince;
  let candidate;
  let candidateSince;
  let lastTimestamp;
  let averageConfidence;
  const latestReason = {};

  function reset(reason = ATTENTION_REASONS.PAUSED) {
    evidence = Object.fromEntries(STATES.map((state) => [state, 0]));
    averageConfidence = {};
    current = ATTENTION_STATES.UNCERTAIN;
    currentReason = reason;
    currentSince = null;
    candidate = null;
    candidateSince = null;
    lastTimestamp = null;
  }
  reset();

  function probabilities() {
    const total = STATES.reduce((sum, state) => sum + evidence[state], 0);
    if (total <= 1e-9) return Object.fromEntries(STATES.map((state) => [state, 0]));
    return Object.fromEntries(STATES.map((state) => [state, evidence[state] / total]));
  }

  function snapshot(timestamp) {
    const shares = probabilities();
    return {
      state: current,
      // Confidence = share of recent evidence supporting the published state
      // x the typical per-frame confidence of that state.
      confidence: shares[current] * (averageConfidence[current] ?? 0),
      reason: currentReason,
      since: currentSince ?? timestamp,
      evidence: shares,
    };
  }

  return {
    reset,
    /** @param {{state:string, confidence:number, reason:string}} raw */
    add(raw, timestamp) {
      if (lastTimestamp !== null && timestamp - lastTimestamp > config.maximumGapMs) {
        reset(currentReason);
      }
      const dt = lastTimestamp === null ? config.tauMs : Math.max(0, timestamp - lastTimestamp);
      lastTimestamp = timestamp;
      const decay = Math.exp(-dt / config.tauMs);
      STATES.forEach((state) => {
        evidence[state] = evidence[state] * decay
          + (state === raw.state ? raw.confidence * (1 - decay) : 0);
      });
      latestReason[raw.state] = raw.reason;
      const previousAverage = averageConfidence[raw.state];
      averageConfidence[raw.state] = previousAverage === undefined
        ? raw.confidence
        : previousAverage * 0.8 + raw.confidence * 0.2;
      if (currentSince === null) currentSince = timestamp;

      const shares = probabilities();
      const leader = STATES.reduce((best, state) => (shares[state] > shares[best] ? state : best), current);

      if (leader === current) {
        candidate = null;
        currentReason = latestReason[current] ?? currentReason;
      } else if (shares[leader] >= shares[current] + config.hysteresis) {
        if (candidate !== leader) {
          candidate = leader;
          candidateSince = timestamp;
        }
        if (timestamp - candidateSince >= config.dwellMs[leader]) {
          current = leader;
          currentReason = latestReason[leader];
          currentSince = timestamp;
          candidate = null;
        }
      } else {
        candidate = null;
      }
      return snapshot(timestamp);
    },
    getSnapshot(timestamp) {
      return snapshot(timestamp);
    },
  };
}
