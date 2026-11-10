// The attention engine: signals -> fusion -> temporal smoothing (+ fatigue).
// Pure JavaScript, no DOM/React, so it can be tested on synthetic or recorded
// Face Landmarker results. useAttentionEngine() feeds it from the camera.

import { ATTENTION_REASONS, ATTENTION_STATES } from './contracts.js';
import { extractSignals } from './signals.js';
import { fuseSignals } from './fusion.js';
import { createTemporalSmoother } from './temporal.js';
import { createFatigueMonitor } from './fatigue.js';

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signalSummary(signals, raw) {
  return {
    headYaw: round(signals.head.yaw, 1),
    headPitch: round(signals.head.pitch, 1),
    headRoll: round(signals.head.roll, 1),
    eyeHorizontal: round(signals.eyes.horizontal),
    eyeVertical: round(signals.eyes.vertical),
    eyeOpenness: round(signals.eyes.openness),
    faceQuality: round(signals.quality.face, 2),
    headQuality: round(signals.quality.head, 2),
    eyeQuality: round(signals.quality.eyes, 2),
    onScreenProbability: round(raw.onScreenProbability, 2),
  };
}

export function createAttentionEngine(options = {}) {
  const smoother = createTemporalSmoother(options.temporal);
  const fatigue = createFatigueMonitor(options.fatigue);
  let model = null;
  let calibrating = false;

  function frameFrom(snapshot, timestamp, fatigueSummary, extra = {}) {
    return {
      timestamp,
      state: snapshot.state,
      confidence: snapshot.confidence,
      reason: snapshot.reason,
      fatigueIndicators: fatigueSummary?.indicators ?? [],
      since: snapshot.since,
      calibrated: Boolean(model),
      ...extra,
    };
  }

  return {
    setCalibration(nextModel) {
      model = nextModel || null;
      smoother.reset(model ? ATTENTION_REASONS.PAUSED : ATTENTION_REASONS.NOT_CALIBRATED);
    },
    getCalibration() {
      return model;
    },
    setCalibrating(value) {
      calibrating = Boolean(value);
      smoother.reset(ATTENTION_REASONS.CALIBRATING);
    },
    reset(reason = ATTENTION_REASONS.PAUSED) {
      smoother.reset(reason);
      fatigue.reset();
    },
    /**
     * @param {object|null} result Face Landmarker result for one video frame
     * @param {number} timestamp performance.now() ms
     * @param {{frameWidth:number, frameHeight:number}} frameSize
     */
    process(result, timestamp, frameSize) {
      const signals = extractSignals(result, frameSize);
      const fatigueSummary = fatigue.update(signals, timestamp);

      if (calibrating) {
        const raw = {
          state: ATTENTION_STATES.UNCERTAIN,
          confidence: 0,
          reason: ATTENTION_REASONS.CALIBRATING,
          gazePoint: null,
          onScreenProbability: null,
          modelUsed: 'none',
          recalibrationSuggested: false,
        };
        return {
          frame: {
            timestamp,
            state: ATTENTION_STATES.UNCERTAIN,
            confidence: 0,
            reason: ATTENTION_REASONS.CALIBRATING,
            fatigueIndicators: fatigueSummary.indicators,
            since: timestamp,
            calibrated: Boolean(model),
            signals: signalSummary(signals, raw),
          },
          raw,
          signals,
          fatigue: fatigueSummary,
        };
      }

      const raw = fuseSignals(signals, model, options.fusion);
      const snapshot = smoother.add(raw, timestamp);
      return {
        frame: frameFrom(snapshot, timestamp, fatigueSummary, {
          signals: signalSummary(signals, raw),
          recalibrationSuggested: raw.recalibrationSuggested,
        }),
        raw,
        evidence: snapshot.evidence,
        signals,
        fatigue: fatigueSummary,
      };
    },
    /** Frame to publish while the camera is off or analysis is paused. */
    unavailable(reason, timestamp) {
      smoother.reset(reason);
      return {
        timestamp,
        state: ATTENTION_STATES.UNCERTAIN,
        confidence: 0,
        reason,
        fatigueIndicators: [],
        since: timestamp,
        calibrated: Boolean(model),
      };
    },
  };
}
