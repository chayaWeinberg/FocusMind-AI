import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScreenCalibration from './ScreenCalibration.jsx';
import {
  CALIBRATION_TARGETS,
  createScreenCalibrationSession,
} from './screenCalibrationCollector.js';
import { createLiveGazeDiagnosticRecorder } from './liveGazeDiagnosticRecorder.js';

const VOICE_SETTLING_DELAY_MS = 1500;
const VOICE_RECORDING_DURATION_MS = 2500;

function validSample() {
  return {
    faceDetected: true,
    headPose: { yaw: 2, pitch: -1, roll: 0.5 },
    eyeGaze: {
      leftEye: { horizontal: 0.1, vertical: -0.2 },
      rightEye: { horizontal: 0.12, vertical: -0.18 },
      reliability: 'reliable',
      reason: null,
    },
    blendshapes: { eyeLookDownLeft: 0.3, eyeLookDownRight: 0.31 },
  };
}

function liveDiagnosticSample(rawClassifierState, smoothedState) {
  return {
    modelReady: true,
    missingRequirements: [],
    calibrationSampleCounts: { 'screen:CENTER': 3 },
    liveFeatures: {
      faceDetected: true,
      headPoseValid: true,
      leftEyeValid: true,
      rightEyeValid: true,
      blendshapesValid: true,
      headYaw: 0.1,
      headPitch: -0.2,
      headRoll: 0,
      leftEyeHorizontal: 0.03,
      leftEyeVertical: 0.02,
      rightEyeHorizontal: 0.04,
      rightEyeVertical: 0.01,
      blendshapes: { eyeLookDownLeft: 0.1 },
      eyeMeasurementReliability: 'reliable',
      eyeReliabilityReason: null,
    },
    rawClassifierState,
    smoothedState,
    classifierReason: rawClassifierState === 'UNKNOWN' ? 'ambiguous-calibration-match' : null,
    classifierScore: 0.1,
    availableFeatureGroups: ['headPose', 'eyeGaze', 'blendshapes'],
    calibrationDrift: false,
    classifierDiagnostics: {
      closestScreenProfile: { id: 'screen:CENTER', distance: 0.4, coverageGroups: ['headPose'] },
      closestOffscreenProfile: {
        id: 'away:LOOK_AWAY_LEFT:eyes',
        distance: 0.5,
        coverageGroups: ['headPose'],
      },
      groupEvidence: [{ featureGroup: 'headPose', evidence: 0.1 }],
      decision: {
        reason: 'ambiguous-calibration-match',
        minimumEvidence: Math.log(2),
        hasCoverage: true,
      },
      posture: {
        calibrationDrift: false,
        closestHeadPoseProfile: { id: 'screen:CENTER', distance: 0.4 },
      },
    },
  };
}

function renderCalibration({
  cameraAvailable = true,
  videoPlaybackState = 'playing',
  experimentMode = false,
  modelReady = false,
  options = {},
  session = null,
  liveDiagnosticRecorder = null,
} = {}) {
  const sessionRef = { current: session ?? createScreenCalibrationSession(options) };
  const liveDiagnosticRecorderRef = {
    current: liveDiagnosticRecorder ?? createLiveGazeDiagnosticRecorder(),
  };
  const now = () => performance.now();
  const actions = {
    startCalibration: vi.fn(() => {
      sessionRef.current.start(now());
      return true;
    }),
    startGuidedCalibration: vi.fn(() => {
      sessionRef.current.startGuided(now());
      return true;
    }),
    startLiveGazeDiagnosticRecording: vi.fn(() => liveDiagnosticRecorderRef.current.start(now())),
    setLiveGazeDiagnosticStage: vi.fn((stage) => (
      liveDiagnosticRecorderRef.current.setStage(stage, now())
    )),
    endLiveGazeDiagnosticStage: vi.fn(() => liveDiagnosticRecorderRef.current.endStage(now())),
    stopLiveGazeDiagnosticRecording: vi.fn(() => liveDiagnosticRecorderRef.current.stop(now())),
    cancelCalibration: vi.fn(() => sessionRef.current.cancel()),
    restartCalibration: vi.fn(() => {
      sessionRef.current.start(now());
      return true;
    }),
    repeatCalibrationTarget: vi.fn(() => sessionRef.current.repeatTarget(now())),
    startKeyboardEvaluation: vi.fn(() => sessionRef.current.startKeyboardEvaluation(now())),
    startOffscreenCalibration: vi.fn(() => sessionRef.current.startOffscreenCalibration(now())),
    completeCalibration: vi.fn(() => sessionRef.current.completeWithoutKeyboard()),
  };
  const view = render(
    <ScreenCalibration
      cameraAvailable={cameraAvailable}
      videoPlaybackState={videoPlaybackState}
      experimentMode={experimentMode}
      modelReady={modelReady}
      sessionRef={sessionRef}
      liveDiagnosticRecorderRef={liveDiagnosticRecorderRef}
      {...actions}
    />,
  );
  return { ...view, sessionRef, liveDiagnosticRecorderRef, actions };
}

