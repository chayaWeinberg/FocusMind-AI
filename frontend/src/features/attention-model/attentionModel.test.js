import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LANDMARK_COUNT, WINDOW_FRAMES, createLandmarkWindow } from './landmarkWindow.js';
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
    // ~10 per second (16 frames in 2 s; a ~15 fps camera never yields more than one per 90 ms).
    expect(window.progress() * WINDOW_FRAMES).toBeGreaterThanOrEqual(15);
    expect(window.progress() * WINDOW_FRAMES).toBeLessThanOrEqual(17);

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

  it('starts over after the face is missing for more than a second, not after a short gap', () => {
    const window = createLandmarkWindow();
    let at = feed(window.push, 50);
    window.push(null, at);
    window.push(null, at + 500); // short gap (blink, quick turn): kept
    at = feed(window.push, 10, at + 600);
    expect(window.progress()).toBeCloseTo(0.6);

    window.push(null, at + 1100); // long absence: reset
    expect(window.progress()).toBe(0);
    expect(window.push(face(1).slice(0, 10), at + 1200)).toBe(false); // wrong landmark count is ignored
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
