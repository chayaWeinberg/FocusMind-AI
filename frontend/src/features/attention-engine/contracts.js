// Output contract of the attention engine.
//
// The engine estimates *where the user is looking relative to the screen*
// from webcam signals. It does NOT measure cognitive concentration: a person
// can look at the screen without focusing, and look away while thinking.
// Every output therefore carries a confidence and a reason, and uncertain
// measurements are never reported as attention or distraction. The
// concentration score (concentration.js) is an *estimate* derived from gaze
// direction and fatigue signs, and is always presented as one.
//
// Privacy: frames and landmarks are processed in the browser only and are
// never stored or sent anywhere.

export const ATTENTION_STATES = Object.freeze({
  ON_SCREEN: 'ON_SCREEN',
  OFF_SCREEN: 'OFF_SCREEN',
  FACE_ABSENT: 'FACE_ABSENT',
  UNCERTAIN: 'UNCERTAIN',
});

// Why a state was chosen. UNCERTAIN always comes with one of these.
export const ATTENTION_REASONS = Object.freeze({
  GAZE_ON_SCREEN: 'gaze-on-screen',
  HEAD_TURNED_AWAY: 'head-turned-away',
  GAZE_OFF_SCREEN: 'gaze-off-screen',
  NO_FACE: 'no-face',
  LOW_LANDMARK_QUALITY: 'low-landmark-quality',
  EYES_NOT_MEASURABLE: 'eyes-not-measurable',
  NEAR_SCREEN_EDGE: 'near-screen-edge',
  ADAPTING: 'adapting',
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
 * One smoothed engine output.
 *
 * @typedef {object} AttentionFrame
 * @property {number} timestamp            performance.now() milliseconds
 * @property {keyof typeof ATTENTION_STATES} state
 * @property {number} confidence           0..1
 * @property {string} reason               one of ATTENTION_REASONS
 * @property {string[]} fatigueIndicators  zero or more FATIGUE_INDICATORS
 */

const STATE_VALUES = new Set(Object.values(ATTENTION_STATES));
const REASON_VALUES = new Set(Object.values(ATTENTION_REASONS));
const FATIGUE_VALUES = new Set(Object.values(FATIGUE_INDICATORS));

/** Runtime check used by engine tests. */
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
