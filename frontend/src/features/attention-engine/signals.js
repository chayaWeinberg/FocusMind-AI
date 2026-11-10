// Signal extraction: turns one MediaPipe Face Landmarker result into the
// measurements the engine uses, each with an explicit quality score.
// Pure function, no DOM: easy to test with synthetic or recorded data.

import { estimateHeadPose } from '../learning/headPoseEstimator.js';
import { extractBlendshapeScores } from '../vision/faceLandmarker.js';
import { clamp, isFiniteNumber } from './math.js';

// MediaPipe 478-point face mesh (with iris refinement). "right"/"left" are the
// subject's eyes: the right eye appears on the image's left side.
export const EYE_LANDMARKS = Object.freeze({
  right: Object.freeze({ iris: 468, outer: 33, inner: 133, upper: 159, lower: 145 }),
  left: Object.freeze({ iris: 473, outer: 263, inner: 362, upper: 386, lower: 374 }),
});

export const SIGNAL_BLENDSHAPES = Object.freeze([
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'jawOpen',
]);

export const SIGNAL_LIMITS = Object.freeze({
  minimumEyeWidthPx: 8,
  goodEyeWidthPx: 22,
  closedEyeAspectRatio: 0.14,
  maximumIrisOffset: 1.6,
  maximumEyeDisagreement: 0.6,
  goodFaceWidth: 0.14,
  minimumFaceWidth: 0.05,
  edgeMargin: 0.015,
  reliableYaw: 50,
  reliableRoll: 35,
});

const DEFAULT_FRAME = Object.freeze({ frameWidth: 640, frameHeight: 480 });

function toPixel(landmark, frameWidth, frameHeight) {
  if (!landmark || !isFiniteNumber(landmark.x) || !isFiniteNumber(landmark.y)) return null;
  return { x: landmark.x * frameWidth, y: landmark.y * frameHeight };
}

/**
 * Iris position inside one eye, in the eye's own axis (compensates head roll).
 * horizontal: +1 = iris at the image-right corner; vertical: + = image-down,
 * both in units of half the eye width (more stable than the lid opening).
 */
export function measureEye(landmarks, eye, frame = DEFAULT_FRAME) {
  const { frameWidth, frameHeight } = frame;
  const points = Object.fromEntries(Object.entries(eye).map(([name, index]) => (
    [name, toPixel(landmarks[index], frameWidth, frameHeight)]
  )));
  if (Object.values(points).some((point) => point === null)) {
    return { valid: false, reason: 'missing-landmarks' };
  }

  let axisX = points.inner.x - points.outer.x;
  let axisY = points.inner.y - points.outer.y;
  const width = Math.hypot(axisX, axisY);
  if (!(width >= SIGNAL_LIMITS.minimumEyeWidthPx)) {
    return { valid: false, reason: 'eye-too-small', widthPx: width };
  }
  axisX /= width;
  axisY /= width;
  if (axisX < 0) { // always measure along image-right
    axisX = -axisX;
    axisY = -axisY;
  }
  const normalX = -axisY;
  const normalY = axisX;

  const midX = (points.inner.x + points.outer.x) / 2;
  const midY = (points.inner.y + points.outer.y) / 2;
  const irisDX = points.iris.x - midX;
  const irisDY = points.iris.y - midY;
  const horizontal = (irisDX * axisX + irisDY * axisY) / (width / 2);
  const vertical = (irisDX * normalX + irisDY * normalY) / (width / 2);
  const opening = Math.hypot(points.lower.x - points.upper.x, points.lower.y - points.upper.y);
  const aspectRatio = opening / width;

  const base = { horizontal, vertical, aspectRatio, widthPx: width };
  if (aspectRatio < SIGNAL_LIMITS.closedEyeAspectRatio) {
    return { ...base, valid: false, reason: 'eye-closed' };
  }
  if (
    Math.abs(horizontal) > SIGNAL_LIMITS.maximumIrisOffset
    || Math.abs(vertical) > SIGNAL_LIMITS.maximumIrisOffset
  ) {
    return { ...base, valid: false, reason: 'implausible-iris' };
  }
  return { ...base, valid: true, reason: null };
}

function faceBox(landmarks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of landmarks) {
    if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX)) return null;
  const margin = SIGNAL_LIMITS.edgeMargin;
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
    atEdge: minX < margin || minY < margin || maxX > 1 - margin || maxY > 1 - margin,
  };
}

function headTranslation(matrix) {
  const data = matrix?.data;
  if (!data || data.length !== 16) return null;
  const [x, y, z] = [data[12], data[13], data[14]];
  return [x, y, z].every(isFiniteNumber) ? { x, y, z } : null;
}

function faceQuality(box) {
  if (!box) return 0;
  const { goodFaceWidth, minimumFaceWidth } = SIGNAL_LIMITS;
  const sizeScore = clamp((box.width - minimumFaceWidth) / (goodFaceWidth - minimumFaceWidth), 0, 1);
  return sizeScore * (box.atEdge ? 0.4 : 1);
}

