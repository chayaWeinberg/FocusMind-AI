import { describe, expect, it } from 'vitest';
import { fitRidgeRegression, solveLinearSystem } from './math.js';
import { eyesClosed, extractSignals } from './signals.js';
import {
  CALIBRATION_FAILURES,
  CALIBRATION_TARGETS,
  createCalibrationSession,
  fitCalibration,
  predictGazePoint,
} from './calibration.js';
import { fuseSignals, onScreenProbability } from './fusion.js';
import { createTemporalSmoother } from './temporal.js';
import { createFatigueMonitor } from './fatigue.js';
import { createAttentionEngine } from './engine.js';
import { ATTENTION_REASONS as R, ATTENTION_STATES as S, FATIGUE_INDICATORS, isValidAttentionFrame } from './contracts.js';
import { FRAME, NO_FACE, simulatedUser, syntheticResult } from './testing/syntheticFace.js';

const FRAME_MS = 66;

/** Runs a full calibration with a simulated user and returns the model. */
function calibrate(user, { startAt = 0 } = {}) {
  const session = createCalibrationSession();
  session.start(startAt);
  let time = startAt;
  while (session.getSnapshot().status === 'running') {
    time += FRAME_MS;
    const target = session.getSnapshot().target;
    session.addSample(extractSignals(user.lookAt(target.x, target.y), FRAME), time);
  }
  return { session, time };
}

describe('math', () => {
  it('solves linear systems and detects singular ones', () => {
    expect(solveLinearSystem([[2, 1], [1, 3]], [3, 5])).toEqual([0.8, 1.4].map((v) => expect.closeTo(v, 9)));
    expect(solveLinearSystem([[1, 2], [2, 4]], [1, 2])).toBeNull();
  });

  it('ridge regression recovers a linear mapping', () => {
    const inputs = [];
    const outputs = [];
    for (let a = -1; a <= 1; a += 0.25) {
      for (let b = -1; b <= 1; b += 0.25) {
        inputs.push([a * 10, b]);
        outputs.push([0.5 + 0.03 * a * 10, 0.2 - 0.4 * b]);
      }
    }
    const model = fitRidgeRegression(inputs, outputs, { lambda: 1e-6 });
    const [x, y] = model.predict([5, 0.5]);
    expect(x).toBeCloseTo(0.65, 4);
    expect(y).toBeCloseTo(0, 4);
  });
});

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

  it('handles a frame without a face', () => {
    const signals = extractSignals(NO_FACE, FRAME);
    expect(signals.faceDetected).toBe(false);
    expect(eyesClosed(signals)).toBeNull();
  });
});

describe('calibration', () => {
  it('runs through all 9 targets and fits an accurate personal model', () => {
    const { session } = calibrate(simulatedUser());
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe('done');
    const model = session.getModel();
    expect(model.full).not.toBeNull();
    expect(model.headOnly).not.toBeNull();
    expect(model.error).toBeLessThan(0.1);
    expect(model.quality).toBe('excellent');

    const point = predictGazePoint(model.full, extractSignals(simulatedUser({ seed: 99 }).lookAt(0.3, 0.7), FRAME));
    expect(point.x).toBeCloseTo(0.3, 1);
    expect(point.y).toBeCloseTo(0.7, 1);
  });

  it('adapts to a different user and camera position', () => {
    const otherUser = simulatedUser({ yawGain: 25, pitchGain: -10, irisGainH: -0.5, seed: 3 });
    const { session } = calibrate(otherUser);
    const model = session.getModel();
    const point = predictGazePoint(model.full, extractSignals(otherUser.lookAt(0.8, 0.2), FRAME));
    expect(point.x).toBeCloseTo(0.8, 1);
    expect(point.y).toBeCloseTo(0.2, 1);
  });

  it('fails when the face is missing for a target, even after a retry', () => {
    const session = createCalibrationSession();
    session.start(0);
    for (let time = FRAME_MS; time < 10_000 && session.getSnapshot().status === 'running'; time += FRAME_MS) {
      session.addSample(extractSignals(NO_FACE, FRAME), time);
    }
    expect(session.getSnapshot()).toMatchObject({ status: 'failed', failure: CALIBRATION_FAILURES.FACE_NOT_DETECTED });
  });

  it('rejects a calibration where the user did not follow the targets', () => {
    const user = simulatedUser();
    const groups = CALIBRATION_TARGETS.map((target) => ({
      target,
      samples: Array.from({ length: 15 }, () => extractSignals(user.lookAt(0.5, 0.5), FRAME)),
    }));
    const result = fitCalibration(groups);
    expect(result.ok).toBe(false);
  });

  it('can be cancelled', () => {
    const session = createCalibrationSession();
    session.start(0);
    session.cancel();
    expect(session.getSnapshot()).toMatchObject({ status: 'failed', failure: CALIBRATION_FAILURES.CANCELLED });
  });
});

