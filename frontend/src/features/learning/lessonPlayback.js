// Lesson playback bookkeeping, kept free of React and the DOM so it can be
// tested directly.
//
// 1. Attention segments (ReplayAI-ready): while the video plays, every stats
//    tick reports the attention state and the video position. Consecutive
//    ticks with the same state, the same playback rate and continuous video
//    time are merged into one segment. A segment is cut on a state change, a
//    playback-rate change, a seek/jump (video time not where it should be),
//    a pause, and after MAX_SEGMENT_MS. Video time and session time are kept
//    separately: they differ with pauses, seeks, replays and playback rate.
//    Camera off -> NOT_MEASURED (never counted as focused or distracted).
//
// 2. Progress saving policy: throttled while playing, immediate on pause,
//    seek end, ended, leaving the page; never before the video actually played
//    (opening a lesson does not create progress).

export const MAX_SEGMENT_MS = 60_000;
export const MIN_SEGMENT_MS = 250;
export const SEEK_TOLERANCE_SECONDS = 1.5;
export const PROGRESS_SAVE_INTERVAL_MS = 10_000;
export const SEGMENT_FLUSH_INTERVAL_MS = 15_000;
export const RESUME_END_MARGIN_SECONDS = 5;

const MEASURED_STATES = new Set(['ON_SCREEN', 'OFF_SCREEN', 'FACE_ABSENT', 'UNCERTAIN']);

export function segmentStateOf(attentionState) {
  return MEASURED_STATES.has(attentionState) ? attentionState : 'NOT_MEASURED';
}

/**
 * @param {{ sessionStartedAt: number }} options performance.now() of the session start
 */
export function createSegmentRecorder({ sessionStartedAt }) {
  let seq = 0;
  let current = null;
  let last = null; // previous playing sample: { at, videoTime, rate }
  let queue = [];

  function close() {
    if (current && current.durationMs >= MIN_SEGMENT_MS && current.videoEnd >= current.videoStart) {
      const concentrationSamples = current.concentrationCount;
      queue.push({
        seq: seq++,
        sessionStartMs: Math.round(current.sessionStartMs),
        sessionEndMs: Math.round(current.sessionEndMs),
        videoStart: Math.round(current.videoStart * 1000) / 1000,
        videoEnd: Math.round(current.videoEnd * 1000) / 1000,
        playbackRate: current.rate,
        state: current.state,
        durationMs: Math.round(current.durationMs),
        ...(concentrationSamples
          ? { concentration: Math.round(current.concentrationSum / concentrationSamples) }
          : {}),
      });
    }
    current = null;
  }

  return {
    /**
     * One stats tick while the video plays.
     * @param {{ at: number, videoTime: number, rate: number, state: string|null, concentration?: number|null }} sample
     */
    sample({ at, videoTime, rate, state, concentration = null }) {
      const segmentState = segmentStateOf(state);
      if (!last) {
        last = { at, videoTime, rate };
        return;
      }
      const elapsedMs = Math.max(0, at - last.at);
      const expected = last.videoTime + (elapsedMs / 1000) * last.rate;
      const jumped = Math.abs(videoTime - expected) > SEEK_TOLERANCE_SECONDS || videoTime < last.videoTime - 0.05;
      if (jumped) {
        close();
        last = { at, videoTime, rate };
        return;
      }
      if (current && (current.state !== segmentState || current.rate !== last.rate || current.durationMs >= MAX_SEGMENT_MS)) {
        close();
      }
      if (!current) {
        current = {
          state: segmentState,
          rate: last.rate,
          sessionStartMs: last.at - sessionStartedAt,
          sessionEndMs: last.at - sessionStartedAt,
          videoStart: last.videoTime,
          videoEnd: last.videoTime,
          durationMs: 0,
          concentrationSum: 0,
          concentrationCount: 0,
        };
      }
      current.sessionEndMs = at - sessionStartedAt;
      current.videoEnd = Math.max(current.videoEnd, videoTime);
      current.durationMs += elapsedMs;
      if (Number.isFinite(concentration)) {
        current.concentrationSum += concentration;
        current.concentrationCount += 1;
      }
      last = { at, videoTime, rate };
    },
    /** Pause, buffering, seek start or end: the next sample starts fresh. */
    interrupt() {
      close();
      last = null;
    },
    /** Takes the segments ready to send. */
    drain() {
      const ready = queue;
      queue = [];
      return ready;
    },
    /** Puts segments back after a failed send (kept in order, bounded). */
    restore(segments) {
      queue = [...segments, ...queue].slice(-1000);
    },
    pendingCount() {
      return queue.length + (current ? 1 : 0);
    },
  };
}

/** Where to resume: the saved position, unless it is (almost) the end. */
export function resumePosition(progress, duration) {
  const position = progress?.positionSeconds || 0;
  if (position <= 1) return 0;
  if (Number.isFinite(duration) && duration > 0 && position >= duration - RESUME_END_MARGIN_SECONDS) return 0;
  return position;
}

/** Throttle for periodic saves while playing. */
export function shouldSaveWhilePlaying({ now, lastSavedAt, position, lastSavedPosition }) {
  return now - lastSavedAt >= PROGRESS_SAVE_INTERVAL_MS && Math.abs(position - lastSavedPosition) >= 1;
}
