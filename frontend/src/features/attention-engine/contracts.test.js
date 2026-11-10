import { describe, expect, it } from 'vitest';
import {
  ATTENTION_REASONS,
  ATTENTION_STATES,
  FATIGUE_INDICATORS,
  isValidAttentionFrame,
} from './contracts.js';

const validFrame = {
  timestamp: 1000,
  state: ATTENTION_STATES.UNCERTAIN,
  confidence: 0.3,
  reason: ATTENTION_REASONS.SIGNALS_DISAGREE,
  fatigueIndicators: [FATIGUE_INDICATORS.YAWN],
};

describe('attention engine contracts', () => {
  it('exposes exactly the four attention states', () => {
    expect(Object.values(ATTENTION_STATES)).toEqual([
      'ON_SCREEN', 'OFF_SCREEN', 'FACE_ABSENT', 'UNCERTAIN',
    ]);
    expect(Object.isFrozen(ATTENTION_STATES)).toBe(true);
  });

  it('accepts a well-formed frame', () => {
    expect(isValidAttentionFrame(validFrame)).toBe(true);
  });

  it.each([
    ['unknown state', { state: 'FOCUSED' }],
    ['confidence above 1', { confidence: 1.2 }],
    ['missing reason', { reason: undefined }],
    ['unknown fatigue indicator', { fatigueIndicators: ['sleepy'] }],
    ['missing timestamp', { timestamp: Number.NaN }],
  ])('rejects a frame with %s', (_, override) => {
    expect(isValidAttentionFrame({ ...validFrame, ...override })).toBe(false);
  });
});
