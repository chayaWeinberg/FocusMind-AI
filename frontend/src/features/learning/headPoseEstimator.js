const DEFAULT_THRESHOLDS = Object.freeze({
  forwardYaw: 15,
  forwardPitch: 12,
  forwardRoll: 20,
  directionYaw: 20,
  directionPitch: 18,
  ambiguityMargin: 2,
  yawSign: -1,
  pitchSign: 1,
});

const DEGREES_PER_RADIAN = 180 / Math.PI;
const VECTOR_EPSILON = 1e-8;
const EULER_SINGULARITY_EPSILON = 1e-6;
const ORTHOGONALITY_TOLERANCE = 0.08;
const DETERMINANT_TOLERANCE = 0.15;

function unknownPose() {
  return {
    yaw: null,
    pitch: null,
    roll: null,
    direction: 'unknown',
  };
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function subtractScaled(vector, direction, scale) {
  return vector.map((value, index) => value - direction[index] * scale);
}

function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  if (!Number.isFinite(magnitude) || magnitude < VECTOR_EPSILON) return null;
  return vector.map((value) => value / magnitude);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function determinant(columns) {
  return dot(columns[0], cross(columns[1], columns[2]));
}

function extractRotation(data) {
  if (!Array.isArray(data) && !ArrayBuffer.isView(data)) return null;
  if (data.length !== 16 || Array.from(data).some((value) => !Number.isFinite(value))) {
    return null;
  }

  // MediaPipe packs matrices column-major: each consecutive group of four is a column.
  const columns = [
    [data[0], data[1], data[2]],
    [data[4], data[5], data[6]],
    [data[8], data[9], data[10]],
  ];
  const originalScales = columns.map((column) => Math.hypot(...column));
  if (originalScales.some((scale) => !Number.isFinite(scale) || scale < VECTOR_EPSILON)) {
    return null;
  }

  // The linear transform may contain small scale/shear errors; Gram-Schmidt retains
  // its column axes while producing an orthonormal rotation basis.
  const first = normalize(columns[0]);
  if (!first) return null;
  const second = normalize(subtractScaled(columns[1], first, dot(columns[1], first)));
  if (!second) return null;
  const third = normalize(cross(first, second));
  if (!third) return null;

  const rotationColumns = [first, second, third];
  if (dot(third, columns[2]) <= 0) return null;

  const normalizedColumns = columns.map((column, index) => (
    column.map((value) => value / originalScales[index])
  ));
  const orthogonalityError = Math.max(
    Math.abs(dot(normalizedColumns[0], normalizedColumns[1])),
    Math.abs(dot(normalizedColumns[0], normalizedColumns[2])),
    Math.abs(dot(normalizedColumns[1], normalizedColumns[2])),
  );
  const normalizedDeterminant = determinant(normalizedColumns);
  if (
    orthogonalityError > ORTHOGONALITY_TOLERANCE
    || !Number.isFinite(normalizedDeterminant)
    || Math.abs(normalizedDeterminant - 1) > DETERMINANT_TOLERANCE
  ) {
    return null;
  }

  return rotationColumns;
}

function classifyDirection(yaw, pitch, roll, thresholds) {
  const adjustedYaw = yaw * thresholds.yawSign;
  const adjustedPitch = pitch * thresholds.pitchSign;

  if (
    Math.abs(adjustedYaw) <= thresholds.forwardYaw
    && Math.abs(adjustedPitch) <= thresholds.forwardPitch
    && Math.abs(roll) <= thresholds.forwardRoll
  ) {
    return 'forward';
  }

  const beyondYaw = Math.abs(adjustedYaw) >= thresholds.directionYaw;
  const beyondPitch = Math.abs(adjustedPitch) >= thresholds.directionPitch;
  if (beyondYaw && beyondPitch) {
    const yawExcess = Math.abs(adjustedYaw) - thresholds.directionYaw;
    const pitchExcess = Math.abs(adjustedPitch) - thresholds.directionPitch;
    if (Math.abs(yawExcess - pitchExcess) <= thresholds.ambiguityMargin) return 'unknown';
    if (pitchExcess > yawExcess) return adjustedPitch < 0 ? 'up' : 'down';
    return adjustedYaw < 0 ? 'left' : 'right';
  }
  if (beyondYaw) return adjustedYaw < 0 ? 'left' : 'right';
  if (beyondPitch) return adjustedPitch < 0 ? 'up' : 'down';

  return 'unknown';
}

/**
 * Estimates Euler angles from MediaPipe's face-to-camera 4x4 transform.
 * The rotation convention is R = Rz(roll) * Ry(yaw) * Rx(pitch), in a
 * right-handed camera coordinate system with X right, Y down, and Z forward.
 * Direction signs are configurable to map the extracted angles to physical
 * directions; raw yaw, pitch, and roll values are returned unchanged.
 */
export function estimateHeadPose(matrix, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options };
  const nonNegativeThresholds = [
    thresholds.forwardYaw,
    thresholds.forwardPitch,
    thresholds.forwardRoll,
    thresholds.directionYaw,
    thresholds.directionPitch,
    thresholds.ambiguityMargin,
  ];
  if (
    !matrix
    || matrix.rows !== 4
    || matrix.columns !== 4
    || ![thresholds.yawSign, thresholds.pitchSign].every(
      (sign) => Number.isFinite(sign) && Math.abs(sign) === 1,
    )
    || nonNegativeThresholds.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    return unknownPose();
  }

  const rotation = extractRotation(matrix.data);
  if (!rotation) return unknownPose();

  const [first, second, third] = rotation;
  const r00 = first[0];
  const r10 = first[1];
  const r20 = first[2];
  const r21 = second[2];
  const r22 = third[2];

  // For Rz * Ry * Rx, yaw uses atan2(-r20, hypot(r00, r10)); its singularity
  // occurs near +/-90 degrees of yaw and is treated as unknown.
  const yawRadians = Math.atan2(-r20, Math.hypot(r00, r10));
  const cosineYaw = Math.hypot(r00, r10);
  if (cosineYaw < EULER_SINGULARITY_EPSILON) return unknownPose();

  const pitchRadians = Math.atan2(r21, r22);
  const rollRadians = Math.atan2(r10, r00);
  const yaw = yawRadians * DEGREES_PER_RADIAN;
  const pitch = pitchRadians * DEGREES_PER_RADIAN;
  const roll = rollRadians * DEGREES_PER_RADIAN;
  if (![yaw, pitch, roll].every(Number.isFinite)) return unknownPose();

  return {
    yaw,
    pitch,
    roll,
    direction: classifyDirection(yaw, pitch, roll, thresholds),
  };
}

export { DEFAULT_THRESHOLDS };
