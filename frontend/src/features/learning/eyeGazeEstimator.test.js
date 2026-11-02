import { describe, expect, it } from 'vitest';
import { estimateEyeGaze } from './eyeGazeEstimator.js';

function createLandmarks({
  horizontalShift = 0,
  verticalShift = 0,
  eyeOpening = 0.04,
} = {}) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const setEye = ({ iris, outer, inner, upper, lower, centerX }) => {
    landmarks[outer] = { x: centerX - 0.05, y: 0.5, z: 0 };
    landmarks[inner] = { x: centerX + 0.05, y: 0.5, z: 0 };
    landmarks[upper] = { x: centerX, y: 0.5 - eyeOpening / 2, z: 0 };
    landmarks[lower] = { x: centerX, y: 0.5 + eyeOpening / 2, z: 0 };
    landmarks[iris] = {
      x: centerX + horizontalShift,
      y: 0.5 + verticalShift,
      z: 0,
    };
  };

  setEye({ iris: 468, outer: 33, inner: 133, upper: 159, lower: 145, centerX: 0.35 });
  setEye({ iris: 473, outer: 263, inner: 362, upper: 386, lower: 374, centerX: 0.65 });
  return landmarks;
}

describe('estimateEyeGaze', () => {
  it('classifies centered iris positions without implying screen attention', () => {
    const gaze = estimateEyeGaze(createLandmarks());

    expect(gaze.horizontal).toBeCloseTo(0);
    expect(gaze.vertical).toBeCloseTo(0);
    expect(gaze.direction).toBe('center');
    expect(gaze.reliability).toBe('reliable');
  });

  it.each([
    [0.02, 'left'],
    [-0.02, 'right'],
  ])('classifies source-image horizontal displacement %s as physical %s', (shift, direction) => {
    const gaze = estimateEyeGaze(createLandmarks({ horizontalShift: shift }));
    expect(gaze.direction).toBe(direction);
    expect(gaze.reliability).toBe('reliable');
  });

  it('reports both eyes in the same source-image convention before averaging', () => {
    const gaze = estimateEyeGaze(createLandmarks({ horizontalShift: -0.02 }));

    expect(gaze.leftEye.horizontal).toBeCloseTo(-0.4);
    expect(gaze.rightEye.horizontal).toBeCloseTo(-0.4);
    expect(gaze.horizontal).toBeCloseTo(-0.4);
  });

  it.each([
    [-0.014, 'up'],
    [0.014, 'down'],
  ])('classifies source-image vertical displacement %s as %s', (shift, direction) => {
    const gaze = estimateEyeGaze(createLandmarks({ verticalShift: shift }));
    expect(gaze.direction).toBe(direction);
  });

  it('returns unknown and unreliable when no face is available', () => {
    expect(estimateEyeGaze(null)).toMatchObject({
      horizontal: null,
      vertical: null,
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'no-face',
    });
  });

  it('returns unknown when required landmarks are missing', () => {
    const landmarks = createLandmarks();
    landmarks[468] = undefined;

    expect(estimateEyeGaze(landmarks)).toMatchObject({
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'missing-landmarks',
    });
  });

  it('returns unknown for closed or nearly closed eyes', () => {
    expect(estimateEyeGaze(createLandmarks({ eyeOpening: 0.005 }))).toMatchObject({
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'eyes-closed-or-invalid',
    });
  });

  it('returns unknown for invalid eye geometry', () => {
    const landmarks = createLandmarks();
    landmarks[133] = { ...landmarks[33] };

    expect(estimateEyeGaze(landmarks)).toMatchObject({
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'eyes-closed-or-invalid',
    });
  });

  it('returns unknown when measurements are non-finite', () => {
    const landmarks = createLandmarks();
    landmarks[473] = { ...landmarks[473], x: Number.NaN };

    expect(estimateEyeGaze(landmarks)).toMatchObject({
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'invalid-landmarks',
    });
  });

  it('is independent of the CSS-mirrored preview', () => {
    const sourceLandmarks = createLandmarks({ horizontalShift: -0.02 });
    const landmarksReadFromUnmirroredSource = sourceLandmarks.map((landmark) => ({ ...landmark }));
    const landmarksReadWhilePreviewIsCSSMirrored = sourceLandmarks.map((landmark) => ({ ...landmark }));

    expect(estimateEyeGaze(landmarksReadWhilePreviewIsCSSMirrored))
      .toEqual(estimateEyeGaze(landmarksReadFromUnmirroredSource));
    expect(estimateEyeGaze(landmarksReadWhilePreviewIsCSSMirrored).direction).toBe('right');
  });

  it('does not classify a diagonal, ambiguous movement as a cardinal direction', () => {
    const gaze = estimateEyeGaze(createLandmarks({
      horizontalShift: 0.02,
      verticalShift: 0.008,
    }));
    expect(gaze.direction).toBe('unknown');
    expect(gaze.reliability).toBe('reliable');
  });
});