function installSpeechMocks({ voices = [{ lang: 'he-IL', name: 'Hebrew' }] } = {}) {
  const descriptors = {
    speechSynthesis: Object.getOwnPropertyDescriptor(window, 'speechSynthesis'),
    SpeechSynthesisUtterance: Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance'),
    AudioContext: Object.getOwnPropertyDescriptor(window, 'AudioContext'),
  };
  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.voice = null;
      this.rate = 1;
    }
  }
  const utterances = [];
  let availableVoices = voices;
  const speechListeners = new Map();
  const speechSynthesis = {
    getVoices: vi.fn(() => availableVoices),
    addEventListener: vi.fn((name, listener) => speechListeners.set(name, listener)),
    removeEventListener: vi.fn((name) => speechListeners.delete(name)),
    setVoices(nextVoices) {
      availableVoices = nextVoices;
      speechListeners.get('voiceschanged')?.();
    },
    speak: vi.fn((utterance) => utterances.push(utterance)),
    cancel: vi.fn(),
  };
  const oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const audioContext = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  };
  class MockAudioContext {
    constructor() {
      return audioContext;
    }
  }
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: speechSynthesis,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: MockUtterance,
  });
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });
  return {
    descriptors,
    utterances,
    speechSynthesis,
    setVoices: (nextVoices) => speechSynthesis.setVoices(nextVoices),
    audioContext,
    oscillator,
  };
}

