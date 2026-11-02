const LANDMARKS = Object.freeze({
  rightEye: {
    iris: 468,
    outerCorner: 33,
    innerCorner: 133,
    upperLid: 159,
    lowerLid: 145,
  },
  leftEye: {
    iris: 473,
    outerCorner: 263,
    innerCorner: 362,
    upperLid: 386,
    lowerLid: 374,
  },
});

const DEFAULT_THRESHOLDS = Object.freeze({
  centerHorizontal: 0.22,
  centerVertical: 0.22,
  directionHorizontal: 0.3,
  directionVertical: 0.3,
  ambiguityMargin: 0.15,
  minimumEyeAspectRatio: 0.08,
});

const EPSILON = 1e-6;

function eyeValues(measurement) {
  return {
    horizontal: Number.isFinite(measurement?.horizontal) ? measurement.horizontal : null,
    vertical: Number.isFinite(measurement?.vertical) ? measurement.vertical : null,
  };
}

function unknownGaze(reason, leftEye = null, rightEye = null) {
  return {
    horizontal: null,
    vertical: null,
    leftEye: eyeValues(leftEye),
    rightEye: eyeValues(rightEye),
    direction: 'unknown',
    reliability: 'unreliable',
    reason,
  };
}

function isNormalizedLandmark(landmark) {
  return landmark
    && Number.isFinite(landmark.x)
    && Number.isFinite(landmark.y)
    && landmark.x >= 0
    && landmark.x <= 1
    && landmark.y >= 0
    && landmark.y <= 1;
}

function getEyeMeasurement(landmarks, eye, minimumEyeAspectRatio) {
  const requiredIndices = [
    eye.iris,
    eye.outerCorner,
    eye.innerCorner,
    eye.upperLid,
    eye.lowerLid,
  ];
  if (requiredIndices.some((index) => !landmarks[index])) return { error: 'missing-landmarks' };
  if (requiredIndices.some((index) => !isNormalizedLandmark(landmarks[index]))) {
    return { error: 'invalid-landmarks' };
  }

  const iris = landmarks[eye.iris];
  const outerCorner = landmarks[eye.outerCorner];
  const innerCorner = landmarks[eye.innerCorner];
  const upperLid = landmarks[eye.upperLid];
  const lowerLid = landmarks[eye.lowerLid];
  const eyeWidth = Math.abs(innerCorner.x - outerCorner.x);
  const eyeOpening = lowerLid.y - upperLid.y;

  if (
    !Number.isFinite(eyeWidth)
    || !Number.isFinite(eyeOpening)
    || eyeWidth < EPSILON
    || eyeOpening <= eyeWidth * minimumEyeAspectRatio
  ) {
    return { error: 'eyes-closed-or-invalid' };
  }

  const horizontal = (iris.x - (outerCorner.x + innerCorner.x) / 2) / (eyeWidth / 2);
  const vertical = (
    iris.y - (upperLid.y + lowerLid.y) / 2
  ) / (eyeOpening / 2);

  if (
    !Number.isFinite(horizontal)
    || !Number.isFinite(vertical)
    || Math.abs(horizontal) > 1.5
    || Math.abs(vertical) > 1.5
  ) {
    return { error: 'invalid-measurement' };
  }

  return { horizontal, vertical };
}

function classifyDirection(horizontal, vertical, thresholds) {
  const absoluteHorizontal = Math.abs(horizontal);
  const absoluteVertical = Math.abs(vertical);
  if (
    absoluteHorizontal <= thresholds.centerHorizontal
    && absoluteVertical <= thresholds.centerVertical
  ) {
    return 'center';
  }

  const horizontalAway = absoluteHorizontal >= thresholds.directionHorizontal;
  const verticalAway = absoluteVertical >= thresholds.directionVertical;

  if (horizontalAway && verticalAway) {
    if (Math.abs(absoluteHorizontal - absoluteVertical) <= thresholds.ambiguityMargin) {
      return 'unknown';
    }
    if (absoluteHorizontal > absoluteVertical) {
      return horizontal > 0 ? 'left' : 'right';
    }
    return vertical < 0 ? 'up' : 'down';
  }

  if (horizontalAway) return horizontal > 0 ? 'left' : 'right';
  if (verticalAway) return vertical < 0 ? 'up' : 'down';
  return 'unknown';
}

/**
 * Estimates eye-in-head movement from MediaPipe's normalized, unmirrored
 * landmarks. Positive horizontal displacement is image-right (the subject's
 * physical left); positive vertical displacement is image-down.
 */
export function estimateEyeGaze(landmarks, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options };
  if (!Array.isArray(landmarks)) return unknownGaze('no-face');
  if (Object.values(thresholds).some((value) => !Number.isFinite(value) || value < 0)) {
    return unknownGaze('invalid-thresholds');
  }

  const rightEye = getEyeMeasurement(landmarks, LANDMARKS.rightEye, thresholds.minimumEyeAspectRatio);
  const leftEye = getEyeMeasurement(landmarks, LANDMARKS.leftEye, thresholds.minimumEyeAspectRatio);
  if (rightEye.error || leftEye.error) {
    return unknownGaze(
      rightEye.error || leftEye.error,
      leftEye,
      rightEye,
    );
  }

  const horizontal = (leftEye.horizontal + rightEye.horizontal) / 2;
  const vertical = (leftEye.vertical + rightEye.vertical) / 2;

  return {
    horizontal,
    vertical,
    leftEye: eyeValues(leftEye),
    rightEye: eyeValues(rightEye),
    direction: classifyDirection(horizontal, vertical, thresholds),
    reliability: 'reliable',
    reason: null,
  };
}

export { DEFAULT_THRESHOLDS };
