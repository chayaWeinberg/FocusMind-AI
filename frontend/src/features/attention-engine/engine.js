// The attention engine: signals -> adaptive baseline + fusion -> temporal
// smoothing (+ possible fatigue indicators and an estimated concentration
// score). Calibration-free.
// Pure JavaScript (no DOM/React), tested with synthetic Face Landmarker results.

import { ATTENTION_REASONS } from './contracts.js';
import { extractSignals } from './signals.js';
import { createAdaptiveBaseline } from './baseline.js';
import { fuseSignals } from './fusion.js';
import { createTemporalSmoother } from './temporal.js';
import { createFatigueMonitor } from './fatigue.js';
import { createConcentrationEstimator } from './concentration.js';

export function createAttentionEngine(options = {}) {
  const baseline = createAdaptiveBaseline(options.baseline);
  const smoother = createTemporalSmoother(options.temporal);
  const fatigue = createFatigueMonitor(options.fatigue);
  const concentration = createConcentrationEstimator(options.concentration);

  return {
    /** Re-learn the screen-facing pose (e.g. after the user moved). */
    recenter() {
      baseline.reset();
      smoother.reset(ATTENTION_REASONS.ADAPTING);
    },
    reset(reason = ATTENTION_REASONS.PAUSED) {
      baseline.reset();
      smoother.reset(reason);
      fatigue.reset();
      concentration.reset();
    },
    /**
     * @param {object|null} result Face Landmarker result for one video frame
     * @param {number} timestamp performance.now() ms
     * @param {{frameWidth:number, frameHeight:number}} frameSize
     */
    process(result, timestamp, frameSize) {
      const signals = extractSignals(result, frameSize);
      const fatigueSummary = fatigue.update(signals, timestamp);
      const raw = fuseSignals(signals, baseline.getBaseline(), options.fusion);
      const adaptation = baseline.observe(signals, timestamp, raw);
      if (adaptation === 'posture-changed') smoother.reset(ATTENTION_REASONS.ADAPTING);
      const snapshot = smoother.add(raw, timestamp);
      const status = baseline.getStatus(timestamp);
      const estimate = concentration.update({ state: snapshot.state, fatigue: fatigueSummary }, timestamp);
      return {
        frame: {
          timestamp,
          state: snapshot.state,
          confidence: snapshot.confidence,
          reason: snapshot.reason,
          fatigueIndicators: fatigueSummary.indicators,
          since: snapshot.since,
          adapted: status.ready,
          adaptationProgress: status.progress,
          concentration: estimate,
        },
        raw,
        adaptation,
        signals,
        fatigue: fatigueSummary,
      };
    },
    /** Frame to publish while the camera is off or analysis is paused. */
    unavailable(reason, timestamp) {
      smoother.reset(reason);
      return {
        timestamp,
        state: 'UNCERTAIN',
        confidence: 0,
        reason,
        fatigueIndicators: [],
        since: timestamp,
        adapted: Boolean(baseline.getBaseline()),
        adaptationProgress: baseline.getBaseline() ? 1 : 0,
        concentration: null,
      };
    },
  };
}
