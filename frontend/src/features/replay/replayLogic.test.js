import { describe, expect, it } from 'vitest';
import { bookmarkRange, itemRange, reasonLines, replayStart, replayStep } from './replayLogic.js';
import { createBreakClock, shouldRemindBreak, studyBlock } from '../learning/smartTimer.js';

describe('ReplayAI explanations', () => {
  it('explains every rule that fired, without claiming concentration', () => {
    const lines = reasonLines({
      reasons: { sustained_off_screen: 1, repeated_off_screen: 3, face_absent: 1, interruptions: 4 },
      offScreenSeconds: 6.2, faceAbsentSeconds: 9, sessionCount: 2, reopened: true,
    });
    expect(lines).toEqual([
      'המבט הופנה מהמסך ברצף (כ-6 שניות).',
      '3 הסטות מבט קצרות מהמסך בפרק זמן קצר.',
      'הפנים לא זוהו מול המצלמה במשך כ-9 שניות.',
      'הניגון נעצר 4 פעמים בקטע הזה.',
      'נמצא ב-2 מפגשי למידה שונים.',
      'נוספו אירועים חדשים אחרי שסימנתם את הקטע כנבדק.',
    ]);
    expect(lines.join(' ')).not.toMatch(/ריכוז/);
  });

  it('formats intervals and point bookmarks', () => {
    expect(itemRange({ startSeconds: 65, endSeconds: 90 })).toBe('1:05–1:30');
    expect(itemRange({ startSeconds: 3725, endSeconds: null })).toBe('1:02:05');
  });
});

describe('replay mode', () => {
  const item = { startSeconds: 30, endSeconds: 45 };

  it('continues inside the interval and finishes at its end', () => {
    expect(replayStep(item, 30)).toBe('continue');
    expect(replayStep(item, 44.5)).toBe('continue');
    expect(replayStep(item, 44.8)).toBe('finish');
    expect(replayStep(item, 46)).toBe('finish');
  });

  it('leaves replay mode when the learner seeks elsewhere', () => {
    expect(replayStep(item, 10)).toBe('exit');
    expect(replayStep(item, 80)).toBe('exit');
    expect(replayStep({ startSeconds: 30, endSeconds: null }, 30)).toBe('exit');
  });

  it('replays point bookmarks from a little before the point', () => {
    expect(replayStart(item)).toBe(30);
    expect(replayStart({ startSeconds: 10, endSeconds: null })).toBe(7);
    expect(replayStart({ startSeconds: 1, endSeconds: null })).toBe(0);
  });

  it('orders and clamps manual ranges, and keeps tiny ranges as points', () => {
    expect(bookmarkRange(50, 20, 40)).toEqual({ startSeconds: 20, endSeconds: 40 });
    expect(bookmarkRange(12.345, 12.6, 100)).toEqual({ startSeconds: 12.35 });
  });
});

describe('Smart Timer', () => {
  it('counts break time only while a break runs', () => {
    let now = 0;
    const clock = createBreakClock(() => now);
    clock.start();
    now = 60_000;
    expect(clock.currentMs()).toBe(60_000);
    clock.stop();
    now = 120_000;
    expect(clock.totalMs()).toBe(60_000);
    clock.start();
    now = 150_000;
    expect(clock.totalMs()).toBe(90_000);
    clock.reset();
    expect(clock.totalMs()).toBe(0);
  });

  it('reminds gently after a study block, never during a break or when disabled', () => {
    const preferences = { studyMinutes: 25, breakMinutes: 5, breakReminders: true };
    expect(studyBlock(10 * 60_000, 0, 25).percent).toBe(40);
    expect(shouldRemindBreak({ preferences, activeMs: 24 * 60_000, blockStartMs: 0, onBreak: false })).toBe(false);
    expect(shouldRemindBreak({ preferences, activeMs: 25 * 60_000, blockStartMs: 0, onBreak: false })).toBe(true);
    expect(shouldRemindBreak({ preferences, activeMs: 25 * 60_000, blockStartMs: 0, onBreak: true })).toBe(false);
    expect(shouldRemindBreak({ preferences: { ...preferences, breakReminders: false }, activeMs: 99 * 60_000, blockStartMs: 0, onBreak: false })).toBe(false);
    // After a break (or "continue learning") a new block starts.
    expect(shouldRemindBreak({ preferences, activeMs: 30 * 60_000, blockStartMs: 25 * 60_000, onBreak: false })).toBe(false);
  });
});
