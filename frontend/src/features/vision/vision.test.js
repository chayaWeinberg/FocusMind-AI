import { describe, expect, it, vi } from 'vitest';
import {
  getCameraErrorMessage,
  hasLiveVideoTrack,
  isCameraSupported,
  stopStream,
} from './cameraStream.js';
import { EYE_LOOK_BLENDSHAPES, extractBlendshapeScores } from './faceLandmarker.js';

describe('cameraStream', () => {
  it('stops every track and tolerates a missing stream', () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    stopStream({ getTracks: () => tracks });
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    expect(() => stopStream(null)).not.toThrow();
  });

  it('detects whether a stream still has a live video track', () => {
    expect(hasLiveVideoTrack({ getVideoTracks: () => [{ readyState: 'live' }] })).toBe(true);
    expect(hasLiveVideoTrack({ getVideoTracks: () => [{ readyState: 'ended' }] })).toBe(false);
    expect(hasLiveVideoTrack(null)).toBe(false);
  });

  it('maps camera errors to Hebrew messages with a safe default', () => {
    expect(getCameraErrorMessage({ name: 'NotAllowedError' })).toMatch('נדחתה');
    expect(getCameraErrorMessage({ name: 'NotFoundError' })).toMatch('לא נמצאה מצלמה');
    expect(getCameraErrorMessage(undefined)).toMatch('אירעה שגיאה');
  });

  it('reports camera support from mediaDevices', () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    expect(isCameraSupported()).toBe(false);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true,
    });
    expect(isCameraSupported()).toBe(true);
    Object.defineProperty(navigator, 'mediaDevices', { value: original, configurable: true });
  });
});

describe('extractBlendshapeScores', () => {
  it('returns requested scores and nulls for missing or invalid values', () => {
    const scores = extractBlendshapeScores({
      faceBlendshapes: [{
        categories: [
          { categoryName: 'eyeLookInLeft', score: 0.4 },
          { categoryName: 'eyeLookOutLeft', score: Number.NaN },
          { categoryName: 'jawOpen', score: 0.9 },
        ],
      }],
    }, EYE_LOOK_BLENDSHAPES);

    expect(scores.eyeLookInLeft).toBe(0.4);
    expect(scores.eyeLookOutLeft).toBeNull();
    expect(scores.eyeLookDownRight).toBeNull();
    expect(scores).not.toHaveProperty('jawOpen');
  });

  it('returns null when no blendshapes are available', () => {
    expect(extractBlendshapeScores({}, EYE_LOOK_BLENDSHAPES)).toBeNull();
    expect(extractBlendshapeScores({ faceBlendshapes: [{ categories: [] }] }, ['x'])).toBeNull();
  });
});