describe('ScreenCalibration', () => {
  let speechMocks;

  afterEach(() => {
    speechMocks?.descriptors && Object.entries(speechMocks.descriptors).forEach(([name, descriptor]) => {
      if (descriptor) Object.defineProperty(window, name, descriptor);
      else delete window[name];
    });
    speechMocks = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('only starts when camera and video playback are available and displays a viewport target countdown', () => {
    const { actions, rerender, sessionRef } = renderCalibration({
      cameraAvailable: false,
      videoPlaybackState: 'paused',
    });
    const startButton = screen.getByRole('button', { name: 'התחלת כיול' });
    expect(startButton).toBeDisabled();
    expect(actions.startCalibration).not.toHaveBeenCalled();

    rerender(
      <ScreenCalibration
        cameraAvailable
        videoPlaybackState="playing"
        sessionRef={sessionRef}
        {...actions}
      />,
    );
    fireEvent.click(startButton);

    expect(actions.startCalibration).toHaveBeenCalledTimes(1);
    expect(startButton).toBeDisabled();
    expect(screen.getByLabelText('מטרת כיול במסך')).toBeInTheDocument();
    expect(document.querySelector('.screen-calibration-overlay').parentElement).toBe(document.body);
    expect(document.querySelector('.screen-calibration-overlay-instructions strong'))
      .toHaveTextContent('CENTER');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(document.querySelector('.screen-calibration-viewport-target')).toHaveStyle({
      left: '50vw',
      top: '50vh',
    });
  });

  it('counts down, collects, offers a repeat when sample minimum is missed, and supports cancellation and restart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { actions, sessionRef } = renderCalibration({
      options: { minimumReliableSamples: 1 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('collecting');
    expect(screen.getByText(/אוספים מדידות/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('needs-repeat');
    fireEvent.click(screen.getByRole('button', { name: 'חזרה על היעד' }));
    expect(actions.repeatCalibrationTarget).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('countdown');

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(actions.cancelCalibration).toHaveBeenCalledTimes(1);
    expect(screen.getByText('האיסוף בוטל')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'התחלה מחדש' }));
    expect(actions.restartCalibration).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now())).toMatchObject({
      status: 'countdown',
      target: { label: 'CENTER' },
      acceptedSampleCount: 0,
      rejectedSampleCount: 0,
    });
  });

  it('interrupts active collection when camera or video playback becomes unavailable', () => {
    const { rerender, sessionRef, actions } = renderCalibration();
    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    rerender(
      <ScreenCalibration
        cameraAvailable
        videoPlaybackState="buffering"
        sessionRef={sessionRef}
        {...actions}
      />,
    );
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('interrupted');
    expect(screen.getByText('האיסוף נעצר כי המצלמה או הווידאו אינם פעילים')).toBeInTheDocument();
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);
  });

  it('guides eye-only and head-turn examples beyond each screen edge', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { sessionRef } = renderCalibration({
      options: { countdownMs: 0, targetDurationMs: 1000, minimumReliableSamples: 1 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    CALIBRATION_TARGETS.forEach((target) => {
      act(() => vi.advanceTimersByTime(100));
      sessionRef.current.recordSample(validSample(), performance.now());
      act(() => vi.advanceTimersByTime(1100));
    });
    expect(screen.getByRole('button', { name: 'כיול מבטים מחוץ למסך' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'כיול מבטים מחוץ למסך' }));

    expect(screen.getAllByText('LOOK_AWAY_LEFT')).toHaveLength(2);
    expect(screen.getByText('הביטו מעבר לקצה השמאלי של המסך')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('השאירו את הראש מול המסך והזיזו רק את העיניים')).toBeInTheDocument();

    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
      sessionRef.current.recordSample(validSample(), performance.now() + sampleIndex);
    }
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.getAllByText(/הפנו גם את הראש לכיוון המבט/)).toHaveLength(2);
  });

  it('shows one guided calibration step and allows collection while the lesson video is paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { actions, sessionRef } = renderCalibration({
      experimentMode: true,
      videoPlaybackState: 'paused',
      options: { countdownMs: 0, targetDurationMs: 1000, minimumReliableSamples: 1 },
    });

    expect(screen.getByText('שלב 1 מתוך 13')).toBeInTheDocument();
    expect(screen.getByText('התבוננו בנקודה שבמרכז המסך')).toBeInTheDocument();
    expect(document.querySelectorAll('.gaze-calibration-instruction')).toHaveLength(1);
    expect(screen.queryByText('CENTER')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'בדיקת מקלדת אופציונלית' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחלת כיול' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'הורדת נתוני כיול (JSON)' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    expect(actions.startCalibration).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('מטרת כיול במסך')).toBeInTheDocument();

    CALIBRATION_TARGETS.forEach(() => {
      act(() => vi.advanceTimersByTime(100));
      sessionRef.current.recordSample(validSample(), performance.now());
      act(() => vi.advanceTimersByTime(1100));
    });
    expect(actions.startOffscreenCalibration).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now()).target).toMatchObject({
      label: 'LOOK_AWAY_LEFT',
      movementMode: 'eyes',
    });
    act(() => vi.advanceTimersByTime(1600));
    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
      sessionRef.current.recordSample(validSample(), performance.now() + sampleIndex);
    }
    act(() => vi.advanceTimersByTime(2600));
    expect(screen.getByText(/הפנו גם את הראש לכיוון המבט/)).toBeInTheDocument();
  });

  it('automatically guides all screen and off-screen steps before reporting calibration complete', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const { sessionRef, actions, rerender } = renderCalibration({
      experimentMode: true,
      videoPlaybackState: 'paused',
      options: { countdownMs: 0, targetDurationMs: 1000, minimumReliableSamples: 1 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    CALIBRATION_TARGETS.forEach(() => {
      act(() => vi.advanceTimersByTime(100));
      sessionRef.current.recordSample(validSample(), performance.now());
      act(() => vi.advanceTimersByTime(1100));
    });

    expect(actions.startOffscreenCalibration).toHaveBeenCalledTimes(1);
    expect(sessionRef.current.getSnapshot(performance.now()).target).toMatchObject({
      label: 'LOOK_AWAY_LEFT',
      movementMode: 'eyes',
    });
    expect(screen.getByText(/שלב 6 מתוך 13/)).toBeInTheDocument();

    for (let index = 0; index < 8; index += 1) {
      act(() => vi.advanceTimersByTime(1600));
      for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
        sessionRef.current.recordSample(validSample(), performance.now() + sampleIndex);
      }
      act(() => vi.advanceTimersByTime(2600));
    }

    const finalSnapshot = sessionRef.current.getSnapshot(performance.now());
    expect(finalSnapshot.status).toBe('complete');
    expect(Object.values(finalSnapshot.collector.offscreenTargets)
      .every((target) => target.acceptedSampleCount >= 3)).toBe(true);
    expect(screen.getByText(/אין עדיין מספיק מדידות תקינות/))
      .toBeInTheDocument();

    rerender(
      <ScreenCalibration
        cameraAvailable
        videoPlaybackState="paused"
        experimentMode
        modelReady
        sessionRef={sessionRef}
        {...actions}
      />,
    );
    expect(screen.getByText('הכיול הושלם')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחלת כיול מחדש' })).toBeEnabled();
  });

  it('waits for speech end and the settling delay before collecting, then advances automatically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const { sessionRef, actions } = renderCalibration({
      experimentMode: true,
      videoPlaybackState: 'paused',
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(actions.startGuidedCalibration).toHaveBeenCalledOnce();
    expect(speechMocks.utterances).toHaveLength(1);
    expect(speechMocks.utterances[0]).toMatchObject({
      lang: 'he-IL',
      voice: { lang: 'he-IL', name: 'Hebrew' },
    });
    expect(speechMocks.utterances[0].text).toContain('הסתכלי על הנקודה שבמרכז המסך');
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-transition');
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);

    act(() => speechMocks.utterances[0].onend());
    act(() => vi.advanceTimersByTime(VOICE_SETTLING_DELAY_MS - 1));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-transition');
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('collecting');
    expect(speechMocks.oscillator.start).toHaveBeenCalledOnce();
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(true);

    act(() => vi.advanceTimersByTime(VOICE_RECORDING_DURATION_MS));
    expect(speechMocks.utterances).toHaveLength(2);
    expect(speechMocks.utterances[1].text).toContain('הסתכלי על הנקודה בחלק העליון');
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-transition');
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);
  });

  it('automatically collects every required screen and off-screen eyes/head stage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const { sessionRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    for (let stepIndex = 0; stepIndex < 13; stepIndex += 1) {
      const utterance = speechMocks.utterances[stepIndex];
      expect(utterance).toBeDefined();
      act(() => utterance.onend());
      act(() => vi.advanceTimersByTime(VOICE_SETTLING_DELAY_MS));
      const target = sessionRef.current.getSnapshot(performance.now()).target;
      const sampleCount = target.movementMode ? 3 : 1;
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        expect(sessionRef.current.recordSample(
          validSample(),
          performance.now() + sampleIndex,
        ).accepted).toBe(true);
      }
      act(() => vi.advanceTimersByTime(VOICE_RECORDING_DURATION_MS));
    }

    const finalSnapshot = sessionRef.current.getSnapshot(performance.now());
    expect(finalSnapshot.status).toBe('complete');
    expect(speechMocks.utterances).toHaveLength(13);
    expect(speechMocks.utterances.map((utterance) => utterance.text)).toEqual([
      'הסתכלי על הנקודה שבמרכז המסך. השאירי את הראש ישר.',
      'הסתכלי על הנקודה בחלק העליון של המסך. השאירי את הראש ישר.',
      'הסתכלי על הנקודה בחלק התחתון של המסך. השאירי את הראש ישר.',
      'הסתכלי על הנקודה בצד השמאלי של המסך. השאירי את הראש ישר.',
      'הסתכלי על הנקודה בצד הימני של המסך. השאירי את הראש ישר.',
      'הסתכלי שמאלה, מעבר לקצה המסך. השאירי את הראש ישר והזיזי רק את העיניים.',
      'הסתכלי שמאלה, מעבר לקצה המסך. הפני גם את הראש לכיוון המבט.',
      'הסתכלי ימינה, מעבר לקצה המסך. השאירי את הראש ישר והזיזי רק את העיניים.',
      'הסתכלי ימינה, מעבר לקצה המסך. הפני גם את הראש לכיוון המבט.',
      'הסתכלי למעלה, מעבר למסך. השאירי את הראש ישר והזיזי רק את העיניים.',
      'הסתכלי למעלה, מעבר למסך. הפני גם את הראש לכיוון המבט.',
      'הסתכלי למטה, אל המקלדת. השאירי את הראש ישר והזיזי רק את העיניים.',
      'הסתכלי למטה, אל המקלדת. הפני גם את הראש לכיוון המבט.',
    ]);
    expect(finalSnapshot.collector.offscreenTargets.LOOK_AWAY_LEFT.acceptedSamples.map(
      (sample) => sample.movementMode,
    )).toEqual(['eyes', 'eyes', 'eyes', 'head', 'head', 'head']);
    expect(Object.values(finalSnapshot.collector.offscreenTargets)
      .every((target) => target.acceptedSampleCount >= 6)).toBe(true);
  });

  it('pauses safely, resumes the same target, and restarts without retaining old samples', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const { sessionRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const firstUtterance = speechMocks.utterances[0];
    fireEvent.click(screen.getByRole('button', { name: 'השהיה' }));
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-paused');
    act(() => firstUtterance.onend());
    act(() => vi.advanceTimersByTime(3000));
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect(speechMocks.utterances).toHaveLength(2);
    expect(speechMocks.utterances[1].text).toBe(firstUtterance.text);
    act(() => speechMocks.utterances[1].onend());
    act(() => vi.advanceTimersByTime(VOICE_SETTLING_DELAY_MS));
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'התחלה מחדש' }));
    expect(sessionRef.current.getSnapshot(performance.now())).toMatchObject({
      status: 'guided-transition',
      target: { label: 'CENTER' },
      acceptedSampleCount: 0,
    });
    expect(speechMocks.utterances).toHaveLength(3);
  });

  it('explains unavailable Hebrew speech and offers a manual calibration fallback', async () => {
    vi.useFakeTimers();
    speechMocks = installSpeechMocks({ voices: [{ lang: 'en-US', name: 'English' }] });
    const { actions, sessionRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      act(() => vi.advanceTimersByTime(1500));
      await Promise.resolve();
    });

    expect(screen.getByText(/לא נמצא בדפדפן קול בעברית/)).toBeInTheDocument();
    expect(actions.startGuidedCalibration).not.toHaveBeenCalled();
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('idle');

    fireEvent.click(screen.getByRole('button', { name: 'מעבר לכיול ידני' }));
    expect(actions.startCalibration).toHaveBeenCalledOnce();
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('countdown');
  });

  it('waits for a Hebrew voice that becomes available through voiceschanged', async () => {
    vi.useFakeTimers();
    speechMocks = installSpeechMocks({ voices: [] });
    const { actions } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(actions.startGuidedCalibration).not.toHaveBeenCalled();
    act(() => speechMocks.setVoices([{ lang: 'en-US', name: 'English' }]));
    expect(actions.startGuidedCalibration).not.toHaveBeenCalled();
    await act(async () => {
      speechMocks.setVoices([{ lang: 'he-IL', name: 'Hebrew' }]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(actions.startGuidedCalibration).toHaveBeenCalledOnce();
    expect(speechMocks.utterances[0].voice).toMatchObject({ lang: 'he-IL' });
  });

  it('stops speech timers on unmount and never leaves guided sample collection enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const { sessionRef, unmount } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const utterance = speechMocks.utterances[0];
    act(() => utterance.onend());
    unmount();
    act(() => vi.advanceTimersByTime(VOICE_SETTLING_DELAY_MS + VOICE_RECORDING_DURATION_MS));

    expect(speechMocks.speechSynthesis.cancel).toHaveBeenCalled();
    expect(speechMocks.oscillator.start).not.toHaveBeenCalled();
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-paused');
    expect(sessionRef.current.recordSample(validSample(), performance.now()).accepted).toBe(false);
  });

  it('reports speech playback errors and exposes the manual fallback', async () => {
    vi.useFakeTimers();
    speechMocks = installSpeechMocks();
    const { sessionRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => speechMocks.utterances[0].onerror({ error: 'synthesis-failed' }));

    expect(screen.getByText(/אירעה שגיאה בהשמעת ההוראות/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מעבר לכיול ידני' })).toBeEnabled();
    expect(sessionRef.current.getSnapshot(performance.now()).status).toBe('guided-paused');
  });

  it('records three speech-guided diagnostic stages only after speech and settling, then exports actual results', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const createObjectURL = vi.fn(() => 'blob:live-gaze-diagnostic');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { liveDiagnosticRecorderRef, actions } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הקלטת בדיקת מבט' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(actions.startLiveGazeDiagnosticRecording).toHaveBeenCalledOnce();
    expect(speechMocks.utterances[0].text).toBe('הסתכלי על מרכז המסך');
    expect(liveDiagnosticRecorderRef.current.record(
      liveDiagnosticSample('LOOKING_AT_SCREEN', 'UNKNOWN'),
      performance.now(),
    )).toBe(false);

    const expectedStages = [
      ['CENTER_BEFORE', 'CENTER', 'LOOKING_AT_SCREEN', 'הסתכלי על מרכז המסך'],
      ['LOOK_AWAY_LEFT', 'LOOK_AWAY_LEFT', 'LOOKING_AWAY', 'הסתכלי שמאלה, מחוץ למסך'],
      ['CENTER_AFTER', 'CENTER', 'LOOKING_AT_SCREEN', 'חזרי להסתכל על מרכז המסך'],
    ];
    expectedStages.forEach((stage, index) => {
      act(() => speechMocks.utterances[index].onend());
      act(() => vi.advanceTimersByTime(1499));
      expect(liveDiagnosticRecorderRef.current.record(
        liveDiagnosticSample('UNKNOWN', 'UNKNOWN'),
        performance.now(),
      )).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(actions.setLiveGazeDiagnosticStage).toHaveBeenLastCalledWith({
        id: stage[0],
        expectedLabel: stage[1],
        expectedState: stage[2],
        instruction: stage[3],
      });
      expect(liveDiagnosticRecorderRef.current.record(
        liveDiagnosticSample(index === 1 ? 'LOOKING_AWAY' : 'UNKNOWN', 'UNKNOWN'),
        performance.now(),
      )).toBe(true);
      act(() => vi.advanceTimersByTime(5000));
    });

    expect(liveDiagnosticRecorderRef.current.getSnapshot()).toMatchObject({
      recording: false,
      sampleCount: 3,
      stageSummaries: [
        { id: 'CENTER_BEFORE', expectedLabel: 'CENTER', expectedState: 'LOOKING_AT_SCREEN' },
        { id: 'LOOK_AWAY_LEFT', expectedLabel: 'LOOK_AWAY_LEFT', expectedState: 'LOOKING_AWAY' },
        { id: 'CENTER_AFTER', expectedLabel: 'CENTER', expectedState: 'LOOKING_AT_SCREEN' },
      ],
      samples: [
        {
          expectedStage: 'CENTER_BEFORE',
          rawClassifierState: 'UNKNOWN',
          classifierReason: 'ambiguous-calibration-match',
        },
        { expectedStage: 'LOOK_AWAY_LEFT', rawClassifierState: 'LOOKING_AWAY' },
        { expectedStage: 'CENTER_AFTER', rawClassifierState: 'UNKNOWN' },
      ],
    });
    expect(speechMocks.utterances.map(({ text }) => text)).toEqual(
      expectedStages.map((stage) => stage[3]),
    );
    expect(screen.getByRole('button', { name: 'הורדת תוצאות בדיקת מבט (JSON)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'הורדת תוצאות בדיקת מבט (JSON)' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloadClick.mock.contexts[0].download).toBe('live-gaze-diagnostic.json');
    act(() => vi.runOnlyPendingTimers());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:live-gaze-diagnostic');
    vi.useRealTimers();
    const exportedText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    expect(JSON.parse(exportedText).samples[0].classifierDiagnostics.decision)
      .toMatchObject({ reason: 'ambiguous-calibration-match', hasCoverage: true });
  });

  it('cancels the live diagnostic and stops recording on component unmount', async () => {
    vi.useFakeTimers();
    speechMocks = installSpeechMocks();
    const { liveDiagnosticRecorderRef, unmount } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הקלטת בדיקת מבט' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => speechMocks.utterances[0].onend());
    unmount();
    act(() => vi.advanceTimersByTime(10_000));

    expect(speechMocks.speechSynthesis.cancel).toHaveBeenCalled();
    expect(liveDiagnosticRecorderRef.current.getSnapshot().recording).toBe(false);
    expect(liveDiagnosticRecorderRef.current.getSnapshot().sampleCount).toBe(0);
  });

  it('stops cleanly when browser speech is externally interrupted', async () => {
    vi.useFakeTimers();
    speechMocks = installSpeechMocks();
    const { liveDiagnosticRecorderRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הקלטת בדיקת מבט' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => speechMocks.utterances[0].onerror({ error: 'interrupted' }));
    act(() => vi.advanceTimersByTime(10_000));

    expect(liveDiagnosticRecorderRef.current.getSnapshot().recording).toBe(false);
    expect(liveDiagnosticRecorderRef.current.getSnapshot().sampleCount).toBe(0);
    expect(screen.getByText(/הבדיקה בוטלה/)).toBeInTheDocument();
    expect(speechMocks.utterances).toHaveLength(1);
  });

  it('cancels an active live diagnostic without advancing or recording stale samples', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    speechMocks = installSpeechMocks();
    const { liveDiagnosticRecorderRef } = renderCalibration({
      experimentMode: true,
      options: { minimumReliableSamples: 1 },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'הקלטת בדיקת מבט' }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => speechMocks.utterances[0].onend());
    act(() => vi.advanceTimersByTime(1500));
    expect(liveDiagnosticRecorderRef.current.record(
      liveDiagnosticSample('UNKNOWN', 'UNKNOWN'),
      performance.now(),
    )).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'ביטול הבדיקה' }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(liveDiagnosticRecorderRef.current.getSnapshot()).toMatchObject({
      recording: false,
      sampleCount: 1,
      stageSummaries: [{ id: 'CENTER_BEFORE', sampleCount: 1 }],
    });
    expect(speechMocks.utterances).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'הורדת תוצאות בדיקת מבט (JSON)' })).toBeEnabled();
  });

  it('downloads the local JSON report without uploading it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const createObjectURL = vi.fn(() => 'blob:screen-calibration');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { sessionRef } = renderCalibration();

    fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול' }));
    act(() => vi.advanceTimersByTime(3000));
    sessionRef.current.recordSample(validSample(), performance.now());
    sessionRef.current.recordSample({
      faceDetected: true,
      headPose: { yaw: 2, pitch: -1, roll: 0 },
      eyeGaze: { reliability: 'unreliable', reason: 'eyes-closed-or-invalid' },
      blendshapes: { eyeLookDownLeft: 0.8 },
    }, performance.now() + 1);
    act(() => vi.advanceTimersByTime(100));

    const downloadButton = screen.getByRole('button', { name: 'הורדת דוח כיול JSON' });
    expect(downloadButton).toBeEnabled();
    fireEvent.click(downloadButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0].download).toBe('screen-calibration-data.json');
    act(() => vi.runOnlyPendingTimers());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:screen-calibration');
    vi.useRealTimers();
    const exportedText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    const report = JSON.parse(exportedText);
    expect(report.screenCalibration.CENTER.rejectedSamples[0]).toMatchObject({
        rejectionReason: 'eyes-closed-or-invalid',
        eyeLookDownLeft: 0.8,
      });
    expect(report.screenCalibration.CENTER.acceptedSamples[0]).toMatchObject({
      headPoseValid: true,
      leftEyeValid: true,
      rightEyeValid: true,
      blendshapesValid: true,
    });
    expect(report.diagnosticSummary).toMatchObject({
      totalFramesObserved: 2,
      validHeadPoseSampleCount: 2,
      validLeftEyeMeasurementCount: 1,
      validRightEyeMeasurementCount: 1,
      validBlendshapeSampleCount: 2,
      rejectionReasons: { 'eyes-closed-or-invalid': 1 },
    });
    expect(exportedText).not.toMatch(/landmarks|image|videoFrame/i);
  });

  it('downloads current screen and off-screen eye/head calibration data without restarting', async () => {
    const createObjectURL = vi.fn(() => 'blob:experiment-calibration');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const session = createScreenCalibrationSession({
      countdownMs: 0,
      targetDurationMs: 1000,
      minimumReliableSamples: 1,
    });
    session.start(0);

    let timestamp = 0;
    CALIBRATION_TARGETS.forEach(() => {
      session.tick(timestamp);
      session.recordSample(validSample(), timestamp);
      timestamp += 1000;
      session.tick(timestamp);
    });
    expect(session.startOffscreenCalibration(timestamp)).toBe(true);

    ['LOOK_AWAY_LEFT', 'LOOK_AWAY_RIGHT', 'LOOK_AWAY_UP', 'LOOK_AWAY_DOWN']
      .forEach(() => {
        ['eyes', 'head'].forEach(() => {
          session.tick(timestamp + 1500);
          for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
            session.recordSample(validSample(), timestamp + 1501 + sampleIndex);
          }
          timestamp += 4000;
          session.tick(timestamp);
        });
      });

    const { sessionRef, actions } = renderCalibration({
      experimentMode: true,
      session,
    });
    const downloadButton = screen.getByRole('button', { name: 'הורדת נתוני כיול (JSON)' });
    expect(downloadButton).toBeEnabled();
    fireEvent.click(downloadButton);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.contexts[0].download).toBe('screen-calibration-data.json');
    expect(actions.restartCalibration).not.toHaveBeenCalled();
    expect(sessionRef.current.getSnapshot(timestamp).status).toBe('complete');

    const exportedText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    const report = JSON.parse(exportedText);
    expect(report.offscreenTargets.LOOK_AWAY_LEFT.acceptedSamples.map(
      (sample) => sample.movementMode,
    )).toEqual(['eyes', 'eyes', 'eyes', 'head', 'head', 'head']);
    expect(report.offscreenTargets.LOOK_AWAY_DOWN.acceptedSamples).toHaveLength(6);
  });
});
