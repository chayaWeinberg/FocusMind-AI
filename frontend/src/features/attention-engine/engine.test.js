import { describe, expect, it } from 'vitest';
import { GAZE_MODEL, combinedGaze, eyesClosed, extractSignals } from './signals.js';
import { createAdaptiveBaseline } from './baseline.js';
import { fuseSignals } from './fusion.js';
import { createTemporalSmoother } from './temporal.js';
import { createFatigueMonitor } from './fatigue.js';
import { createAttentionEngine } from './engine.js';
import { CONCENTRATION_FACTORS, CONCENTRATION_LEVELS, createConcentrationEstimator } from './concentration.js';
import { ATTENTION_REASONS as R, ATTENTION_STATES as S, FATIGUE_INDICATORS, isValidAttentionFrame } from './contracts.js';
import { FRAME, NO_FACE, seededRandom, simulatedUser, syntheticResult } from './testing/syntheticFace.js';

const FRAME_MS = 66;

/** Simulates normal studying: gaze wandering over the screen. */
function studyOnScreen(user, consume, { from = 0, duration = 4000, seed = 2 } = {}) {
  const random = seededRandom(seed);
  let time = from;
  for (; time < from + duration; time += FRAME_MS) {
    consume(user.lookAt(0.15 + random() * 0.7, 0.15 + random() * 0.7), time);
  }
  return time;
}

/** A baseline learned passively from a short on-screen period. */
function learnedBaseline(user) {
  const baseline = createAdaptiveBaseline();
  studyOnScreen(user, (result, time) => {
    const signals = extractSignals(result, FRAME);
    baseline.observe(signals, time, fuseSignals(signals, baseline.getBaseline()));
  });
  return baseline;
}

describe('signals', () => {
  it('recovers head pose and iris offset, compensating head roll', () => {
    const signals = extractSignals(syntheticResult({
      yaw: 12, pitch: -8, roll: 15, irisH: 0.4, irisV: -0.2,
    }), FRAME);
    expect(signals.faceDetected).toBe(true);
    expect(signals.head.yaw).toBeCloseTo(12, 3);
    expect(signals.head.pitch).toBeCloseTo(-8, 3);
    expect(signals.head.roll).toBeCloseTo(15, 3);
    expect(signals.eyes.valid).toBe(true);
    expect(signals.eyes.horizontal).toBeCloseTo(0.4, 3);
    expect(signals.eyes.vertical).toBeCloseTo(-0.2, 3);
    expect(signals.quality.face).toBe(1);
    expect(signals.head.translation).toEqual({ x: 0, y: 0, z: -50 });
  });

  it('marks closed eyes as not measurable and reports them as closed', () => {
    const signals = extractSignals(syntheticResult({ eyeAspect: 0.05, blink: 0.9 }), FRAME);
    expect(signals.eyes.valid).toBe(false);
    expect(signals.eyes.reason).toBe('eyes-closed');
    expect(eyesClosed(signals)).toBe(true);
  });

  it('lowers quality for a small face or a face at the frame edge', () => {
    expect(extractSignals(syntheticResult({ faceWidth: 0.07 }), FRAME).quality.face).toBeLessThan(0.3);
    expect(extractSignals(syntheticResult({ center: { x: 0.12, y: 0.5 } }), FRAME).quality.face).toBeLessThan(0.5);
  });

  it('combines head and eyes with matching signs', () => {
    const gaze = combinedGaze(extractSignals(syntheticResult({ yaw: 10, pitch: 5, irisH: 0.1, irisV: 0.05 }), FRAME));
    expect(gaze.horizontal).toBeCloseTo(GAZE_MODEL.headWeight * 10 + GAZE_MODEL.eyeDegreesPerUnit * 0.1, 3);
    expect(gaze.vertical).toBeCloseTo(GAZE_MODEL.headWeight * 5 + GAZE_MODEL.eyeDegreesPerUnit * 0.05, 3);
  });

  it('does not mistake looking down (lowered lids) for closed eyes', () => {
    expect(eyesClosed(extractSignals(syntheticResult({ blink: 0.6, lookDown: 0.7 }), FRAME))).toBe(false);
    expect(eyesClosed(extractSignals(syntheticResult({ blink: 0.6 }), FRAME))).toBe(true);
    expect(eyesClosed(extractSignals(syntheticResult({ blink: 0.9, lookDown: 0.7 }), FRAME))).toBe(true);
  });

  it('handles a frame without a face', () => {
    const signals = extractSignals(NO_FACE, FRAME);
    expect(signals.faceDetected).toBe(false);
    expect(eyesClosed(signals)).toBeNull();
  });
});

