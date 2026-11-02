import { describe, expect, it } from 'vitest';
import { estimateScreenAttention } from './screenAttentionEstimator.js';

function pose(yaw = 0, pitch = 0) {
  return { yaw, pitch };
}

function gaze(horizontal = 0, vertical = 0, leftEye, rightEye) {
  return {
    horizontal,
    vertical,
    leftEye: leftEye || { horizontal, vertical },
    rightEye: rightEye || { horizontal, vertical },
    reliability: 'reliable',
  };
}

describe('estimateScreenAttention', () => {
  it('classifies neutral head and eyes as likely on-screen', () => {
    expect(estimateScreenAttention(pose(), gaze())).toMatchObject({
      state: 'LIKELY_ON_SCREEN',
      measurementQuality: 'reliable',
      qualityScore: 1,
    });
  });

  it('allows moderate head movement while estimating screen orientation', () => {
    expect(estimateScreenAttention(pose(-30, 20), gaze())).toMatchObject({
      state: 'LIKELY_ON_SCREEN',
    });
  });

  it('allows eye movement to compensate for a moderate head turn', () => {
    expect(estimateScreenAttention(pose(-40, 0), gaze(-0.8))).toMatchObject({
      state: 'LIKELY_ON_SCREEN',
      combinedYaw: 20,
    });
  });

  it('classifies a large head turn away as likely off-screen', () => {
    expect(estimateScreenAttention(pose(-70, 0), gaze())).toMatchObject({
      state: 'LIKELY_OFF_SCREEN',
    });
  });

  it('returns unknown for unreliable eye measurements', () => {
    expect(estimateScreenAttention(pose(), {
      ...gaze(),
      reliability: 'unreliable',
    })).toMatchObject({
      state: 'UNKNOWN',
      measurementQuality: 'unreliable',
    });
  });

  it('returns unknown when the eyes provide conflicting measurements', () => {
    expect(estimateScreenAttention(pose(), gaze(0, 0, {
      horizontal: 0.6,
      vertical: 0,
    }, {
      horizontal: -0.6,
      vertical: 0,
    }))).toMatchObject({
      state: 'UNKNOWN',
      reason: 'conflicting-eye-measurements',
    });
  });

  it('returns unknown when the face or head-pose measurements are missing', () => {
    expect(estimateScreenAttention(null, gaze())).toMatchObject({ state: 'UNKNOWN' });
    expect(estimateScreenAttention(pose(), null)).toMatchObject({ state: 'UNKNOWN' });
  });

  it('returns unknown in the provisional ambiguity band', () => {
    expect(estimateScreenAttention(pose(-55, 0), gaze())).toMatchObject({
      state: 'UNKNOWN',
      reason: 'ambiguous-screen-orientation',
    });
  });

  it('uses configurable provisional thresholds', () => {
    expect(estimateScreenAttention(pose(-22, 0), gaze(), {
      onScreenHorizontal: 20,
      offScreenHorizontal: 25,
    })).toMatchObject({ state: 'UNKNOWN' });
  });
});
