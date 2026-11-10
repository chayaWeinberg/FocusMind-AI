// Synthetic MediaPipe Face Landmarker results for tests.
// Geometry is built in pixel space, then normalized like MediaPipe does.

import { EYE_LANDMARKS } from '../signals.js';

export const FRAME = Object.freeze({ frameWidth: 640, frameHeight: 480 });
const RADIANS = Math.PI / 180;

/** Column-major 4x4 for R = Rz(roll) * Ry(yaw) * Rx(pitch) plus translation. */
export function poseMatrix({ yaw = 0, pitch = 0, roll = 0, translation = { x: 0, y: 0, z: -50 } }) {
  const [a, b, c] = [pitch * RADIANS, yaw * RADIANS, roll * RADIANS];
  const rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
  const ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
  const rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  const multiply = (left, right) => left.map((row) => right[0].map((_, column) => (
    row.reduce((sum, value, index) => sum + value * right[index][column], 0)
  )));
  const rotation = multiply(rz, multiply(ry, rx));
  const data = [];
  for (let column = 0; column < 3; column += 1) {
    data.push(rotation[0][column], rotation[1][column], rotation[2][column], 0);
  }
  data.push(translation.x, translation.y, translation.z, 1);
  return { rows: 4, columns: 4, data };
}

/**
 * @param {object} face
 * @param {number} [face.yaw] [face.pitch] [face.roll] head pose, degrees
 * @param {number} [face.irisH] [face.irisV] iris offset, half-eye-width units
 * @param {number} [face.eyeAspect] eyelid opening / eye width
 * @param {number} [face.faceWidth] fraction of frame width
 * @param {{x:number,y:number}} [face.center] normalized face center
 * @param {number} [face.blink] eyeBlink blendshape score
 * @param {number} [face.jawOpen] jawOpen blendshape score
 * @param {{x:number,y:number,z:number}} [face.translation]
 */
export function syntheticResult(face = {}) {
  const {
    yaw = 0, pitch = 0, roll = 0,
    irisH = 0, irisV = 0, eyeAspect = 0.3,
    faceWidth = 0.3, center = { x: 0.5, y: 0.5 },
    blink = 0, jawOpen = 0,
    translation = { x: 0, y: 0, z: -50 },
  } = face;
  const { frameWidth, frameHeight } = FRAME;
  const facePx = faceWidth * frameWidth;
  const cx = center.x * frameWidth;
  const cy = center.y * frameHeight;
  const toNormalized = (x, y) => ({ x: x / frameWidth, y: y / frameHeight, z: 0 });

  // Face outline: a circle of points so the bounding box equals faceWidth.
  const landmarks = Array.from({ length: 478 }, (_, index) => {
    const angle = (index / 478) * 2 * Math.PI;
    return toNormalized(cx + Math.cos(angle) * facePx / 2, cy + Math.sin(angle) * facePx / 2 * 1.2);
  });

  const eyeWidth = 0.22 * facePx;
  const cosRoll = Math.cos(roll * RADIANS);
  const sinRoll = Math.sin(roll * RADIANS);
  const axis = { x: cosRoll, y: sinRoll }; // image-right along the eye line
  const normal = { x: -sinRoll, y: cosRoll }; // image-down
  const place = (origin, along, across) => ({
    x: origin.x + axis.x * along + normal.x * across,
    y: origin.y + axis.y * along + normal.y * across,
  });
  const faceOrigin = { x: cx, y: cy };

  [
    { eye: EYE_LANDMARKS.right, offset: -0.24 * facePx, outerSide: -1 }, // image-left
    { eye: EYE_LANDMARKS.left, offset: 0.24 * facePx, outerSide: 1 },
  ].forEach(({ eye, offset, outerSide }) => {
    const middle = place(faceOrigin, offset, -0.12 * facePx);
    const outer = place(middle, outerSide * eyeWidth / 2, 0);
    const inner = place(middle, -outerSide * eyeWidth / 2, 0);
    const iris = place(middle, irisH * eyeWidth / 2, irisV * eyeWidth / 2);
    const upper = place(middle, 0, -eyeAspect * eyeWidth / 2);
    const lower = place(middle, 0, eyeAspect * eyeWidth / 2);
    landmarks[eye.outer] = toNormalized(outer.x, outer.y);
    landmarks[eye.inner] = toNormalized(inner.x, inner.y);
    landmarks[eye.iris] = toNormalized(iris.x, iris.y);
    landmarks[eye.upper] = toNormalized(upper.x, upper.y);
    landmarks[eye.lower] = toNormalized(lower.x, lower.y);
  });

  return {
    faceLandmarks: [landmarks],
    facialTransformationMatrixes: [poseMatrix({ yaw, pitch, roll, translation })],
    faceBlendshapes: [{
      categories: [
        { categoryName: 'eyeBlinkLeft', score: blink },
        { categoryName: 'eyeBlinkRight', score: blink },
        { categoryName: 'jawOpen', score: jawOpen },
      ],
    }],
  };
}

export const NO_FACE = Object.freeze({ faceLandmarks: [], facialTransformationMatrixes: [], faceBlendshapes: [] });

/** Deterministic pseudo-random generator (tests must be reproducible). */
export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * A simulated user: looking at screen point (gx, gy) moves the head a bit and
 * the eyes the rest, with a camera mounted above the screen (pitch offset).
 */
export function simulatedUser({ noise = 0.6, seed = 7, yawGain = -18, pitchGain = 14, irisGainH = 0.8, irisGainV = 0.3 } = {}) {
  const random = seededRandom(seed);
  const jitter = (scale) => (random() - 0.5) * 2 * scale;
  return {
    lookAt(gx, gy, extra = {}) {
      return syntheticResult({
        yaw: yawGain * (gx - 0.5) + jitter(noise),
        pitch: pitchGain * (gy - 0.5) - 6 + jitter(noise),
        roll: jitter(noise),
        irisH: irisGainH * (gx - 0.5) + jitter(noise * 0.02),
        irisV: irisGainV * (gy - 0.5) + jitter(noise * 0.02),
        ...extra,
      });
    },
  };
}