describe('adaptive baseline (no calibration)', () => {
  it('learns the screen-facing pose within a few seconds of normal studying', () => {
    const user = simulatedUser({ pitchOffset: -12 }); // camera above the screen
    const baseline = learnedBaseline(user).getBaseline();
    expect(baseline).not.toBeNull();
    expect(baseline.pitch).toBeCloseTo(-12, 0);
    expect(baseline.yaw).toBeCloseTo(0, 0);
    expect(Math.abs(baseline.gazeH)).toBeLessThan(1);
    expect(Math.abs(baseline.gazeV - GAZE_MODEL.headWeight * -12)).toBeLessThan(1.5);
  });

  it('absorbs a camera placed beside the screen', () => {
    const sideCamera = simulatedUser({ yawOffset: 25 });
    const baseline = learnedBaseline(sideCamera);
    expect(baseline.getBaseline().yaw).toBeCloseTo(25, 0);
    const raw = fuseSignals(extractSignals(sideCamera.lookAt(0.5, 0.5), FRAME), baseline.getBaseline());
    expect(raw.state).toBe(S.ON_SCREEN);
  });

  it('ignores frames where the user does not face the camera during warm-up', () => {
    const baseline = createAdaptiveBaseline();
    for (let time = 0; time < 5000; time += FRAME_MS) {
      baseline.observe(extractSignals(syntheticResult({ yaw: 60 }), FRAME), time);
    }
    expect(baseline.getBaseline()).toBeNull();
    expect(baseline.getStatus(5000).ready).toBe(false);
  });

  it('does not move the baseline while the user looks away', () => {
    const user = simulatedUser();
    const baseline = learnedBaseline(user);
    const before = baseline.getBaseline().yaw;
    for (let time = 5000; time < 15000; time += FRAME_MS) {
      const signals = extractSignals(user.lookAt(2.2, 0.5), FRAME);
      baseline.observe(signals, time, fuseSignals(signals, baseline.getBaseline()));
    }
    expect(baseline.getBaseline().yaw).toBeCloseTo(before, 5);
  });

  it('re-learns automatically after a clear posture change', () => {
    const user = simulatedUser();
    const baseline = learnedBaseline(user);
    let outcome;
    for (let time = 5000; time < 8000; time += FRAME_MS) {
      const signals = extractSignals(user.lookAt(0.5, 0.5, { translation: { x: 0, y: 0, z: -85 } }), FRAME);
      outcome = baseline.observe(signals, time, fuseSignals(signals, baseline.getBaseline()));
      if (outcome === 'posture-changed') break;
    }
    expect(outcome).toBe('posture-changed');
    expect(baseline.getBaseline()).toBeNull();
  });
});

