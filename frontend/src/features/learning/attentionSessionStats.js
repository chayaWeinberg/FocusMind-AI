// Session statistics for the attention monitor.
//
// Time is attributed to the smoothed engine state while the learning session
// timer runs. Time without a working camera is "not measured". Uncertain time
// stays uncertain: it is never counted as attention or as distraction.
// The estimated concentration score is averaged over the time it was available.

import { ATTENTION_STATES as S } from '../attention-engine/contracts.js';

export const MEASURED_STATES = Object.freeze([S.ON_SCREEN, S.OFF_SCREEN, S.FACE_ABSENT, S.UNCERTAIN]);
export const NOT_MEASURED = 'NOT_MEASURED';
export const TIMELINE_SLOT_MS = 5000;
const MAXIMUM_TIMELINE_SLOTS = 720; // one hour

function emptyTotals() {
  return Object.fromEntries([...MEASURED_STATES, NOT_MEASURED].map((state) => [state, 0]));
}

export function createAttentionSessionStats() {
  let totals = emptyTotals();
  let awayEpisodes = 0;
  let longestOnScreenMs = 0;
  let currentOnScreenMs = 0;
  let previousState = null;
  let timeline = [];
  let slot = { totals: emptyTotals(), elapsed: 0 };
  let concentrationSum = 0;
  let concentrationMs = 0;

  function closeSlot() {
    const dominant = Object.entries(slot.totals).reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
    timeline.push(dominant);
    if (timeline.length > MAXIMUM_TIMELINE_SLOTS) timeline = timeline.slice(-MAXIMUM_TIMELINE_SLOTS);
    slot = { totals: emptyTotals(), elapsed: 0 };
  }

  return {
    reset() {
      totals = emptyTotals();
      awayEpisodes = 0;
      longestOnScreenMs = 0;
      currentOnScreenMs = 0;
      previousState = null;
      timeline = [];
      slot = { totals: emptyTotals(), elapsed: 0 };
      concentrationSum = 0;
      concentrationMs = 0;
    },
    /**
     * Attributes `durationMs` of running session time to a state.
     * @param {string|null} state engine state, or null when the camera is off
     * @param {number|null} [concentration] estimated concentration 0-100, null when unavailable
     */
    add(state, durationMs, concentration = null) {
      if (!(durationMs > 0)) return;
      if (Number.isFinite(concentration)) {
        concentrationSum += concentration * durationMs;
        concentrationMs += durationMs;
      }
      const key = state && MEASURED_STATES.includes(state) ? state : NOT_MEASURED;
      totals[key] += durationMs;

      if (key === S.ON_SCREEN) {
        currentOnScreenMs += durationMs;
        longestOnScreenMs = Math.max(longestOnScreenMs, currentOnScreenMs);
      } else if (key !== S.UNCERTAIN) {
        // Short uncertain moments do not break a streak; other states do.
        currentOnScreenMs = 0;
      }
      if (key === S.OFF_SCREEN && previousState !== S.OFF_SCREEN) awayEpisodes += 1;
      if (key !== S.UNCERTAIN) previousState = key;

      let remaining = durationMs;
      while (remaining > 0) {
        const take = Math.min(remaining, TIMELINE_SLOT_MS - slot.elapsed);
        slot.totals[key] += take;
        slot.elapsed += take;
        remaining -= take;
        if (slot.elapsed >= TIMELINE_SLOT_MS) closeSlot();
      }
    },
    snapshot() {
      const totalMs = Object.values(totals).reduce((sum, value) => sum + value, 0);
      const measuredMs = totalMs - totals[NOT_MEASURED];
      const share = (value) => (totalMs > 0 ? value / totalMs : 0);
      return {
        totalMs,
        measuredMs,
        byState: { ...totals },
        shares: Object.fromEntries(Object.entries(totals).map(([state, value]) => [state, share(value)])),
        awayEpisodes,
        longestOnScreenMs,
        averageConcentration: concentrationMs > 0 ? Math.round(concentrationSum / concentrationMs) : null,
        concentrationMs,
        timeline: [...timeline],
      };
    },
  };
}
