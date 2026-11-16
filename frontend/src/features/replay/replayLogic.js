// ReplayAI on the client: Hebrew explanations for stored suggestions and the
// replay-mode controller used by the existing lesson video player.
// Kept free of React and the DOM so it is tested directly.

import { formatClock } from '../learning/learningApi.js';

export const STATUS_LABELS = Object.freeze({
  new: 'ממתין לחזרה',
  reviewed: 'נבדק',
  dismissed: 'הוסתר',
});

const pluralTimes = (count) => (count === 1 ? 'פעם אחת' : `${count} פעמים`);

/** Why an interval was suggested, one line per rule that fired. */
export function reasonLines(item) {
  const reasons = item.reasons || {};
  const lines = [];
  if (reasons.sustained_off_screen) {
    const seconds = Math.round(item.offScreenSeconds || 0);
    lines.push(
      reasons.sustained_off_screen === 1
        ? `המבט הופנה מהמסך ברצף${seconds ? ` (כ-${seconds} שניות)` : ''}.`
        : `המבט הופנה מהמסך ברצף ${pluralTimes(reasons.sustained_off_screen)}${seconds ? ` (כ-${seconds} שניות בסך הכול)` : ''}.`,
    );
  }
  if (reasons.repeated_off_screen) {
    lines.push(`${reasons.repeated_off_screen} הסטות מבט קצרות מהמסך בפרק זמן קצר.`);
  }
  if (reasons.face_absent) {
    const seconds = Math.round(item.faceAbsentSeconds || 0);
    lines.push(`הפנים לא זוהו מול המצלמה${seconds ? ` במשך כ-${seconds} שניות` : ''}.`);
  }
  if (reasons.interruptions) {
    lines.push(`הניגון נעצר ${pluralTimes(reasons.interruptions)} בקטע הזה.`);
  }
  if (item.sessionCount > 1) lines.push(`נמצא ב-${item.sessionCount} מפגשי למידה שונים.`);
  if (item.reopened) lines.push('נוספו אירועים חדשים אחרי שסימנתם את הקטע כנבדק.');
  return lines;
}

export function itemRange(item) {
  return item.endSeconds == null
    ? formatClock(item.startSeconds)
    : `${formatClock(item.startSeconds)}–${formatClock(item.endSeconds)}`;
}

export function itemDuration(item) {
  return item.endSeconds == null ? null : Math.max(0, item.endSeconds - item.startSeconds);
}

export function itemTitle(item) {
  if (item.kind === 'bookmark') return item.endSeconds == null ? 'סימנייה בנקודה' : 'קטע שסימנתם';
  return 'קטע מומלץ לחזרה';
}

// --- replay mode -----------------------------------------------------------------

export const REPLAY_END_TOLERANCE = 0.25;
// Seeking further than this outside the interval leaves replay mode.
export const REPLAY_EXIT_MARGIN = 2;

/**
 * Decides what happens on each `timeupdate` while replaying an interval.
 * @returns {'continue'|'finish'|'exit'}
 */
export function replayStep(item, currentTime) {
  if (!item || item.endSeconds == null) return 'exit';
  if (currentTime < item.startSeconds - REPLAY_EXIT_MARGIN || currentTime > item.endSeconds + REPLAY_EXIT_MARGIN) {
    return 'exit';
  }
  return currentTime >= item.endSeconds - REPLAY_END_TOLERANCE ? 'finish' : 'continue';
}

/** Where a replay starts (a point bookmark replays from a little before it). */
export function replayStart(item) {
  return item.endSeconds == null ? Math.max(0, item.startSeconds - 3) : item.startSeconds;
}

/** A bookmark range created from two clicks, clamped and ordered. */
export function bookmarkRange(start, end, duration) {
  const limit = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  const from = Math.max(0, Math.min(start, end, limit));
  const to = Math.min(Math.max(start, end), limit);
  return to - from >= 1 ? { startSeconds: round(from), endSeconds: round(to) } : { startSeconds: round(from) };
}

const round = (value) => Math.round(value * 100) / 100;