describe('fusion', () => {
  const user = simulatedUser();
  const baseline = learnedBaseline(user).getBaseline();
  const fuse = (result) => fuseSignals(extractSignals(result, FRAME), baseline);

  it.each([[0.5, 0.5], [0.1, 0.15], [0.9, 0.85]])('detects looking at the screen at (%s, %s)', (x, y) => {
    const raw = fuse(user.lookAt(x, y));
    expect(raw.state).toBe(S.ON_SCREEN);
    expect(raw.modelUsed).toBe('head+eyes');
    expect(raw.confidence).toBeGreaterThan(0.6);
  });

  it.each([[1.9, 0.5], [-0.9, 0.5], [0.5, 2.2]])('detects looking away at (%s, %s)', (x, y) => {
    expect(fuse(user.lookAt(x, y)).state).toBe(S.OFF_SCREEN);
  });

  it('detects an eyes-only glance away with a still head', () => {
    const raw = fuse(user.lookAt(0.5, 0.5, { irisH: 0.6 }));
    expect(raw).toMatchObject({ state: S.OFF_SCREEN, reason: R.GAZE_OFF_SCREEN });
  });

  it('treats a strongly turned head as looking away', () => {
    expect(fuse(syntheticResult({ yaw: 50, pitch: -6 }))).toMatchObject({ state: S.OFF_SCREEN, reason: R.HEAD_TURNED_AWAY });
  });

  it('reports a missing face', () => {
    expect(fuse(NO_FACE)).toMatchObject({ state: S.FACE_ABSENT, reason: R.NO_FACE });
  });

  it('uses the head only, with capped confidence, when the eyes are closed', () => {
    const raw = fuse(user.lookAt(0.5, 0.5, { eyeAspect: 0.05, blink: 1 }));
    expect(raw.modelUsed).toBe('head');
    expect(raw.state).toBe(S.ON_SCREEN);
    expect(raw.confidence).toBeLessThanOrEqual(0.75);
  });

  /** A face whose combined gaze is (h, v) degrees from the baseline, with the head at baseline + headTurn. */
  function gazeOffsetBy(h, v, headTurn = 0) {
    const yaw = baseline.yaw + headTurn;
    const { pitch } = baseline;
    const { eyeDegreesPerUnit, headWeight } = GAZE_MODEL;
    return syntheticResult({
      yaw,
      pitch,
      irisH: (baseline.gazeH + h - headWeight * yaw) / eyeDegreesPerUnit,
      irisV: (baseline.gazeV + v - headWeight * pitch) / eyeDegreesPerUnit,
    });
  }

  it('combines head and eyes: a natural glance away is caught although the head alone stays small', () => {
    const signals = extractSignals(user.lookAt(1.6, 0.5), FRAME);
    expect(Math.abs(signals.head.yaw - baseline.yaw)).toBeLessThan(baseline.tolerances.yaw);
    expect(fuseSignals(signals, baseline).state).toBe(S.OFF_SCREEN);
  });

  it('stays on screen when the head turns but the eyes keep looking at the screen', () => {
    const raw = fuse(gazeOffsetBy(0, 0, 20));
    expect(raw.state).toBe(S.ON_SCREEN);
    expect(Math.abs(raw.offset.horizontal)).toBeLessThan(1);
  });

  it('reports the gaze offset and tolerance in degrees', () => {
    const raw = fuse(gazeOffsetBy(10, -5));
    expect(raw.offset.horizontal).toBeCloseTo(10, 0);
    expect(raw.offset.vertical).toBeCloseTo(-5, 0);
    expect(raw.tolerance.horizontal).toBeGreaterThanOrEqual(22);
  });

  it('is uncertain, not distracted, exactly at the tolerance', () => {
    const raw = fuse(gazeOffsetBy(baseline.tolerances.gazeH, 0));
    expect(raw.state).toBe(S.UNCERTAIN);
    expect(raw.onScreenProbability).toBeCloseTo(0.5, 1);
  });

  it('is uncertain while adapting and when the face is poorly visible', () => {
    expect(fuseSignals(extractSignals(user.lookAt(0.5, 0.5), FRAME), null)).toMatchObject({ state: S.UNCERTAIN, reason: R.ADAPTING });
    expect(fuse(syntheticResult({ faceWidth: 0.06 }))).toMatchObject({ state: S.UNCERTAIN, reason: R.LOW_LANDMARK_QUALITY });
  });
});

describe('temporal smoothing', () => {
  const on = { state: S.ON_SCREEN, confidence: 0.9, reason: R.GAZE_ON_SCREEN };
  const off = { state: S.OFF_SCREEN, confidence: 0.9, reason: R.GAZE_OFF_SCREEN };

  it('ignores a single contradicting frame', () => {
    const smoother = createTemporalSmoother();
    let time = 0;
    for (; time < 2000; time += FRAME_MS) smoother.add(on, time);
    expect(smoother.add(off, time).state).toBe(S.ON_SCREEN);
    expect(smoother.add(on, time + FRAME_MS).state).toBe(S.ON_SCREEN);
  });

  it('switches after a sustained change, within about one second', () => {
    const smoother = createTemporalSmoother();
    let time = 0;
    for (; time < 2000; time += FRAME_MS) smoother.add(on, time);
    const changeAt = time;
    let switchedAt = null;
    for (; time < changeAt + 3000; time += FRAME_MS) {
      if (smoother.add(off, time).state === S.OFF_SCREEN && switchedAt === null) switchedAt = time;
    }
    expect(switchedAt - changeAt).toBeGreaterThanOrEqual(600);
    expect(switchedAt - changeAt).toBeLessThan(1300);
  });

  it('reports confidence from the supporting evidence', () => {
    const smoother = createTemporalSmoother();
    let snapshot;
    for (let time = 0; time < 3000; time += FRAME_MS) snapshot = smoother.add({ ...on, confidence: 0.7 }, time);
    expect(snapshot.confidence).toBeCloseTo(0.7, 1);
  });
});

