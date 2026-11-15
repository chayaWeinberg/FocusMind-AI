import { describe, expect, it } from 'vitest';
import { ATTENTION_STATES as S } from '../attention-engine/contracts.js';
import { NOT_MEASURED, TIMELINE_SLOT_MS, createAttentionSessionStats } from './attentionSessionStats.js';

describe('attention session statistics', () => {
  it('attributes time per state and computes shares of the session', () => {
    const stats = createAttentionSessionStats();
    stats.add(S.ON_SCREEN, 30_000);
    stats.add(S.OFF_SCREEN, 10_000);
    stats.add(S.UNCERTAIN, 5_000);
    stats.add(null, 5_000);
    const snapshot = stats.snapshot();

    expect(snapshot.totalMs).toBe(50_000);
    expect(snapshot.measuredMs).toBe(45_000);
    expect(snapshot.byState[S.ON_SCREEN]).toBe(30_000);
    expect(snapshot.byState[NOT_MEASURED]).toBe(5_000);
    expect(snapshot.shares[S.ON_SCREEN]).toBeCloseTo(0.6);
    expect(snapshot.shares[S.UNCERTAIN]).toBeCloseTo(0.1);
  });

  it('counts away episodes and the longest on-screen streak; brief uncertainty does not break a streak', () => {
    const stats = createAttentionSessionStats();
    stats.add(S.ON_SCREEN, 10_000);
    stats.add(S.UNCERTAIN, 1_000);
    stats.add(S.ON_SCREEN, 5_000);
    stats.add(S.OFF_SCREEN, 3_000);
    stats.add(S.OFF_SCREEN, 2_000);
    stats.add(S.ON_SCREEN, 4_000);
    stats.add(S.OFF_SCREEN, 1_000);

    const snapshot = stats.snapshot();
    expect(snapshot.awayEpisodes).toBe(2);
    expect(snapshot.longestOnScreenMs).toBe(15_000);
  });

  it('builds a timeline of dominant states per 5-second slot', () => {
    const stats = createAttentionSessionStats();
    stats.add(S.ON_SCREEN, 4_000);
    stats.add(S.OFF_SCREEN, 1_000);
    stats.add(S.FACE_ABSENT, 2 * TIMELINE_SLOT_MS);
    stats.add(null, 2_000); // open slot, not yet in the timeline

    expect(stats.snapshot().timeline).toEqual([S.ON_SCREEN, S.FACE_ABSENT, S.FACE_ABSENT]);
  });

  it('averages the estimated concentration over the time it was available', () => {
    const stats = createAttentionSessionStats();
    expect(stats.snapshot().averageConcentration).toBeNull();
    stats.add(S.ON_SCREEN, 30_000, 90);
    stats.add(S.OFF_SCREEN, 10_000, 30);
    stats.add(null, 10_000, null); // camera off: not part of the average
    expect(stats.snapshot()).toMatchObject({ averageConcentration: 75, concentrationMs: 40_000 });
    stats.reset();
    expect(stats.snapshot().averageConcentration).toBeNull();
  });

  it('ignores non-positive durations and resets completely', () => {
    const stats = createAttentionSessionStats();
    stats.add(S.ON_SCREEN, 0);
    stats.add(S.ON_SCREEN, -5);
    expect(stats.snapshot().totalMs).toBe(0);
    stats.add(S.OFF_SCREEN, 6_000);
    stats.reset();
    expect(stats.snapshot()).toMatchObject({ totalMs: 0, awayEpisodes: 0, timeline: [] });
  });
});
