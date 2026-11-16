// Smart Timer bookkeeping (no React, no DOM).
//
// Clocks, never mixed:
// - active learning time: counted by the existing session timer only while
//   the video plays (or, for YouTube, while the learner runs the timer);
// - break time: counted only while a break the learner started is running;
// - video position: the media's own currentTime.
//
// Study blocks: after `studyMinutes` of active learning since the last break
// the learner gets a gentle reminder. Nothing is paused automatically.

export const DEFAULT_PREFERENCES = Object.freeze({ studyMinutes: 25, breakMinutes: 5, breakReminders: true });

export function createBreakClock(now = () => performance.now()) {
  let totalMs = 0;
  let startedAt = null;
  return {
    start() {
      if (startedAt === null) startedAt = now();
    },
    stop() {
      if (startedAt !== null) {
        totalMs += Math.max(0, now() - startedAt);
        startedAt = null;
      }
    },
    running: () => startedAt !== null,
    /** Total break time, including the running break. */
    totalMs: () => totalMs + (startedAt === null ? 0 : Math.max(0, now() - startedAt)),
    /** Length of the running break (0 when none). */
    currentMs: () => (startedAt === null ? 0 : Math.max(0, now() - startedAt)),
    reset() {
      totalMs = 0;
      startedAt = null;
    },
  };
}

/** Progress of the current study block (since the last break or snooze). */
export function studyBlock(activeMs, blockStartMs, studyMinutes) {
  const targetMs = Math.max(1, studyMinutes) * 60_000;
  const doneMs = Math.max(0, activeMs - blockStartMs);
  return {
    doneMs,
    targetMs,
    percent: Math.min(100, Math.round((100 * doneMs) / targetMs)),
    reached: doneMs >= targetMs,
  };
}

export function shouldRemindBreak({ preferences, activeMs, blockStartMs, onBreak, dismissedAtMs }) {
  if (!preferences?.breakReminders || onBreak) return false;
  if (dismissedAtMs !== null && dismissedAtMs !== undefined && dismissedAtMs >= blockStartMs) return false;
  return studyBlock(activeMs, blockStartMs, preferences.studyMinutes).reached;
}