describe('fatigue indicators', () => {
  it('counts short blinks and flags a high blink rate after enough observation', () => {
    const monitor = createFatigueMonitor();
    let summary;
    for (let time = 0; time <= 30_000; time += 50) {
      const blinking = time % 1500 < 150; // 40 blinks per minute
      summary = monitor.update(extractSignals(syntheticResult({ blink: blinking ? 0.9 : 0 }), FRAME), time);
    }
    expect(summary.blinkRatePerMinute).toBeGreaterThan(30);
    expect(summary.indicators).toContain(FATIGUE_INDICATORS.BLINK_RATE_HIGH);
  });

  it('flags a long eye closure and a yawn', () => {
    const monitor = createFatigueMonitor();
    let summary;
    for (let time = 0; time <= 2000; time += 50) {
      summary = monitor.update(extractSignals(syntheticResult({ blink: 0.95, jawOpen: 0.8 }), FRAME), time);
    }
    expect(summary.indicators).toEqual(expect.arrayContaining([
      FATIGUE_INDICATORS.LONG_EYE_CLOSURE,
      FATIGUE_INDICATORS.YAWN,
    ]));
  });

  it('counts each long eye closure once', () => {
    const monitor = createFatigueMonitor();
    let summary;
    for (let time = 0; time <= 12_000; time += 50) {
      const closed = time % 6000 < 2500; // two closures of 2.5 s
      summary = monitor.update(extractSignals(syntheticResult({ blink: closed ? 0.95 : 0 }), FRAME), time);
    }
    expect(summary.longClosuresInWindow).toBe(2);
  });

  it('does not report a blink rate before 20 seconds of observation', () => {
    const monitor = createFatigueMonitor();
    const summary = monitor.update(extractSignals(syntheticResult(), FRAME), 0);
    expect(summary.blinkRatePerMinute).toBeNull();
    expect(summary.indicators).toEqual([]);
  });
});

describe('concentration estimate', () => {
  const alert = { eyesClosed: false, eyesClosedMs: 0, indicators: [], yawnsInWindow: 0, longClosuresInWindow: 0, blinkRatePerMinute: 15 };

  function feed(estimator, { state = S.ON_SCREEN, fatigue = alert, from = 0, duration = 10_000 } = {}) {
    let estimate;
    for (let time = from; time < from + duration; time += FRAME_MS) {
      estimate = estimator.update({ state, fatigue }, time);
    }
    return estimate;
  }

  it('waits for enough measured time, then reports a high score for steady on-screen gaze', () => {
    const estimator = createConcentrationEstimator();
    expect(feed(estimator, { duration: 3000 })).toMatchObject({ ready: false, score: null });
    const estimate = feed(estimator, { from: 3000, duration: 7000 });
    expect(estimate).toMatchObject({ ready: true, score: 100, level: CONCENTRATION_LEVELS.HIGH, factors: [] });
  });

  it('drops when the user looks away, and recovers after looking back', () => {
    const estimator = createConcentrationEstimator();
    feed(estimator, { duration: 20_000 });
    const away = feed(estimator, { state: S.OFF_SCREEN, from: 20_000, duration: 10_000 });
    expect(away.score).toBeLessThan(50);
    expect(away.level).toBe(CONCENTRATION_LEVELS.LOW);
    expect(away.factors).toContain(CONCENTRATION_FACTORS.LOOKING_AWAY);
    expect(feed(estimator, { from: 30_000, duration: 30_000 }).score).toBeGreaterThan(85);
  });

  it('treats uncertain moments as neutral', () => {
    const estimator = createConcentrationEstimator();
    const before = feed(estimator, { duration: 10_000 }).score;
    expect(feed(estimator, { state: S.UNCERTAIN, from: 10_000, duration: 10_000 }).score).toBe(before);
  });

  it('is capped while the eyes are closed for a long time, even facing the screen', () => {
    const estimator = createConcentrationEstimator();
    feed(estimator, { duration: 10_000 });
    const closed = feed(estimator, { from: 10_000, duration: 100, fatigue: { ...alert, eyesClosed: true, eyesClosedMs: 2000 } });
    expect(closed.score).toBeLessThanOrEqual(25);
    expect(closed.factors).toContain(CONCENTRATION_FACTORS.EYES_CLOSED_NOW);
  });

  it('lowers the score for yawns, long closures and a high blink rate', () => {
    const estimator = createConcentrationEstimator();
    const tired = feed(estimator, {
      fatigue: { ...alert, yawnsInWindow: 2, longClosuresInWindow: 1, indicators: [FATIGUE_INDICATORS.BLINK_RATE_HIGH] },
    });
    expect(tired.score).toBe(Math.round(100 * (1 - (0.24 + 0.15 + 0.1))));
    expect(tired.factors).toEqual(expect.arrayContaining([
      CONCENTRATION_FACTORS.YAWNS, CONCENTRATION_FACTORS.LONG_CLOSURES, CONCENTRATION_FACTORS.BLINK_RATE,
    ]));
  });
});

