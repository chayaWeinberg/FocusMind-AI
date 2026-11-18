import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LANDMARK_COUNT, WINDOW_FRAMES, createLandmarkWindow, cropLandmarks } from './landmarkWindow.js';
import { attentionLevelOf } from './attentionModel.js';
import useAttentionModel, { RUN_INTERVAL_MS } from './useAttentionModel.js';

const face = (value) => Array.from({ length: LANDMARK_COUNT }, (_, index) => ({ x: value, y: index / 1000, z: -value }));

/** Pushes `count` frames 100 ms apart (10 fps), starting at `from`; returns the next timestamp. */
function feed(push, count, from = 0, landmarks = (index) => face(index)) {
  let at = from;
  for (let index = 0; index < count; index += 1) {
    push(landmarks(index), at);
    at += 100;
  }
  return at;
}

describe('landmark window', () => {
  it('collects 100 frames at 10 per second, oldest first, as [1, 100, 478, 3]', () => {
    const window = createLandmarkWindow();
    // 15 fps input: only frames at least ~100 ms apart are kept.
    for (let at = 0; at < 2000; at += 66) window.push(face(at), at);
    // Exactly 10 slots per second: 20 slots in 2 s from a ~15 fps camera.
    expect(Math.round(window.progress() * WINDOW_FRAMES)).toBe(20);

    window.reset();
    feed(window.push, WINDOW_FRAMES + 5);
    expect(window.full()).toBe(true);
    const data = window.toTensorData();
    expect(data).toHaveLength(WINDOW_FRAMES * LANDMARK_COUNT * 3);
    // The 5 oldest frames were dropped: the window starts at frame 5.
    expect(data[0]).toBe(5);
    expect(data[(WINDOW_FRAMES - 1) * LANDMARK_COUNT * 3]).toBe(WINDOW_FRAMES + 4);
    expect(data[2]).toBe(-5); // z
  });

  it('keeps a 10-per-second clock when frames arrive slowly (fills ~10 s in ~10 s)', () => {
    const window = createLandmarkWindow();
    // Analysis at ~3 frames per second while the lesson video plays.
    let at = 0;
    while (at <= 9_900) {
      window.push(face(at), at);
      at += 330;
    }
    expect(window.full()).toBe(true);
    // Each slow frame was held for its ~3 slots: frame 0 fills the first slots.
    const data = window.toTensorData();
    const frameSize = LANDMARK_COUNT * 3;
    expect(data[frameSize * 99]).toBeGreaterThan(9000);
    expect(data[frameSize * 98]).toBe(data[frameSize * 97]); // held frame
  });

  it('starts over after the face is missing for more than a second, not after a short gap', () => {
    const window = createLandmarkWindow();
    let at = feed(window.push, 50);
    window.push(null, at);
    window.push(null, at + 500); // short gap (blink, quick turn): kept, and filled by the clock
    at = feed(window.push, 10, at + 600);
    expect(window.progress()).toBeCloseTo(0.66); // 50 + 7 held slots + 9

    window.push(null, at + 1100); // long absence: reset
    expect(window.progress()).toBe(0);
    expect(window.push(face(1).slice(0, 10), at + 1200)).toBe(false); // wrong landmark count is ignored
  });

  it('crops landmarks to a square around the face with a 20% margin', () => {
    // A face 100×80 px at (300..400, 200..280) in a 640×480 frame.
    const points = Array.from({ length: LANDMARK_COUNT }, (_, index) => ({
      x: (300 + (index % 2) * 100) / 640,
      y: (200 + (index % 3 === 0 ? 80 : 0)) / 480,
      z: 0.01,
    }));
    const cropped = cropLandmarks(points, 640, 480);
    const xs = cropped.map((point) => point.x);
    const ys = cropped.map((point) => point.y);
    // Square side = 100 px × 1.4 = 140 px, centred on the face.
    expect(Math.min(...xs)).toBeCloseTo(20 / 140, 5);
    expect(Math.max(...xs)).toBeCloseTo(120 / 140, 5);
    expect(Math.min(...ys)).toBeCloseTo(30 / 140, 5);
    expect(Math.max(...ys)).toBeCloseTo(110 / 140, 5);
    expect(cropped[0].z).toBeCloseTo((0.01 * 640) / 140, 5);
  });

  it('maps scores to the five trained levels', () => {
    expect(attentionLevelOf(0.05).label).toBe('לא נמצא במצלמה');
    expect(attentionLevelOf(0.3).label).toBe('לא קשוב');
    expect(attentionLevelOf(0.5).label).toBe('קשב חלש');
    expect(attentionLevelOf(0.7).label).toBe('קשוב');
    expect(attentionLevelOf(0.95).label).toBe('קשוב מאוד');
  });
});

describe('useAttentionModel', () => {
  async function setup() {
    const score = vi.fn(async (data) => {
      expect(data).toHaveLength(WINDOW_FRAMES * LANDMARK_COUNT * 3);
      return 0.82;
    });
    const release = vi.fn();
    const loader = vi.fn(async () => ({ score, release }));
    const onScore = vi.fn();
    const hook = renderHook(({ active }) => useAttentionModel({ active, onScore, loader }), { initialProps: { active: true } });
    await act(async () => {});
    return { hook, score, release, loader, onScore };
  }

  it('scores only full windows, every 2 seconds, and clears the score without a face', async () => {
    const { hook, score, onScore } = await setup();
    expect(hook.result.current.status).toBe('collecting');

    let at;
    await act(async () => { at = feed(hook.result.current.push, WINDOW_FRAMES - 1); });
    expect(score).not.toHaveBeenCalled();
    expect(hook.result.current.score).toBeNull();

    await act(async () => { at = feed(hook.result.current.push, 1, at); });
    expect(score).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toMatchObject({ status: 'ready', score: 0.82 });
    expect(onScore).toHaveBeenLastCalledWith(0.82);

    await act(async () => { at = feed(hook.result.current.push, RUN_INTERVAL_MS / 100 - 1, at); });
    expect(score).toHaveBeenCalledTimes(1);
    await act(async () => { at = feed(hook.result.current.push, 1, at); });
    expect(score).toHaveBeenCalledTimes(2);

    await act(async () => {
      hook.result.current.push(null, at + 1500); // face gone for 1.5 s
    });
    expect(hook.result.current.score).toBeNull();
    expect(onScore).toHaveBeenLastCalledWith(null);
  });

  it('loads the model only while the camera is on and releases it after', async () => {
    const { hook, loader, release } = await setup();
    expect(loader).toHaveBeenCalledTimes(1);
    hook.rerender({ active: false });
    expect(release).toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ status: 'off', score: null });
  });
});
