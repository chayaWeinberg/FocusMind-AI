import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { CALIBRATION_TARGETS } from './screenCalibrationCollector.js';

const REFRESH_INTERVAL_MS = 100;

const TARGET_INSTRUCTIONS = {
  CENTER: 'התבוננו בנקודה שבמרכז המסך',
  TOP: 'התבוננו בנקודה בחלק העליון של המסך',
  BOTTOM: 'התבוננו בנקודה בחלק התחתון של המסך',
  LEFT: 'התבוננו בנקודה בצד השמאלי של המסך',
  RIGHT: 'התבוננו בנקודה בצד הימני של המסך',
  KEYBOARD: 'הביטו במקלדת לצורך בדיקת הערכה נפרדת',
  LOOK_AWAY_LEFT: 'הביטו מעבר לקצה השמאלי של המסך',
  LOOK_AWAY_RIGHT: 'הביטו מעבר לקצה הימני של המסך',
  LOOK_AWAY_UP: 'הביטו אל מעל למסך',
  LOOK_AWAY_DOWN: 'הביטו למטה אל המקלדת',
};

const MOVEMENT_MODE_INSTRUCTIONS = {
  eyes: 'השאירו את הראש מול המסך והזיזו רק את העיניים',
  head: 'הפנו גם את הראש לכיוון המבט',
};
const OFFSCREEN_STEP_ORDER = [
  'LOOK_AWAY_LEFT',
  'LOOK_AWAY_RIGHT',
  'LOOK_AWAY_UP',
  'LOOK_AWAY_DOWN',
];
const TOTAL_GUIDED_STEPS = CALIBRATION_TARGETS.length + OFFSCREEN_STEP_ORDER.length * 2;
const VOICE_SETTLING_DELAY_MS = 1500;
const VOICE_RECORDING_DURATION_MS = 2500;
const LIVE_DIAGNOSTIC_RECORDING_MS = 5000;
const LIVE_DIAGNOSTIC_STAGES = Object.freeze([
  {
    id: 'CENTER_BEFORE',
    expectedLabel: 'CENTER',
    expectedState: 'LOOKING_AT_SCREEN',
    instruction: 'הסתכלי על מרכז המסך',
  },
  {
    id: 'LOOK_AWAY_LEFT',
    expectedLabel: 'LOOK_AWAY_LEFT',
    expectedState: 'LOOKING_AWAY',
    instruction: 'הסתכלי שמאלה, מחוץ למסך',
  },
  {
    id: 'CENTER_AFTER',
    expectedLabel: 'CENTER',
    expectedState: 'LOOKING_AT_SCREEN',
    instruction: 'חזרי להסתכל על מרכז המסך',
  },
]);

const STATUS_LABELS = {
  idle: 'מוכנים לאיסוף נתוני כיול',
  countdown: 'הספירה לאחור החלה',
  collecting: 'אוספים מדידות',
  'needs-repeat': 'לא נאספו מספיק מדידות אמינות. יש לחזור על היעד.',
  'awaiting-keyboard-or-offscreen-or-complete': 'יעדי המסך הושלמו',
  'awaiting-offscreen-or-complete': 'דוגמאות המבט נאספו',
  complete: 'איסוף הכיול הסתיים',
  cancelled: 'האיסוף בוטל',
  interrupted: 'האיסוף נעצר כי המצלמה או הווידאו אינם פעילים',
};

function isActiveStatus(status) {
  return status === 'countdown' || status === 'collecting';
}

function getVoiceInstruction(target) {
  const screenInstructions = {
    CENTER: 'הסתכלי על הנקודה שבמרכז המסך.',
    TOP: 'הסתכלי על הנקודה בחלק העליון של המסך.',
    BOTTOM: 'הסתכלי על הנקודה בחלק התחתון של המסך.',
    LEFT: 'הסתכלי על הנקודה בצד השמאלי של המסך.',
    RIGHT: 'הסתכלי על הנקודה בצד הימני של המסך.',
  };
  const offscreenInstructions = {
    LOOK_AWAY_LEFT: 'הסתכלי שמאלה, מעבר לקצה המסך.',
    LOOK_AWAY_RIGHT: 'הסתכלי ימינה, מעבר לקצה המסך.',
    LOOK_AWAY_UP: 'הסתכלי למעלה, מעבר למסך.',
    LOOK_AWAY_DOWN: 'הסתכלי למטה, אל המקלדת.',
  };
  const direction = screenInstructions[target?.label] || offscreenInstructions[target?.label];
  if (!direction) return null;
  const movementMode = target.movementMode === 'eyes'
    ? 'השאירי את הראש ישר והזיזי רק את העיניים.'
    : target.movementMode === 'head'
      ? 'הפני גם את הראש לכיוון המבט.'
      : 'השאירי את הראש ישר.';
  return `${direction} ${movementMode}`;
}

function findHebrewVoice(voices) {
  return voices.find((voice) => /^he[-_]?il$/i.test(voice.lang))
    || voices.find((voice) => /^he(?:[-_]|$)/i.test(voice.lang))
    || null;
}

function getHebrewVoice(synthesis, setPendingCleanup) {
  const voices = synthesis.getVoices();
  const preferredVoice = findHebrewVoice(voices);
  if (preferredVoice || !synthesis.addEventListener) {
    return Promise.resolve(preferredVoice);
  }

  return new Promise((resolve) => {
    let timeoutId;
    let resolved = false;
    const finish = (voice) => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timeoutId);
      synthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
      setPendingCleanup(null);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const availableVoice = findHebrewVoice(synthesis.getVoices());
      if (availableVoice) finish(availableVoice);
    };
    timeoutId = window.setTimeout(() => finish(null), 1500);
    setPendingCleanup(() => finish(null));
    synthesis.addEventListener('voiceschanged', onVoicesChanged);
  });
}