describe('fusion', () => {
  const user = simulatedUser();
  const { session } = calibrate(user);
  const model = session.getModel();
  const fuse = (result) => fuseSignals(extractSignals(result, FRAME), model);

  it.each([[0.5, 0.5], [0.15, 0.2], [0.85, 0.85]])('detects looking at the screen at (%s, %s)', (x, y) => {
    const raw = fuse(user.lookAt(x, y));
    expect(raw.state).toBe(S.ON_SCREEN);
    expect(raw.modelUsed).toBe('full');
    expect(raw.confidence).toBeGreaterThan(0.6);
  });

  it.each([[1.6, 0.5], [-0.6, 0.5], [0.5, 1.7]])('detects looking away at (%s, %s)', (x, y) => {
    expect(fuse(user.lookAt(x, y)).state).toBe(S.OFF_SCREEN);
  });

  it('treats a head turned far beyond the calibrated range as looking away', () => {
    const raw = fuse(syntheticResult({ yaw: 45, pitch: -6 }));
    expect(raw).toMatchObject({ state: S.OFF_SCREEN, reason: R.HEAD_TURNED_AWAY });
  });

  it('reports a missing face', () => {
    expect(fuse(NO_FACE)).toMatchObject({ state: S.FACE_ABSENT, reason: R.NO_FACE });
  });

  it('falls back to the head-only model when the eyes are closed', () => {
    const raw = fuse(user.lookAt(0.5, 0.5, { eyeAspect: 0.05, blink: 1 }));
    expect(raw.modelUsed).toBe('head-only');
  });

  it('moves monotonically from on-screen to off-screen across the edge', () => {
    const order = { [S.ON_SCREEN]: 0, [S.UNCERTAIN]: 1, [S.OFF_SCREEN]: 2 };
    const states = [0.8, 0.95, 1.0, 1.05, 1.1, 1.2, 1.4].map((x) => fuse(user.lookAt(x, 0.5)).state);
    expect(states[0]).toBe(S.ON_SCREEN);
    expect(states.at(-1)).toBe(S.OFF_SCREEN);
    states.slice(1).forEach((state, index) => {
      expect(order[state]).toBeGreaterThanOrEqual(order[states[index]]);
    });
  });

  it('gives a 50% on-screen probability exactly at the (margin-expanded) edge', () => {
    expect(onScreenProbability({ x: 1.05, y: 0.5 }, 0.15, 0.05)).toBeCloseTo(0.5, 5);
  });

  it('asks for recalibration when the user moved away from the calibrated position', () => {
    const raw = fuse(user.lookAt(0.5, 0.5, { translation: { x: 0, y: 0, z: -80 } }));
    expect(raw).toMatchObject({ state: S.UNCERTAIN, reason: R.OUTSIDE_CALIBRATION, recalibrationSuggested: true });
  });

  it('without calibration is uncertain, except for an obvious head turn', () => {
    expect(fuseSignals(extractSignals(user.lookAt(0.5, 0.5), FRAME), null))
      .toMatchObject({ state: S.UNCERTAIN, reason: R.NOT_CALIBRATED });
    expect(fuseSignals(extractSignals(syntheticResult({ yaw: 55 }), FRAME), null).state).toBe(S.OFF_SCREEN);
  });

  it('turns a larger model error into a softer probability', () => {
    const point = { x: 1.1, y: 0.5 };
    expect(onScreenProbability(point, 0.05, 0.05)).toBeLessThan(onScreenProbability(point, 0.3, 0.05));
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

  it('does not report a blink rate before 20 seconds of observation', () => {
    const monitor = createFatigueMonitor();
    const summary = monitor.update(extractSignals(syntheticResult(), FRAME), 0);
    expect(summary.blinkRatePerMinute).toBeNull();
    expect(summary.indicators).toEqual([]);
  });
});

describe('attention engine end to end', () => {
  it('produces valid frames through calibration, looking away and face absence', () => {
    const user = simulatedUser({ seed: 11 });
    const engine = createAttentionEngine();
    const { session } = calibrate(user);
    engine.setCalibration(session.getModel());

    const run = (result, from, duration) => {
      let output;
      for (let time = from; time < from + duration; time += FRAME_MS) {
        output = engine.process(result(), time, FRAME);
        expect(isValidAttentionFrame(output.frame)).toBe(true);
      }
      return output;
    };

    expect(run(() => user.lookAt(0.4, 0.6), 0, 2000).frame).toMatchObject({ state: S.ON_SCREEN, calibrated: true });
    expect(run(() => user.lookAt(1.8, 0.5), 2000, 2000).frame.state).toBe(S.OFF_SCREEN);
    expect(run(() => NO_FACE, 4000, 2000).frame).toMatchObject({ state: S.FACE_ABSENT, reason: R.NO_FACE });
    expect(run(() => user.lookAt(0.5, 0.5), 6000, 2000).frame.state).toBe(S.ON_SCREEN);
  });

  it('publishes CALIBRATING while calibration runs', () => {
    const engine = createAttentionEngine();
    engine.setCalibrating(true);
    const output = engine.process(syntheticResult(), 0, FRAME);
    expect(output.frame).toMatchObject({ state: S.UNCERTAIN, reason: R.CALIBRATING });
    expect(isValidAttentionFrame(output.frame)).toBe(true);
  });
});
