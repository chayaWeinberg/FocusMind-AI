// Sliding window of MediaPipe face landmarks for the course attention model.
//
// The model was trained on windows of 100 frames sampled at 10 frames per
// second (about ten seconds), each frame the 478 raw Face Landmarker points
// (x, y, z). Frames arrive faster (~15/s), so they are down-sampled to 10/s.
// When the face is missing for more than `maxGapMs`, the window starts over:
// the model never runs on a window that contains a long absence ("לא זוהו
// פנים" is shown instead). Kept free of React and the DOM so it can be tested.

export const WINDOW_FRAMES = 100;
export const LANDMARK_COUNT = 478;
export const SAMPLE_INTERVAL_MS = 100;
export const MAX_GAP_MS = 1000;

const FRAME_SIZE = LANDMARK_COUNT * 3;

/**
 * @param {{ frames?: number, intervalMs?: number, maxGapMs?: number }} [options]
 */
export function createLandmarkWindow({
  frames = WINDOW_FRAMES,
  intervalMs = SAMPLE_INTERVAL_MS,
  maxGapMs = MAX_GAP_MS,
} = {}) {
  const ring = new Float32Array(frames * FRAME_SIZE);
  let count = 0;
  let next = 0; // ring index of the next write
  let lastStoredAt = Number.NEGATIVE_INFINITY;
  let lastFaceAt = Number.NEGATIVE_INFINITY;

  function reset() {
    count = 0;
    next = 0;
    lastStoredAt = Number.NEGATIVE_INFINITY;
  }

  return {
    /**
     * @param {Array<{x:number,y:number,z:number}>|null|undefined} landmarks first face, or null
     * @param {number} at timestamp in milliseconds
     * @returns {boolean} true when the frame was stored
     */
    push(landmarks, at) {
      if (!Array.isArray(landmarks) || landmarks.length !== LANDMARK_COUNT) {
        if (at - lastFaceAt > maxGapMs) reset();
        return false;
      }
      if (at - lastFaceAt > maxGapMs) reset(); // face is back after a long absence
      lastFaceAt = at;
      // 10 frames per second (a little slack so ~15 fps input keeps a steady 10 fps).
      if (at - lastStoredAt < intervalMs * 0.9) return false;
      const offset = next * FRAME_SIZE;
      for (let index = 0; index < LANDMARK_COUNT; index += 1) {
        const point = landmarks[index];
        ring[offset + index * 3] = point.x;
        ring[offset + index * 3 + 1] = point.y;
        ring[offset + index * 3 + 2] = point.z;
      }
      next = (next + 1) % frames;
      count = Math.min(count + 1, frames);
      lastStoredAt = at;
      return true;
    },
    /** Share of the window collected, 0..1. */
    progress() {
      return count / frames;
    },
    full() {
      return count === frames;
    },
    /** The window oldest-first, shaped for the model input [1, frames, 478, 3]. */
    toTensorData() {
      const data = new Float32Array(frames * FRAME_SIZE);
      const start = count === frames ? next : 0;
      for (let index = 0; index < count; index += 1) {
        const source = ((start + index) % frames) * FRAME_SIZE;
        data.set(ring.subarray(source, source + FRAME_SIZE), index * FRAME_SIZE);
      }
      return data;
    },
    reset,
  };
}
