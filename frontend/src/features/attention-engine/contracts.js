// Contracts for the NEW attention engine (not implemented yet).
//
// The engine estimates *where the user is looking relative to the screen*
// from webcam signals. It does NOT measure cognitive concentration: a person
// can look at the screen without focusing, and look away while thinking.
// Every output must therefore carry a confidence and a reason, and the UI must
// describe it as "looking at the screen", never as "concentrating".
//
// Privacy invariants (apply to every module in this folder):
//  - video frames and landmarks are processed in the browser only;
//  - only aggregated, non-biometric session summaries may ever leave the device,
//    and only with explicit user consent (not implemented).

export const ATTENTION_STATES = Object.freeze({
  ON_SCREEN: 'ON_SCREEN',
  OFF_SCREEN: 'OFF_SCREEN',
  FACE_ABSENT: 'FACE_ABSENT',
  UNCERTAIN: 'UNCERTAIN',
});

// Why a state was chosen. UNCERTAIN must always come with one of these.
export const ATTENTION_REASONS = Object.freeze({
  GAZE_ON_SCREEN: 'gaze-on-screen',
  HEAD_TURNED_AWAY: 'head-turned-away',
  GAZE_OFF_SCREEN: 'gaze-off-screen',
  NO_FACE: 'no-face',
  LOW_LANDMARK_QUALITY: 'low-landmark-quality',
  EYES_NOT_MEASURABLE: 'eyes-not-measurable',
  SIGNALS_DISAGREE: 'signals-disagree',
  NEAR_SCREEN_EDGE: 'near-screen-edge',
  CALIBRATING: 'calibrating',
  NOT_CALIBRATED: 'not-calibrated',
  OUTSIDE_CALIBRATION: 'outside-calibration',
  CAMERA_UNAVAILABLE: 'camera-unavailable',
  PAUSED: 'paused',
});

// Fatigue indicators are *possible* signs reported next to the attention
// state, never as a diagnosis and never merged into it.
export const FATIGUE_INDICATORS = Object.freeze({
  BLINK_RATE_HIGH: 'blink-rate-high',
  LONG_EYE_CLOSURE: 'long-eye-closure',
  YAWN: 'yawn',
});

/**
 * One smoothed engine output, produced at most a few times per second.
 *
 * @typedef {object} AttentionFrame
 * @property {number} timestamp            performance.now() milliseconds
 * @property {keyof typeof ATTENTION_STATES} state
 * @property {number} confidence           0..1
 * @property {string} reason               one of ATTENTION_REASONS
 * @property {string[]} fatigueIndicators  zero or more FATIGUE_INDICATORS
 * @property {Record<string, number|null>} [signals] per-signal scores for diagnostics only
 */

const STATE_VALUES = new Set(Object.values(ATTENTION_STATES));
const REASON_VALUES = new Set(Object.values(ATTENTION_REASONS));
const FATIGUE_VALUES = new Set(Object.values(FATIGUE_INDICATORS));

/** Runtime check used by engine tests and by consumers in development. */
export function isValidAttentionFrame(frame) {
  return Boolean(
    frame
    && Number.isFinite(frame.timestamp)
    && STATE_VALUES.has(frame.state)
    && Number.isFinite(frame.confidence)
    && frame.confidence >= 0
    && frame.confidence <= 1
    && REASON_VALUES.has(frame.reason)
    && Array.isArray(frame.fatigueIndicators)
    && frame.fatigueIndicators.every((indicator) => FATIGUE_VALUES.has(indicator)),
  );
}
