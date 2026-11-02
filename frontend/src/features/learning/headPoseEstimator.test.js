import { describe, expect, it } from 'vitest';
import { estimateHeadPose } from './headPoseEstimator.js';

function matrixFromEuler(yawDegrees, pitchDegrees, rollDegrees, scale = [1, 1, 1]) {
  const radians = Math.PI / 180;
  const yaw = yawDegrees * radians;
  const pitch = pitchDegrees * radians;
  const roll = rollDegrees * radians;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  // R = Rz(roll) * Ry(yaw) * Rx(pitch), encoded column-major.
  const rows = [
    [cr * cy, cr * sy * sp - sr * cp, cr * sy * cp + sr * sp],
    [sr * cy, sr * sy * sp + cr * cp, sr * sy * cp - cr * sp],
    [-sy, cy * sp, cy * cp],
  ];
  const data = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      data.push(rows[row][column] * scale[column]);
    }
    data.push(0);
  }
  data.push(0, 0, 0, 1);
  return { rows: 4, columns: 4, data };
}

function expectAngles(pose, { yaw = 0, pitch = 0, roll = 0 }) {
  expect(pose.yaw).toBeCloseTo(yaw, 5);
  expect(pose.pitch).toBeCloseTo(pitch, 5);
  expect(pose.roll).toBeCloseTo(roll, 5);
}

describe('estimateHeadPose', () => {
  it('returns forward for an identity matrix', () => {
    const pose = estimateHeadPose(matrixFromEuler(0, 0, 0));

    expectAngles(pose, {});
    expect(pose.direction).toBe('forward');
  });

  it('calculates positive and negative known yaw rotations', () => {
    expectAngles(estimateHeadPose(matrixFromEuler(35, 0, 0)), { yaw: 35 });
    expectAngles(estimateHeadPose(matrixFromEuler(-35, 0, 0)), { yaw: -35 });
  });

  it('calculates positive and negative known pitch rotations', () => {
    expectAngles(estimateHeadPose(matrixFromEuler(0, 27, 0)), { pitch: 27 });
    expectAngles(estimateHeadPose(matrixFromEuler(0, -27, 0)), { pitch: -27 });
  });

  it('calculates positive and negative known roll rotations', () => {
    expectAngles(estimateHeadPose(matrixFromEuler(0, 0, 32)), { roll: 32 });
    expectAngles(estimateHeadPose(matrixFromEuler(0, 0, -32)), { roll: -32 });
  });

  it('extracts combined rotations in the documented order', () => {
    expectAngles(estimateHeadPose(matrixFromEuler(24, -16, 11)), {
      yaw: 24,
      pitch: -16,
      roll: 11,
    });
  });

  it('uses the MediaPipe column-major matrix layout', () => {
    const matrix = matrixFromEuler(0, 0, 42);
    expect(matrix.data[1]).toBeCloseTo(Math.sin(42 * Math.PI / 180), 5);
    expect(matrix.data[4]).toBeCloseTo(-Math.sin(42 * Math.PI / 180), 5);
    expectAngles(estimateHeadPose(matrix), { roll: 42 });
  });

  it('separates rotation from per-axis scale', () => {
    const pose = estimateHeadPose(matrixFromEuler(-31, 14, 8, [1.4, 0.8, 1.15]));
    expectAngles(pose, { yaw: -31, pitch: 14, roll: 8 });
  });

  it.each([
    ['wrong row count', { rows: 3, columns: 4, data: matrixFromEuler(0, 0, 0).data }],
    ['wrong column count', { rows: 4, columns: 3, data: matrixFromEuler(0, 0, 0).data }],
    ['missing matrix', null],
    ['missing matrix data', { rows: 4, columns: 4 }],
    ['short matrix data', { rows: 4, columns: 4, data: [1, 0, 0] }],
    ['NaN matrix value', { ...matrixFromEuler(0, 0, 0), data: matrixFromEuler(0, 0, 0).data.map((value, i) => (i === 0 ? NaN : value)) }],
    ['infinite matrix value', { ...matrixFromEuler(0, 0, 0), data: matrixFromEuler(0, 0, 0).data.map((value, i) => (i === 5 ? Infinity : value)) }],
    ['zero rotation axis', { rows: 4, columns: 4, data: Array(16).fill(0) }],
    ['reflection matrix', { rows: 4, columns: 4, data: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }],
  ])('returns unknown for %s', (_description, matrix) => {
    expect(estimateHeadPose(matrix)).toEqual({
      yaw: null,
      pitch: null,
      roll: null,
      direction: 'unknown',
    });
  });

  it('allows configurable thresholds and yaw/pitch sign mappings', () => {
    const pose = estimateHeadPose(matrixFromEuler(25, 0, 0), {
      directionYaw: 24,
      yawSign: -1,
    });
    expect(pose.direction).toBe('left');

    expect(estimateHeadPose(matrixFromEuler(0, -22, 0), {
      directionPitch: 20,
      pitchSign: -1,
    }).direction).toBe('down');
  });

  it('returns unknown for ambiguous simultaneous yaw and pitch', () => {
    expect(estimateHeadPose(matrixFromEuler(25, -23, 0)).direction).toBe('unknown');
  });

  it.each([
    [-35, 0, 'right'],
    [35, 0, 'left'],
    [0, -25, 'up'],
    [0, 25, 'down'],
  ])('classifies yaw %s and pitch %s as %s', (yaw, pitch, direction) => {
    expect(estimateHeadPose(matrixFromEuler(yaw, pitch, 0)).direction).toBe(direction);
  });

  it('maps negative yaw to physical right and positive yaw to physical left without changing raw yaw', () => {
    const physicalRight = estimateHeadPose(matrixFromEuler(-35, 0, 0));
    const physicalLeft = estimateHeadPose(matrixFromEuler(35, 0, 0));

    expect(physicalRight.yaw).toBeCloseTo(-35, 5);
    expect(physicalRight.direction).toBe('right');
    expect(physicalLeft.yaw).toBeCloseTo(35, 5);
    expect(physicalLeft.direction).toBe('left');
  });

  it('preserves forward, up, and down classifications with the physical yaw mapping', () => {
    expect(estimateHeadPose(matrixFromEuler(0, 0, 0)).direction).toBe('forward');
    expect(estimateHeadPose(matrixFromEuler(0, -25, 0)).direction).toBe('up');
    expect(estimateHeadPose(matrixFromEuler(0, 25, 0)).direction).toBe('down');
  });

  it('returns unknown near the Euler singularity', () => {
    const pose = estimateHeadPose(matrixFromEuler(90, 45, 10));
    expect(pose.direction).toBe('unknown');
  });
});