function exportCalibration(sessionRef, setExportError) {
  const session = sessionRef?.current;
  if (!session) return;
  if (typeof URL.createObjectURL !== 'function') {
    setExportError('הדפדפן אינו תומך בהורדת קובץ JSON.');
    return;
  }
  const file = new Blob([session.serialize()], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'screen-calibration-data.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setExportError('');
}

function exportLiveDiagnostic(recorderRef, setExportError) {
  const recorder = recorderRef?.current;
  if (!recorder) return;
  if (typeof URL.createObjectURL !== 'function') {
    setExportError('הדפדפן אינו תומך בהורדת קובץ JSON.');
    return;
  }
  const file = new Blob([recorder.serialize()], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'live-gaze-diagnostic.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setExportError('');
}

export default function ScreenCalibration({
  experimentMode = false,
  modelReady = false,
  cameraAvailable,
  videoPlaybackState,
  sessionRef,
  liveDiagnosticRecorderRef,
  startCalibration,
  startGuidedCalibration,
  startLiveGazeDiagnosticRecording,
  setLiveGazeDiagnosticStage,
  endLiveGazeDiagnosticStage,
  stopLiveGazeDiagnosticRecording,
  cancelCalibration,
  restartCalibration,
  repeatCalibrationTarget,
  startKeyboardEvaluation,
  startOffscreenCalibration,
  completeCalibration,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [exportError, setExportError] = useState('');
  const [voiceMode, setVoiceMode] = useState('idle');
  const [voicePhase, setVoicePhase] = useState('idle');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [liveDiagnosticMode, setLiveDiagnosticMode] = useState('idle');
  const [liveDiagnosticPhase, setLiveDiagnosticPhase] = useState('idle');
  const [liveDiagnosticStep, setLiveDiagnosticStep] = useState(0);
  const [liveDiagnosticError, setLiveDiagnosticError] = useState('');
  const voiceRunRef = useRef(0);
  const voiceInitializingRef = useRef(false);
  const voiceTimerRef = useRef(null);
  const voiceUtteranceRef = useRef(null);
  const voiceSynthesisRef = useRef(null);
  const voiceAvailabilityCleanupRef = useRef(null);
  const liveDiagnosticRunRef = useRef(0);
  const liveDiagnosticTimerRef = useRef(null);
  const liveDiagnosticSynthesisRef = useRef(null);
  const liveDiagnosticVoiceRef = useRef(null);
  const voiceRef = useRef(null);
  const audioContextRef = useRef(null);
  const mountedRef = useRef(false);
  const trackingAvailable = experimentMode
    ? cameraAvailable
    : cameraAvailable && videoPlaybackState === 'playing';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      voiceRunRef.current += 1;
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
      }
      voiceAvailabilityCleanupRef.current?.();
      voiceSynthesisRef.current?.cancel();
      liveDiagnosticRunRef.current += 1;
      if (liveDiagnosticTimerRef.current !== null) {
        window.clearTimeout(liveDiagnosticTimerRef.current);
      }
      liveDiagnosticSynthesisRef.current?.cancel();
      if (liveDiagnosticRecorderRef?.current?.getSnapshot().recording) {
        stopLiveGazeDiagnosticRecording?.();
      }
      audioContextRef.current?.close?.();
      sessionRef?.current?.pauseGuided?.();
    };
  }, [liveDiagnosticRecorderRef, sessionRef, stopLiveGazeDiagnosticRecording]);

  useEffect(() => {
    if (!sessionRef) return undefined;
    function refresh() {
      const session = sessionRef.current;
      if (!session) return;
      const next = session.tick(performance.now());
      setSnapshot(next);
    }

    refresh();
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [sessionRef]);

  useEffect(() => {
    if (trackingAvailable || !sessionRef?.current) return;
    sessionRef.current.interrupt();
    setSnapshot(sessionRef.current.getSnapshot(performance.now()));
  }, [trackingAvailable, sessionRef]);

  useEffect(() => {
    if (trackingAvailable || !['active', 'paused', 'checking'].includes(voiceMode)) return;
    voiceRunRef.current += 1;
    voiceInitializingRef.current = false;
    clearVoiceTimer();
    voiceAvailabilityCleanupRef.current?.();
    voiceSynthesisRef.current?.cancel();
    setVoiceMode('error');
    setVoicePhase('error');
    setVoiceMessage('המצלמה נותקה. הפעילו אותה מחדש והתחילו שוב או עברו לכיול ידני.');
  }, [trackingAvailable, voiceMode]);

  function refreshSnapshot() {
    setSnapshot(sessionRef?.current?.getSnapshot(performance.now()) ?? null);
  }

  function clearVoiceTimer() {
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }

  function scheduleVoiceAction(runId, callback, delay) {
    clearVoiceTimer();
    voiceTimerRef.current = window.setTimeout(() => {
      voiceTimerRef.current = null;
      if (!mountedRef.current || voiceRunRef.current !== runId) return;
      callback();
    }, delay);
  }

  function createTone(frequency) {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') return false;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      return true;
    } catch {
      return false;
    }
  }

  function failVoiceCalibration(message) {
    voiceRunRef.current += 1;
    clearVoiceTimer();
    voiceSynthesisRef.current?.cancel();
    sessionRef?.current?.pauseGuided?.();
    refreshSnapshot();
    setVoiceMode('error');
    setVoicePhase('error');
    setVoiceMessage(message);
  }

  function speakCurrentVoiceStep(runId) {
    if (!mountedRef.current || voiceRunRef.current !== runId) return;
    let current = sessionRef?.current?.getSnapshot(performance.now());
    if (current?.status === 'awaiting-keyboard-or-offscreen-or-complete') {
      if (!startOffscreenCalibration?.()) {
        failVoiceCalibration('לא ניתן להמשיך לכיול המבטים מחוץ למסך. אפשר להתחיל כיול מחדש.');
        return;
      }
      current = sessionRef.current.getSnapshot(performance.now());
      refreshSnapshot();
    }
    if (current?.status === 'complete') {
      setVoiceMode('complete');
      setVoicePhase('complete');
      setVoiceMessage('הכיול הקולי הסתיים.');
      return;
    }

    const instruction = getVoiceInstruction(current?.target);
    const Utterance = window.SpeechSynthesisUtterance;
    if (!instruction || typeof Utterance !== 'function' || !voiceRef.current) {
      failVoiceCalibration('לא ניתן להשמיע את הוראות הכיול. אפשר להמשיך בכיול ידני.');
      return;
    }

    const utterance = new Utterance(instruction);
    utterance.lang = 'he-IL';
    utterance.voice = voiceRef.current;
    utterance.rate = 0.9;
    utterance.onend = () => {
      if (!mountedRef.current || voiceRunRef.current !== runId) return;
      voiceUtteranceRef.current = null;
      setVoicePhase('settling');
      scheduleVoiceAction(runId, () => {
        if (!createTone(560)) {
          failVoiceCalibration('לא ניתן להשמיע את צליל תחילת המדידה. אפשר להמשיך בכיול ידני.');
          return;
        }
        if (!sessionRef?.current?.beginGuidedCollection(performance.now())) {
          failVoiceCalibration('הכיול נעצר לפני תחילת המדידה. אפשר להתחיל מחדש או לעבור לכיול ידני.');
          return;
        }
        refreshSnapshot();
        setVoicePhase('recording');
        scheduleVoiceAction(runId, () => {
          if (!createTone(760)) {
            failVoiceCalibration('לא ניתן להשמיע את צליל סיום המדידה. אפשר להמשיך בכיול ידני.');
            return;
          }
          if (!sessionRef?.current?.finishGuidedTarget(performance.now())) {
            failVoiceCalibration('לא ניתן לסיים את שלב הכיול. אפשר להתחיל מחדש או לעבור לכיול ידני.');
            return;
          }
          let next = sessionRef.current.getSnapshot(performance.now());
          if (next.status === 'awaiting-keyboard-or-offscreen-or-complete') {
            if (!startOffscreenCalibration?.()) {
              failVoiceCalibration('לא ניתן להמשיך לכיול המבטים מחוץ למסך. אפשר להתחיל כיול מחדש.');
              return;
            }
            next = sessionRef.current.getSnapshot(performance.now());
          }
          refreshSnapshot();
          if (next.status === 'complete') {
            setVoiceMode('complete');
            setVoicePhase('complete');
            setVoiceMessage('הכיול הקולי הסתיים.');
            return;
          }
          setVoicePhase(next.status === 'needs-repeat' ? 'repeat' : 'speaking');
          speakCurrentVoiceStep(runId);
        }, VOICE_RECORDING_DURATION_MS);
      }, VOICE_SETTLING_DELAY_MS);
    };
    utterance.onerror = (event) => {
      if (!mountedRef.current || voiceRunRef.current !== runId) return;
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      failVoiceCalibration('אירעה שגיאה בהשמעת ההוראות. אפשר להפעיל שוב או להמשיך בכיול ידני.');
    };
    voiceUtteranceRef.current = utterance;
    setVoicePhase('speaking');
    voiceSynthesisRef.current.speak(utterance);
  }

  async function beginVoiceCalibration() {
    if (!trackingAvailable || voiceInitializingRef.current) return;
    voiceInitializingRef.current = true;
    const runId = voiceRunRef.current + 1;
    voiceRunRef.current = runId;
    setVoiceMode('checking');
    const synthesis = window.speechSynthesis;
    if (
      !synthesis
      || typeof synthesis.speak !== 'function'
      || typeof synthesis.cancel !== 'function'
      || typeof window.SpeechSynthesisUtterance !== 'function'
    ) {
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('הדפדפן אינו תומך בהקראה קולית בעברית. אפשר להשתמש בכיול הידני.');
      return;
    }

    setVoicePhase('checking');
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('הדפדפן אינו תומך בהשמעת צלילי הסימון. אפשר להמשיך בכיול הידני.');
      return;
    }
    let audioResume;
    try {
      audioContextRef.current ??= new AudioContextConstructor();
      audioResume = audioContextRef.current.resume();
    } catch {
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('לא ניתן להפעיל צלילי סימון בדפדפן. אפשר להמשיך בכיול הידני.');
      return;
    }

    const voice = await getHebrewVoice(
      synthesis,
      (cleanup) => { voiceAvailabilityCleanupRef.current = cleanup; },
    );
    if (!mountedRef.current || voiceRunRef.current !== runId) return;
    if (!voice) {
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('לא נמצא בדפדפן קול בעברית. אפשר להוסיף קול עברי בהגדרות המכשיר או להשתמש בכיול הידני.');
      return;
    }

    try {
      await audioResume;
    } catch {
      if (!mountedRef.current || voiceRunRef.current !== runId) return;
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('לא ניתן להפעיל צלילי סימון בדפדפן. אפשר להמשיך בכיול הידני.');
      return;
    }
    if (!mountedRef.current || voiceRunRef.current !== runId) return;

    voiceSynthesisRef.current = synthesis;
    voiceRef.current = voice;
    if (!startGuidedCalibration?.()) {
      voiceInitializingRef.current = false;
      setVoiceMode('error');
      setVoicePhase('error');
      setVoiceMessage('המצלמה אינה זמינה. הפעילו אותה ואז התחילו את הכיול הקולי.');
      return;
    }
    voiceInitializingRef.current = false;
    setVoiceMode('active');
    setVoiceMessage('');
    refreshSnapshot();
    speakCurrentVoiceStep(runId);
  }

  function pauseVoiceCalibration() {
    if (voiceMode !== 'active') return;
    voiceRunRef.current += 1;
    clearVoiceTimer();
    voiceSynthesisRef.current?.cancel();
    sessionRef?.current?.pauseGuided?.();
    setVoiceMode('paused');
    setVoicePhase('paused');
    setVoiceMessage('הכיול מושהה. בהמשך, ההוראה לשלב הנוכחי תושמע שוב.');
    refreshSnapshot();
  }

  function resumeVoiceCalibration() {
    if (voiceMode !== 'paused' || !sessionRef?.current?.resumeGuided?.()) return;
    voiceRunRef.current += 1;
    setVoiceMode('active');
    setVoiceMessage('');
    refreshSnapshot();
    speakCurrentVoiceStep(voiceRunRef.current);
  }

  function restartVoiceCalibration() {
    voiceInitializingRef.current = false;
    voiceRunRef.current += 1;
    clearVoiceTimer();
    voiceSynthesisRef.current?.cancel();
    if (!startGuidedCalibration?.()) return;
    voiceRunRef.current += 1;
    setVoiceMode('active');
    setVoiceMessage('');
    refreshSnapshot();
    speakCurrentVoiceStep(voiceRunRef.current);
  }

  function clearLiveDiagnosticTimer() {
    if (liveDiagnosticTimerRef.current !== null) {
      window.clearTimeout(liveDiagnosticTimerRef.current);
      liveDiagnosticTimerRef.current = null;
    }
  }

  function scheduleLiveDiagnosticAction(runId, callback, delay) {
    clearLiveDiagnosticTimer();
    liveDiagnosticTimerRef.current = window.setTimeout(() => {
      liveDiagnosticTimerRef.current = null;
      if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
      callback();
    }, delay);
  }

  function finishLiveDiagnostic(runId, cancelled = false) {
    if (liveDiagnosticRunRef.current !== runId) return;
    clearLiveDiagnosticTimer();
    liveDiagnosticSynthesisRef.current?.cancel();
    if (liveDiagnosticRecorderRef?.current?.getSnapshot().recording) {
      endLiveGazeDiagnosticStage?.();
      stopLiveGazeDiagnosticRecording?.();
    }
    setLiveDiagnosticMode(cancelled ? 'cancelled' : 'complete');
    setLiveDiagnosticPhase(cancelled ? 'cancelled' : 'complete');
    setLiveDiagnosticStep(cancelled ? liveDiagnosticStep : LIVE_DIAGNOSTIC_STAGES.length);
  }

  function failLiveDiagnostic(message) {
    liveDiagnosticRunRef.current += 1;
    clearLiveDiagnosticTimer();
    liveDiagnosticSynthesisRef.current?.cancel();
    if (liveDiagnosticRecorderRef?.current?.getSnapshot().recording) {
      endLiveGazeDiagnosticStage?.();
      stopLiveGazeDiagnosticRecording?.();
    }
    setLiveDiagnosticMode('error');
    setLiveDiagnosticPhase('error');
    setLiveDiagnosticError(message);
  }

  function speakLiveDiagnosticStage(runId, stageIndex) {
    if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
    if (stageIndex >= LIVE_DIAGNOSTIC_STAGES.length) {
      finishLiveDiagnostic(runId);
      return;
    }
    const stage = LIVE_DIAGNOSTIC_STAGES[stageIndex];
    const Utterance = window.SpeechSynthesisUtterance;
    if (!Utterance || !liveDiagnosticVoiceRef.current) {
      failLiveDiagnostic('לא ניתן להשמיע את הוראות בדיקת המבט. אפשר לנסות שוב לאחר בדיקת התמיכה בקול עברי.');
      return;
    }
    setLiveDiagnosticStep(stageIndex + 1);
    setLiveDiagnosticPhase('speaking');
    const utterance = new Utterance(stage.instruction);
    utterance.lang = 'he-IL';
    utterance.voice = liveDiagnosticVoiceRef.current;
    utterance.rate = 0.9;
    utterance.onend = () => {
      if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
      setLiveDiagnosticPhase('settling');
      scheduleLiveDiagnosticAction(runId, () => {
        if (!createTone(560)) {
          failLiveDiagnostic('לא ניתן להשמיע את צליל תחילת המדידה. בדקו את הגדרות השמע ונסו שוב.');
          return;
        }
        if (!setLiveGazeDiagnosticStage?.(stage)) {
          failLiveDiagnostic('לא ניתן להתחיל את שלב ההקלטה. בדקו שהמצלמה פעילה ונסו שוב.');
          return;
        }
        setLiveDiagnosticPhase('recording');
        scheduleLiveDiagnosticAction(runId, () => {
          endLiveGazeDiagnosticStage?.();
          if (!createTone(760)) {
            failLiveDiagnostic('לא ניתן להשמיע את צליל סיום המדידה.');
            return;
          }
          speakLiveDiagnosticStage(runId, stageIndex + 1);
        }, LIVE_DIAGNOSTIC_RECORDING_MS);
      }, 1500);
    };
    utterance.onerror = (event) => {
      if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
      if (event.error === 'canceled' || event.error === 'interrupted') {
        finishLiveDiagnostic(runId, true);
        return;
      }
      failLiveDiagnostic('אירעה שגיאה בהשמעת הוראות בדיקת המבט. אפשר לנסות שוב.');
    };
    liveDiagnosticSynthesisRef.current.speak(utterance);
  }

  async function beginLiveDiagnostic() {
    if (!trackingAvailable || liveDiagnosticMode === 'active') return;
    const synthesis = window.speechSynthesis;
    if (
      !synthesis
      || typeof synthesis.speak !== 'function'
      || typeof synthesis.cancel !== 'function'
      || typeof window.SpeechSynthesisUtterance !== 'function'
    ) {
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('הדפדפן אינו תומך בהקראה קולית בעברית, ולכן בדיקת המבט לא התחילה.');
      return;
    }
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('הדפדפן אינו תומך בצלילי הסימון, ולכן בדיקת המבט לא התחילה.');
      return;
    }

    const runId = liveDiagnosticRunRef.current + 1;
    liveDiagnosticRunRef.current = runId;
    setLiveDiagnosticMode('checking');
    setLiveDiagnosticError('');
    let audioResume;
    try {
      audioContextRef.current ??= new AudioContextConstructor();
      audioResume = audioContextRef.current.resume();
    } catch {
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('לא ניתן להפעיל את השמע בדפדפן.');
      return;
    }
    const voice = await getHebrewVoice(
      synthesis,
      (cleanup) => { voiceAvailabilityCleanupRef.current = cleanup; },
    );
    if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
    if (!voice) {
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('לא נמצא בדפדפן קול בעברית. בדיקת המבט לא התחילה.');
      return;
    }
    try {
      await audioResume;
    } catch {
      if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('לא ניתן להפעיל את צלילי הסימון. בדיקת המבט לא התחילה.');
      return;
    }
    if (!mountedRef.current || liveDiagnosticRunRef.current !== runId) return;
    if (!startLiveGazeDiagnosticRecording?.()) {
      setLiveDiagnosticMode('error');
      setLiveDiagnosticPhase('error');
      setLiveDiagnosticError('המצלמה אינה זמינה. הפעילו אותה לפני הקלטת בדיקת המבט.');
      return;
    }
    liveDiagnosticSynthesisRef.current = synthesis;
    liveDiagnosticVoiceRef.current = voice;
    setLiveDiagnosticMode('active');
    setLiveDiagnosticPhase('speaking');
    speakLiveDiagnosticStage(runId, 0);
  }

  function cancelLiveDiagnostic() {
    if (liveDiagnosticMode !== 'active' && liveDiagnosticMode !== 'checking') return;
    liveDiagnosticRunRef.current += 1;
    clearLiveDiagnosticTimer();
    voiceAvailabilityCleanupRef.current?.();
    liveDiagnosticSynthesisRef.current?.cancel();
    if (liveDiagnosticRecorderRef?.current?.getSnapshot().recording) {
      endLiveGazeDiagnosticStage?.();
      stopLiveGazeDiagnosticRecording?.();
    }
    setLiveDiagnosticMode('cancelled');
    setLiveDiagnosticPhase('cancelled');
  }

  function restartLiveDiagnostic() {
    cancelLiveDiagnostic();
    setLiveDiagnosticMode('idle');
    setLiveDiagnosticPhase('idle');
    setLiveDiagnosticStep(0);
    setLiveDiagnosticError('');
    beginLiveDiagnostic();
  }

  function beginManualFallback() {
    voiceInitializingRef.current = false;
    voiceRunRef.current += 1;
    clearVoiceTimer();
    voiceAvailabilityCleanupRef.current?.();
    voiceSynthesisRef.current?.cancel();
    if (voiceMode === 'active' || voiceMode === 'paused') {
      sessionRef?.current?.cancel();
    }
    setVoiceMode('manual');
    setVoicePhase('idle');
    setVoiceMessage('');
    begin();
  }

  function begin() {
    if (startCalibration?.()) {
      setExportError('');
      refreshSnapshot();
    }
  }

  function cancel() {
    cancelCalibration?.();
    refreshSnapshot();
  }

  function restart() {
    if (restartCalibration?.()) {
      setExportError('');
      refreshSnapshot();
    }
  }

  function repeat() {
    repeatCalibrationTarget?.();
    refreshSnapshot();
  }

  function beginKeyboard() {
    startKeyboardEvaluation?.();
    refreshSnapshot();
  }

  function beginOffscreen() {
    if (startOffscreenCalibration?.()) {
      setExportError('');
      refreshSnapshot();
    }
  }

  function finishWithoutKeyboard() {
    completeCalibration?.();
    refreshSnapshot();
  }

  const status = snapshot?.status || 'idle';
  const currentTarget = snapshot?.target;
  useEffect(() => {
    if (
      !experimentMode
      || status !== 'awaiting-keyboard-or-offscreen-or-complete'
      || !startOffscreenCalibration?.()
    ) return;
    refreshSnapshot();
  }, [experimentMode, startOffscreenCalibration, status]);

  const showingTarget = Boolean(
    currentTarget
    && (
      isActiveStatus(status)
      || status === 'needs-repeat'
      || status === 'guided-transition'
      || status === 'guided-paused'
    ),
  );
  const progressCount = status === 'awaiting-keyboard-or-offscreen-or-complete'
    || status === 'awaiting-offscreen-or-complete'
    || status === 'complete'
      ? CALIBRATION_TARGETS.length
      : Math.min(snapshot?.targetIndex ?? 0, CALIBRATION_TARGETS.length);
  const targetSummary = currentTarget
    ? snapshot?.phase === 'offscreen'
      ? snapshot?.collector?.offscreenTargets?.[currentTarget.label]
      : snapshot?.collector?.targets?.[currentTarget.label]
    : null;
  const canExport = Boolean(
    snapshot?.collector
    && (
      Object.values(snapshot.collector.targets).some(
        (target) => target.acceptedSampleCount || target.rejectedSampleCount,
      )
      || snapshot.collector.keyboardEvaluation.acceptedSampleCount
      || snapshot.collector.keyboardEvaluation.rejectedSampleCount
      || Object.values(snapshot.collector.offscreenTargets ?? {}).some(
        (target) => target.acceptedSampleCount || target.rejectedSampleCount,
      )
    ),
  );
  const liveDiagnosticSnapshot = liveDiagnosticRecorderRef?.current?.getSnapshot();
  const canExportLiveDiagnostic = Boolean(liveDiagnosticSnapshot?.sampleCount);

  if (experimentMode) {
    const offscreenIndex = OFFSCREEN_STEP_ORDER.indexOf(currentTarget?.label);
    const stepNumber = status === 'complete'
      ? TOTAL_GUIDED_STEPS
      : currentTarget && snapshot?.phase === 'offscreen'
      ? CALIBRATION_TARGETS.length
        + offscreenIndex * 2
        + (currentTarget.movementMode === 'head' ? 2 : 1)
      : Math.min((snapshot?.targetIndex ?? 0) + 1, CALIBRATION_TARGETS.length);
    const showStepCount = status !== 'complete' || voiceMode === 'complete';
    const instruction = currentTarget
      ? [
        TARGET_INSTRUCTIONS[currentTarget.label],
        currentTarget.movementMode
          ? MOVEMENT_MODE_INSTRUCTIONS[currentTarget.movementMode]
          : null,
      ].filter(Boolean).join(' — ')
      : 'הביטו בנקודות שיופיעו על המסך ופעלו לפי ההנחיות.';
    const isActive = isActiveStatus(status);
    const showModelReady = modelReady
      && !['active', 'paused', 'checking', 'error'].includes(voiceMode);

    return (
      <>
        <section className="screen-calibration screen-calibration--experiment" aria-label="כיול מודרך">
          {showModelReady ? (
            <div className="gaze-calibration-complete">
              <span>הכיול הושלם</span>
              <button
                className="gaze-calibration-restart"
                type="button"
                onClick={voiceRef.current ? restartVoiceCalibration : restart}
                disabled={!trackingAvailable}
              >
                התחלת כיול מחדש
              </button>
            </div>
          ) : (
            <>
              <div className="gaze-calibration-heading">
                <strong>כיול אישי</strong>
                <span>ממתין להשלמת כיול</span>
              </div>
              {showStepCount && (
                <>
                  <p className="gaze-calibration-step-count">
                    שלב {stepNumber} מתוך {TOTAL_GUIDED_STEPS}
                    {isActive && voiceMode !== 'active' && ` · ${snapshot.secondsRemaining} שניות`}
                  </p>
                  <progress
                    className="gaze-calibration-progress"
                    value={Math.max(0, stepNumber - (isActive ? 1 : 0))}
                    max={TOTAL_GUIDED_STEPS}
                    aria-label={`התקדמות הכיול: שלב ${stepNumber} מתוך ${TOTAL_GUIDED_STEPS}`}
                  />
                </>
              )}
              <p className="gaze-calibration-instruction" role="status" aria-live="polite">
                {status === 'idle'
                  ? cameraAvailable
                    ? instruction
                    : 'הפעילו את המצלמה כדי להתחיל את הכיול.'
                  : status === 'needs-repeat'
                    ? 'לא התקבלו מספיק מדידות יציבות. יש לחזור על השלב הזה.'
                    : status === 'interrupted'
                      ? 'הכיול נעצר. הפעילו מחדש את המצלמה והתחילו שוב.'
                      : status === 'cancelled'
                        ? 'הכיול בוטל. אפשר להתחיל אותו מחדש.'
                        : status === 'complete' && voiceMode === 'complete'
                          ? 'הכיול הסתיים. אפשר להתחיל בבדיקת המבט.'
                          : status === 'complete'
                          ? 'הכיול הסתיים, אך אין עדיין מספיק מדידות תקינות. בדקו את התאורה והמיקום והתחילו מחדש.'
                          : instruction}
              </p>
              {status === 'idle' && (
                <div className="gaze-calibration-actions">
                  <button
                    className="gaze-calibration-primary"
                    type="button"
                    onClick={beginVoiceCalibration}
                    disabled={!trackingAvailable || voiceMode === 'checking'}
                  >
                    התחלת כיול קולי
                  </button>
                  <button
                    className="gaze-calibration-manual"
                    type="button"
                    onClick={beginManualFallback}
                    disabled={!trackingAvailable}
                  >
                    התחלת כיול
                  </button>
                </div>
              )}
              {voiceMode === 'active' && (
                <div className="gaze-calibration-actions">
                  <button className="gaze-calibration-manual" type="button" onClick={pauseVoiceCalibration}>
                    השהיה
                  </button>
                  <button className="gaze-calibration-manual" type="button" onClick={restartVoiceCalibration}>
                    התחלה מחדש
                  </button>
                </div>
              )}
              {voiceMode === 'paused' && (
                <div className="gaze-calibration-actions">
                  <button className="gaze-calibration-primary" type="button" onClick={resumeVoiceCalibration}>
                    המשך
                  </button>
                  <button className="gaze-calibration-manual" type="button" onClick={restartVoiceCalibration}>
                    התחלה מחדש
                  </button>
                </div>
              )}
              {voiceMode === 'error' && (
                <div className="gaze-calibration-actions">
                  <button className="gaze-calibration-primary" type="button" onClick={beginManualFallback}>
                    מעבר לכיול ידני
                  </button>
                  <button className="gaze-calibration-manual" type="button" onClick={beginVoiceCalibration}>
                    ניסיון קולי נוסף
                  </button>
                </div>
              )}
              {voiceMode === 'complete' && (
                <button className="gaze-calibration-manual" type="button" onClick={restartVoiceCalibration}>
                  התחלה מחדש
                </button>
              )}
              {voiceMode !== 'idle' && voiceMode !== 'manual' && (
                <p className={`gaze-calibration-voice-state gaze-calibration-voice-state--${voicePhase}`} role="status">
                  {voiceMode === 'error'
                    ? voiceMessage
                    : voiceMode === 'paused'
                      ? voiceMessage
                      : voiceMode === 'complete'
                        ? voiceMessage
                        : voicePhase === 'checking'
                          ? 'בודקות זמינות של קול עברי…'
                          : voicePhase === 'speaking'
                            ? 'מושמעות הוראות — אין איסוף מדידות'
                            : voicePhase === 'settling'
                              ? 'ההוראה הסתיימה. אפשר להזיז את המבט'
                              : voicePhase === 'recording'
                                ? 'אוספים מדידות עכשיו'
                                : voiceMessage}
                </p>
              )}
              {status === 'needs-repeat' && voiceMode !== 'active' && (
                <button
                  className="gaze-calibration-primary"
                  type="button"
                  onClick={repeat}
                  disabled={!trackingAvailable}
                >
                  חזרה על השלב
                </button>
              )}
              {(status === 'interrupted' || status === 'cancelled'
                || (status === 'complete' && !showModelReady && voiceMode === 'manual')) && (
                  <button
                    className="gaze-calibration-restart"
                    type="button"
                    onClick={restart}
                    disabled={!trackingAvailable}
                  >
                    התחלה מחדש
                  </button>
              )}
            </>
          )}
          {modelReady && voiceMessage && (
            <p className="gaze-calibration-voice-state" role="status">{voiceMessage}</p>
          )}
          <div className="gaze-live-diagnostic">
            {liveDiagnosticMode === 'idle' && (
              <button
                className="gaze-live-diagnostic-button"
                type="button"
                onClick={beginLiveDiagnostic}
                disabled={
                  !trackingAvailable
                  || ['active', 'paused', 'checking'].includes(voiceMode)
                  || ['countdown', 'collecting', 'guided-transition'].includes(status)
                }
              >
                הקלטת בדיקת מבט
              </button>
            )}
            {liveDiagnosticMode === 'checking' && (
              <>
                <p className="gaze-calibration-voice-state" role="status">
                  בודקות זמינות של קול עברי לפני תחילת הבדיקה…
                </p>
                <button className="gaze-calibration-manual" type="button" onClick={cancelLiveDiagnostic}>
                  ביטול הבדיקה
                </button>
              </>
            )}
            {liveDiagnosticMode === 'active' && (
              <>
                <p className="gaze-calibration-step-count" role="status">
                  שלב {liveDiagnosticStep} מתוך {LIVE_DIAGNOSTIC_STAGES.length}
                  {' · '}
                  {liveDiagnosticPhase === 'speaking'
                    ? 'מושמעות הוראות — אין איסוף'
                    : liveDiagnosticPhase === 'settling'
                      ? 'המתנה לתנועת המבט — אין איסוף'
                      : 'הקלטת מדידות'}
                </p>
                <progress
                  className="gaze-calibration-progress"
                  value={liveDiagnosticStep - (liveDiagnosticPhase === 'recording' ? 0 : 1)}
                  max={LIVE_DIAGNOSTIC_STAGES.length}
                  aria-label={`התקדמות בדיקת המבט: שלב ${liveDiagnosticStep} מתוך ${LIVE_DIAGNOSTIC_STAGES.length}`}
                />
                <button className="gaze-calibration-manual" type="button" onClick={cancelLiveDiagnostic}>
                  ביטול הבדיקה
                </button>
              </>
            )}
            {liveDiagnosticMode === 'error' && (
              <>
                <p className="gaze-calibration-voice-state" role="alert">{liveDiagnosticError}</p>
                {canExportLiveDiagnostic && (
                  <button
                    className="gaze-live-diagnostic-button"
                    type="button"
                    onClick={() => exportLiveDiagnostic(liveDiagnosticRecorderRef, setExportError)}
                  >
                    הורדת תוצאות חלקיות (JSON)
                  </button>
                )}
                <button
                  className="gaze-live-diagnostic-button"
                  type="button"
                  onClick={() => {
                    setLiveDiagnosticMode('idle');
                    setLiveDiagnosticPhase('idle');
                    beginLiveDiagnostic();
                  }}
                  disabled={!trackingAvailable}
                >
                  ניסיון נוסף
                </button>
              </>
            )}
            {(liveDiagnosticMode === 'complete' || liveDiagnosticMode === 'cancelled') && (
              <>
                <p className="gaze-calibration-voice-state" role="status">
                  {liveDiagnosticMode === 'complete'
                    ? `בדיקת המבט הסתיימה. נשמרו ${liveDiagnosticSnapshot?.sampleCount ?? 0} דגימות.`
                    : `הבדיקה בוטלה. נשמרו ${liveDiagnosticSnapshot?.sampleCount ?? 0} דגימות עד הביטול.`}
                </p>
                {liveDiagnosticSnapshot?.stageSummaries?.map((stage) => (
                  <p className="gaze-calibration-step-count" key={stage.id}>
                    {stage.expectedLabel}: מצב גולמי {stage.rawClassifierStateCounts.LOOKING_AT_SCREEN}/{stage.rawClassifierStateCounts.LOOKING_AWAY}/{stage.rawClassifierStateCounts.UNKNOWN}
                    {' · '}מצב מוחלק {stage.smoothedStateCounts.LOOKING_AT_SCREEN}/{stage.smoothedStateCounts.LOOKING_AWAY}/{stage.smoothedStateCounts.UNKNOWN}
                  </p>
                ))}
                <div className="gaze-calibration-actions">
                  <button
                    className="gaze-live-diagnostic-button"
                    type="button"
                    onClick={() => exportLiveDiagnostic(liveDiagnosticRecorderRef, setExportError)}
                    disabled={!canExportLiveDiagnostic}
                  >
                    הורדת תוצאות בדיקת מבט (JSON)
                  </button>
                  <button className="gaze-calibration-manual" type="button" onClick={restartLiveDiagnostic}>
                    בדיקה חדשה
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            className="gaze-calibration-download"
            type="button"
            onClick={() => exportCalibration(sessionRef, setExportError)}
            disabled={!canExport}
          >
            הורדת נתוני כיול (JSON)
          </button>
          {exportError && <p role="alert" className="screen-calibration-error">{exportError}</p>}
        </section>
        {showingTarget
          && Number.isFinite(currentTarget?.xPercent)
          && Number.isFinite(currentTarget?.yPercent)
          && createPortal(
            <div className="screen-calibration-overlay" aria-label="מטרת כיול במסך">
              <span
                className="screen-calibration-viewport-target"
                style={{
                  left: `${currentTarget.xPercent}vw`,
                  top: `${currentTarget.yPercent}vh`,
                }}
                aria-hidden="true"
              />
            </div>,
            document.body,
          )}
      </>
    );
  }

  return (
    <>
      <section className="screen-calibration" aria-label="איסוף נתוני כיול ניסיוני">
        <div className="eye-gaze-diagnostic-heading">
          <strong>איסוף נתוני כיול ניסיוני</strong>
          <span>מקומי בלבד · כיול אישי ניסיוני</span>
        </div>
        <p className="screen-calibration-description">
          הביטו בכל נקודת מסך למשך כ־4 שניות. אחר כך אספו דוגמאות מבט מחוץ למסך — תחילה בעיניים בלבד ואז עם תנועת ראש.
        </p>
        <div className="screen-calibration-controls">
          <button type="button" onClick={begin} disabled={!trackingAvailable || status !== 'idle'}>
            התחלת כיול
          </button>
          <button type="button" onClick={cancel} disabled={!isActiveStatus(status) && status !== 'needs-repeat' && status !== 'awaiting-keyboard-or-offscreen-or-complete' && status !== 'awaiting-offscreen-or-complete'}>
            ביטול
          </button>
          <button type="button" onClick={restart} disabled={!trackingAvailable}>
            התחלה מחדש
          </button>
        </div>
        <p className={`screen-calibration-status screen-calibration-status--${status}`} role="status">
          {STATUS_LABELS[status] || STATUS_LABELS.idle}
        </p>
        <div className="screen-calibration-progress" aria-label={`התקדמות ${progressCount} מתוך ${CALIBRATION_TARGETS.length}`}>
          {CALIBRATION_TARGETS.map(({ label }, index) => {
            const target = snapshot?.collector?.targets?.[label];
            return (
              <span
                key={label}
                className={index < progressCount ? 'screen-calibration-progress--complete' : ''}
                aria-label={`${label}: ${target?.acceptedSampleCount ?? 0} מדידות אמינות, ${target?.rejectedSampleCount ?? 0} שנדחו`}
              >
                {label}
              </span>
            );
          })}
        </div>
        {currentTarget && (
          <p className="screen-calibration-current-target">
            יעד: <strong>{currentTarget.label}</strong>
            {isActiveStatus(status) && ` · ${snapshot.secondsRemaining} שניות`}
            {snapshot.phase === 'offscreen' && currentTarget.movementMode && (
              ` · ${MOVEMENT_MODE_INSTRUCTIONS[currentTarget.movementMode]}`
            )}
            {status === 'needs-repeat'
              && ` · ${targetSummary?.acceptedSampleCount ?? 0}/${snapshot.minimumReliableSamples} אמינות`}
          </p>
        )}
        {snapshot?.collector?.offscreenTargets && (
          <p className="screen-calibration-keyboard-counts">
            דוגמאות מחוץ למסך:
            {' '}{Object.values(snapshot.collector.offscreenTargets)
              .reduce((sum, target) => sum + target.acceptedSampleCount, 0)} התקבלו
          </p>
        )}
        {status === 'needs-repeat' && (
          <button className="screen-calibration-secondary" type="button" onClick={repeat} disabled={!trackingAvailable}>
            חזרה על היעד
          </button>
        )}
        {(status === 'awaiting-keyboard-or-offscreen-or-complete'
          || status === 'awaiting-offscreen-or-complete') && (
          <div className="screen-calibration-controls">
            {status === 'awaiting-keyboard-or-offscreen-or-complete' && (
              <button type="button" onClick={beginKeyboard} disabled={!trackingAvailable}>
                בדיקת מקלדת אופציונלית
              </button>
            )}
            <button type="button" onClick={beginOffscreen} disabled={!trackingAvailable}>
              {status === 'awaiting-offscreen-or-complete'
                ? 'המשך לדוגמאות מבט מחוץ למסך'
                : 'כיול מבטים מחוץ למסך'}
            </button>
            <button type="button" onClick={finishWithoutKeyboard}>
              סיום הכיול
            </button>
          </div>
        )}
        {status === 'complete' && snapshot.phase === 'keyboard' && (
          <p className="screen-calibration-current-target">
            בדיקת המקלדת נשמרת בנפרד ואינה חלק מנתוני יעדי המסך.
          </p>
        )}
        {snapshot?.collector?.keyboardEvaluation && (
          <p className="screen-calibration-keyboard-counts">
            דגימות אבחון למקלדת: {snapshot.collector.keyboardEvaluation.acceptedSampleCount} התקבלו,
            {' '}{snapshot.collector.keyboardEvaluation.rejectedSampleCount} נדחו
          </p>
        )}
        {snapshot?.collector?.diagnosticSummary && (
          <p className="screen-calibration-keyboard-counts">
            מסגרות שנצפו: {snapshot.collector.diagnosticSummary.totalFramesObserved}
            {' · '}תנוחות ראש תקינות: {snapshot.collector.diagnosticSummary.validHeadPoseSampleCount}
            {' · '}מדידות עיניים שמאל/ימין: {snapshot.collector.diagnosticSummary.validLeftEyeMeasurementCount}
            /{snapshot.collector.diagnosticSummary.validRightEyeMeasurementCount}
            {' · '}דגימות Blendshapes: {snapshot.collector.diagnosticSummary.validBlendshapeSampleCount}
          </p>
        )}
        <button
          className="screen-calibration-download"
          type="button"
          onClick={() => exportCalibration(sessionRef, setExportError)}
          disabled={!canExport}
        >
          הורדת דוח כיול JSON
        </button>
        {exportError && <p role="alert" className="screen-calibration-error">{exportError}</p>}
      </section>

      {showingTarget && createPortal(
        <div className="screen-calibration-overlay" aria-label="מטרת כיול במסך">
          <div className="screen-calibration-overlay-instructions" role="status">
            <strong>{currentTarget.label}</strong>
            <span>{TARGET_INSTRUCTIONS[currentTarget.label]}</span>
            {currentTarget.movementMode && (
              <span>{MOVEMENT_MODE_INSTRUCTIONS[currentTarget.movementMode]}</span>
            )}
            {status === 'countdown'
              ? <b>{snapshot.secondsRemaining}</b>
              : status === 'collecting'
                ? <small>{snapshot.secondsRemaining} שניות · {snapshot.acceptedSampleCount} מדידות אמינות</small>
                : <small>נדרשת חזרה על היעד כדי להגיע למינימום</small>}
          </div>
          {Number.isFinite(currentTarget.xPercent) && Number.isFinite(currentTarget.yPercent) && (
            <span
              className="screen-calibration-viewport-target"
              style={{
                left: `${currentTarget.xPercent}vw`,
                top: `${currentTarget.yPercent}vh`,
              }}
              aria-hidden="true"
            />
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