function headQuality(head) {
  if (!head.valid) return 0;
  const yawPenalty = clamp((Math.abs(head.yaw) - SIGNAL_LIMITS.reliableYaw) / 20, 0, 1);
  const rollPenalty = clamp((Math.abs(head.roll) - SIGNAL_LIMITS.reliableRoll) / 20, 0, 1);
  return clamp(1 - Math.max(yawPenalty, rollPenalty), 0, 1);
}

function combineEyes(left, right) {
  const validEyes = [left, right].filter((eye) => eye.valid);
  const aspectRatios = [left, right]
    .map((eye) => eye.aspectRatio)
    .filter(isFiniteNumber);
  const openness = aspectRatios.length
    ? aspectRatios.reduce((sum, value) => sum + value, 0) / aspectRatios.length
    : null;

  if (validEyes.length === 0) {
    const closed = [left, right].some((eye) => eye.reason === 'eye-closed');
    return {
      valid: false,
      horizontal: null,
      vertical: null,
      openness,
      quality: 0,
      reason: closed ? 'eyes-closed' : (left.reason || right.reason || 'eyes-unavailable'),
    };
  }

  const horizontal = validEyes.reduce((sum, eye) => sum + eye.horizontal, 0) / validEyes.length;
  const vertical = validEyes.reduce((sum, eye) => sum + eye.vertical, 0) / validEyes.length;
  const smallestWidth = Math.min(...validEyes.map((eye) => eye.widthPx));
  const sizeScore = clamp(
    (smallestWidth - SIGNAL_LIMITS.minimumEyeWidthPx)
      / (SIGNAL_LIMITS.goodEyeWidthPx - SIGNAL_LIMITS.minimumEyeWidthPx),
    0,
    1,
  );
  let quality = sizeScore * (validEyes.length === 2 ? 1 : 0.6);
  let reason = validEyes.length === 2 ? null : 'one-eye-only';
  if (validEyes.length === 2) {
    const disagreement = Math.hypot(
      left.horizontal - right.horizontal,
      left.vertical - right.vertical,
    );
    if (disagreement > SIGNAL_LIMITS.maximumEyeDisagreement) {
      quality *= 0.3;
      reason = 'eyes-disagree';
    }
  }
  return { valid: quality > 0, horizontal, vertical, openness, quality, reason };
}

/**
 * @param {object|null} result MediaPipe FaceLandmarkerResult
 * @param {{ frameWidth?: number, frameHeight?: number }} [frame] video size in pixels
 */
export function extractSignals(result, frame = DEFAULT_FRAME) {
  const size = {
    frameWidth: frame.frameWidth > 0 ? frame.frameWidth : DEFAULT_FRAME.frameWidth,
    frameHeight: frame.frameHeight > 0 ? frame.frameHeight : DEFAULT_FRAME.frameHeight,
  };
  const landmarks = result?.faceLandmarks?.[0];
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return {
      faceDetected: false,
      head: { valid: false, yaw: null, pitch: null, roll: null, translation: null },
      eyes: { valid: false, horizontal: null, vertical: null, openness: null, quality: 0, reason: 'no-face' },
      leftEye: null,
      rightEye: null,
      face: null,
      blendshapes: null,
      quality: { face: 0, head: 0, eyes: 0 },
    };
  }

  const matrix = result.facialTransformationMatrixes?.[0];
  const pose = matrix ? estimateHeadPose(matrix) : null;
  const head = {
    valid: Boolean(pose && [pose.yaw, pose.pitch, pose.roll].every(isFiniteNumber)),
    yaw: pose?.yaw ?? null,
    pitch: pose?.pitch ?? null,
    roll: pose?.roll ?? null,
    translation: headTranslation(matrix),
  };
  const face = faceBox(landmarks);
  const leftEye = measureEye(landmarks, EYE_LANDMARKS.left, size);
  const rightEye = measureEye(landmarks, EYE_LANDMARKS.right, size);
  const eyes = combineEyes(leftEye, rightEye);

  return {
    faceDetected: true,
    head,
    eyes,
    leftEye,
    rightEye,
    face,
    blendshapes: extractBlendshapeScores(result, SIGNAL_BLENDSHAPES),
    quality: {
      face: faceQuality(face),
      head: headQuality(head),
      eyes: eyes.quality,
    },
  };
}

/** Eyes-closed estimate used by the fatigue monitor (blendshapes preferred). */
export function eyesClosed(signals) {
  if (!signals?.faceDetected) return null;
  const left = signals.blendshapes?.eyeBlinkLeft;
  const right = signals.blendshapes?.eyeBlinkRight;
  if (isFiniteNumber(left) && isFiniteNumber(right)) return (left + right) / 2 >= 0.5;
  if (isFiniteNumber(signals.eyes.openness)) {
    return signals.eyes.openness < SIGNAL_LIMITS.closedEyeAspectRatio;
  }
  return null;
}