describe('attention engine end to end (calibration-free)', () => {
  function run(engine, result, from, duration) {
    let output;
    for (let time = from; time < from + duration; time += FRAME_MS) {
      output = engine.process(result(time), time, FRAME);
      expect(isValidAttentionFrame(output.frame)).toBe(true);
    }
    return output;
  }

  it('adapts, then detects on-screen, looking away, face absent and return', () => {
    const user = simulatedUser({ seed: 11 });
    const engine = createAttentionEngine();
    const random = seededRandom(4);
    const wander = () => user.lookAt(0.2 + random() * 0.6, 0.2 + random() * 0.6);

    expect(engine.process(wander(), 0, FRAME).frame).toMatchObject({ state: S.UNCERTAIN, adapted: false });
    expect(run(engine, wander, FRAME_MS, 5000).frame).toMatchObject({ state: S.ON_SCREEN, adapted: true });
    expect(run(engine, () => user.lookAt(2, 0.5), 5000, 2500).frame.state).toBe(S.OFF_SCREEN);
    expect(run(engine, () => NO_FACE, 7500, 2500).frame).toMatchObject({ state: S.FACE_ABSENT, reason: R.NO_FACE });
    expect(run(engine, wander, 10000, 2500).frame.state).toBe(S.ON_SCREEN);
  });

  it('estimates concentration from gaze and fatigue signs', () => {
    const user = simulatedUser({ seed: 5 });
    const engine = createAttentionEngine();
    const random = seededRandom(8);
    const wander = () => user.lookAt(0.2 + random() * 0.6, 0.2 + random() * 0.6);

    const focused = run(engine, wander, 0, 15_000).frame.concentration;
    expect(focused).toMatchObject({ ready: true, level: CONCENTRATION_LEVELS.HIGH });
    expect(focused.score).toBeGreaterThanOrEqual(90);

    const sleepy = run(engine, () => user.lookAt(0.5, 0.5, { eyeAspect: 0.05, blink: 1 }), 15_000, 3000).frame.concentration;
    expect(sleepy.score).toBeLessThanOrEqual(25);

    const distracted = run(engine, () => user.lookAt(2, 0.5), 18_000, 12_000).frame.concentration;
    expect(distracted.level).toBe(CONCENTRATION_LEVELS.LOW);
  });

  it('ignores normal blinks while looking at the screen', () => {
    const user = simulatedUser({ seed: 3 });
    const engine = createAttentionEngine();
    run(engine, () => user.lookAt(0.5, 0.5), 0, 5000);
    const output = run(engine, (time) => (time % 3000 < 200
      ? user.lookAt(0.5, 0.5, { eyeAspect: 0.05, blink: 1 })
      : user.lookAt(0.5, 0.5)), 5000, 9000);
    expect(output.frame.state).toBe(S.ON_SCREEN);
  });

  it('re-centers on request', () => {
    const user = simulatedUser();
    const engine = createAttentionEngine();
    run(engine, () => user.lookAt(0.5, 0.5), 0, 5000);
    engine.recenter();
    expect(engine.process(user.lookAt(0.5, 0.5), 5100, FRAME).frame).toMatchObject({
      state: S.UNCERTAIN, reason: R.ADAPTING, adapted: false,
    });
  });
});
