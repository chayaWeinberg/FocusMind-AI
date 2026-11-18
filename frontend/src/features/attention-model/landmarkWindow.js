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

/** Square crop around the face: side = largest face extent × this (20% margin each side). */
export const FACE_CROP_SCALE = 1.4;

/**
 * Re-expresses landmarks relative to a square crop around the face, like the
 * training data (faces cut out with a 20% margin before landmark extraction).
 * x and y become 0..1 inside the crop; z (MediaPipe scales it like x, by the
 * image width) is rescaled the same way. Measured on our own recordings, the
 * crop is what lets the model separate looking at the screen from looking away.
 *
 * @param {Array<{x:number,y:number,z:number}>} landmarks normalised to the camera frame
 * @param {number} width camera frame width in pixels
 * @param {number} height camera frame height in pixels
 * @returns {Array<{x:number,y:number,z:number}>}
 */
export function cropLandmarks(landmarks, width, height) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of landmarks) {
    const x = point.x * width;
    const y = point.y * height;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const size = Math.max(maxX - minX, maxY - minY) * FACE_CROP_SCALE;
  if (!(size > 0)) return landmarks;
  const left = (minX + maxX) / 2 - size / 2;
  const top = (minY + maxY) / 2 - size / 2;
  return landmarks.map((point) => ({
    x: (point.x * width - left) / size,
    y: (point.y * height - top) / size,
    z: (point.z * width) / size,
  }));
}

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
      // A fixed 10-per-second clock (sample-and-hold): every 100 ms slot gets
      // the latest frame. With a fast camera extra frames are skipped; when the
      // analysis is slower (the lesson video competes for the CPU) the latest
      // frame fills the missed slots. The window therefore always spans ~10 s,
      // like the training data, and fills in ~10 s whatever the frame rate.
      const elapsed = at - lastStoredAt;
      if (elapsed < intervalMs * 0.9) return false;
      const slots = Number.isFinite(elapsed) ? Math.min(frames, Math.max(1, Math.round(elapsed / intervalMs))) : 1;
      for (let slot = 0; slot < slots; slot += 1) {
        const offset = next * FRAME_SIZE;
        for (let index = 0; index < LANDMARK_COUNT; index += 1) {
          const point = landmarks[index];
          ring[offset + index * 3] = point.x;
          ring[offset + index * 3 + 1] = point.y;
          ring[offset + index * 3 + 2] = point.z;
        }
        next = (next + 1) % frames;
        count = Math.min(count + 1, frames);
      }
      lastStoredAt += slots * intervalMs;
      if (!Number.isFinite(lastStoredAt) || at - lastStoredAt >= intervalMs) lastStoredAt = at;
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
