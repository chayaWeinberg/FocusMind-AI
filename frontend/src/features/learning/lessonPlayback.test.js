import { describe, expect, it } from 'vitest';
import {
  MAX_SEGMENT_MS,
  createSegmentRecorder,
  resumePosition,
  segmentStateOf,
  shouldSaveWhilePlaying,
} from './lessonPlayback.js';

/** Plays from `video` for `ms` at `rate`, sampling every 500 ms. */
function play(recorder, clock, { from, ms, rate = 1, state = 'ON_SCREEN', concentration = null }) {
  let video = from;
  for (let elapsed = 0; elapsed <= ms; elapsed += 500) {
    recorder.sample({ at: clock.now, videoTime: video, rate, state, concentration });
    clock.now += 500;
    video += 0.5 * rate;
  }
  clock.now -= 500;
  return video - 0.5 * rate;
}

describe('attention segment recorder (ReplayAI data)', () => {
  it('merges continuous playback with one state into one segment, keeping video and session time apart', () => {
    const clock = { now: 10_000 };
    const recorder = createSegmentRecorder({ sessionStartedAt: 5_000 });
    play(recorder, clock, { from: 30, ms: 4000, concentration: 80 });
    recorder.interrupt();
    expect(recorder.drain()).toEqual([{
      seq: 0, sessionStartMs: 5000, sessionEndMs: 9000, videoStart: 30, videoEnd: 34,
      playbackRate: 1, state: 'ON_SCREEN', durationMs: 4000, concentration: 80,
    }]);
  });

  it('cuts segments on state changes, seeks, rate changes and pauses', () => {
    const clock = { now: 0 };
    const recorder = createSegmentRecorder({ sessionStartedAt: 0 });
    let video = play(recorder, clock, { from: 0, ms: 2000 });
    clock.now += 500;
    video = play(recorder, clock, { from: video + 0.5, ms: 1500, state: 'OFF_SCREEN' });
    // Seek back to 1 s (replay) and keep watching at 1.5x.
    clock.now += 500;
    play(recorder, clock, { from: 1, ms: 2000, rate: 1.5, state: 'ON_SCREEN' });
    recorder.interrupt(); // pause
    clock.now += 10_000;
    play(recorder, clock, { from: 4, ms: 1000, state: null }); // camera off
    recorder.interrupt();

    const segments = recorder.drain();
    expect(segments.map((s) => [s.state, s.videoStart, s.videoEnd, s.playbackRate])).toEqual([
      // Each tick's interval belongs to the state observed at that tick.
      ['ON_SCREEN', 0, 2, 1],
      ['OFF_SCREEN', 2, 4, 1],
      ['ON_SCREEN', 1, 4, 1.5],
      ['NOT_MEASURED', 4, 5, 1],
    ]);
    expect(segments.map((s) => s.seq)).toEqual([0, 1, 2, 3]);
    // Session time keeps running across the pause; video time does not.
    expect(segments[3].sessionStartMs - segments[2].sessionEndMs).toBeGreaterThanOrEqual(10_000);
    segments.forEach((segment) => expect(segment.videoEnd).toBeGreaterThanOrEqual(segment.videoStart));
  });

  it('never invents a segment across a jump and limits segment length', () => {
    const clock = { now: 0 };
    const recorder = createSegmentRecorder({ sessionStartedAt: 0 });
    recorder.sample({ at: 0, videoTime: 0, rate: 1, state: 'ON_SCREEN' });
    recorder.sample({ at: 500, videoTime: 90, rate: 1, state: 'ON_SCREEN' }); // jumped
    expect(recorder.drain()).toEqual([]);

    clock.now = 1000;
    play(recorder, clock, { from: 90, ms: MAX_SEGMENT_MS + 5000 });
    recorder.interrupt();
    const segments = recorder.drain();
    expect(segments.length).toBe(2);
    expect(segments[0].durationMs).toBeLessThanOrEqual(MAX_SEGMENT_MS + 500);
  });

  it('restores segments after a failed upload, in order', () => {
    const clock = { now: 0 };
    const recorder = createSegmentRecorder({ sessionStartedAt: 0 });
    play(recorder, clock, { from: 0, ms: 1000 });
    recorder.interrupt();
    const failed = recorder.drain();
    recorder.restore(failed);
    expect(recorder.drain()).toEqual(failed);
  });

  it('maps unknown and missing states to NOT_MEASURED', () => {
    expect(segmentStateOf(null)).toBe('NOT_MEASURED');
    expect(segmentStateOf('FACE_ABSENT')).toBe('FACE_ABSENT');
  });
});

describe('resume and save policy', () => {
  it('resumes from the saved position unless it is at the very start or end', () => {
    expect(resumePosition(null, 100)).toBe(0);
    expect(resumePosition({ positionSeconds: 0.5 }, 100)).toBe(0);
    expect(resumePosition({ positionSeconds: 42 }, 100)).toBe(42);
    expect(resumePosition({ positionSeconds: 97 }, 100)).toBe(0);
  });

  it('throttles saves while playing', () => {
    expect(shouldSaveWhilePlaying({ now: 5000, lastSavedAt: 0, position: 5, lastSavedPosition: 0 })).toBe(false);
    expect(shouldSaveWhilePlaying({ now: 10_000, lastSavedAt: 0, position: 10, lastSavedPosition: 0 })).toBe(true);
    expect(shouldSaveWhilePlaying({ now: 10_000, lastSavedAt: 0, position: 0.5, lastSavedPosition: 0 })).toBe(false);
  });
});
