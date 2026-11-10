import { useEffect, useRef, useState } from 'react';
import {
  assessWebGazerPrediction,
  createWebGazerExperimentRecorder,
  WEBGAZER_STATES,
} from './webGazerExperiment.js';
import './WebGazerExperimentPage.css';

const CALIBRATION_TARGETS = [
  { id: 'CENTER', label: 'מרכז', x: 50, y: 50 },
  { id: 'TOP', label: 'למעלה', x: 50, y: 17 },
  { id: 'BOTTOM', label: 'למטה', x: 50, y: 83 },
  { id: 'LEFT', label: 'שמאלה', x: 17, y: 50 },
  { id: 'RIGHT', label: 'ימינה', x: 83, y: 50 },
];
const CALIBRATION_CLICKS_PER_TARGET = 3;
const SETTLING_DELAY_MS = 1500;
const TEST_STAGE_DURATION_MS = 5000;
const DIAGNOSTIC_SAMPLE_INTERVAL_MS = 200;
const TEST_CONDITIONS = [
  {
    id: 'A_SCREEN_HEAD_STILL',
    expectedCondition: 'A — מסך, ראש יציב',
    expectedState: WEBGAZER_STATES.SCREEN,
    instruction: 'הביטי במרכז המסך והשאירי את הראש יציב.',
  },
  {
    id: 'B_EYES_ONLY_AWAY',
    expectedCondition: 'B — מחוץ למסך, עיניים בלבד',
    expectedState: WEBGAZER_STATES.AWAY,
    instruction: 'הביטי מחוץ למסך בעזרת העיניים בלבד, והשאירי את הראש במקומו.',
  },
  {
    id: 'C_SCREEN_NATURAL_MOVEMENT',
    expectedCondition: 'C — מסך לאחר תנועה טבעית',
    expectedState: WEBGAZER_STATES.SCREEN,
    instruction: 'הביטי שוב במרכז המסך והזיזי מעט את הראש או הגוף באופן טבעי.',
  },
  {
    id: 'D_AWAY_HEAD_TURN',
    expectedCondition: 'D — מחוץ למסך עם סיבוב ראש',
    expectedState: WEBGAZER_STATES.AWAY,
    instruction: 'הביטי מחוץ למסך וסובבי מעט את הראש לכיוון המבט.',
  },
];

function getHebrewVoice(synthesis) {
  return synthesis?.getVoices?.().find((voice) => /^he(?:[-_]|$)/i.test(voice.lang)) ?? null;
}

function stopWebGazer(instance) {
  if (!instance) return;
  instance.clearGazeListener?.();
  instance.removeMouseEventListeners?.();
  if (instance.isReady?.()) {
    instance.end();
    instance.stopVideo();
  }
}

function getScreenBounds() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function downloadExperiment(recorder, setError) {
  if (!recorder || recorder.getSnapshot().sampleCount === 0) return;
  if (typeof URL.createObjectURL !== 'function') {
    setError('הדפדפן אינו תומך בהורדת קובץ JSON.');
    return;
  }
  const file = new Blob([recorder.serialize()], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'webgazer-gaze-experiment.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setError('');
}

export default function WebGazerExperimentPage() {
  const [cameraStatus, setCameraStatus] = useState('off');
  const [cameraError, setCameraError] = useState('');
  const [calibrationIndex, setCalibrationIndex] = useState(-1);
  const [calibrationTargetEnabled, setCalibrationTargetEnabled] = useState(false);
  const [calibrationClickCount, setCalibrationClickCount] = useState(0);
  const [calibratedTargetCount, setCalibratedTargetCount] = useState(0);
  const [calibrationReady, setCalibrationReady] = useState(false);
  const [instruction, setInstruction] = useState('הפעילו את המצלמה כדי להתחיל.');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [testMode, setTestMode] = useState('idle');
  const [testPhase, setTestPhase] = useState('idle');
  const [testStep, setTestStep] = useState(0);
  const [report, setReport] = useState(null);
  const [exportError, setExportError] = useState('');
  const cameraSlotRef = useRef(null);
  const webGazerRef = useRef(null);
  const beginPromiseRef = useRef(null);
  const mountedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const calibrationReadyRef = useRef(false);
  const calibrationBusyRef = useRef(false);
  const predictionHistoryRef = useRef([]);
  const latestEstimateRef = useRef(null);
  const recorderRef = useRef(createWebGazerExperimentRecorder());
  const testRunRef = useRef(0);
  const testTimerRef = useRef(null);
  const sampleTimerRef = useRef(null);
  const synthesisRef = useRef(null);
  const calibrationDelayRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRequestedRef.current = true;
      testRunRef.current += 1;
      window.clearTimeout(testTimerRef.current);
      window.clearInterval(sampleTimerRef.current);
      window.clearTimeout(calibrationDelayRef.current);
      synthesisRef.current?.cancel();
      if (recorderRef.current.getSnapshot().recording) {
        recorderRef.current.stop(performance.now());
      }
      const instance = webGazerRef.current;
      if (instance) {
        try {
          stopWebGazer(instance);
        } catch (error) {
          console.error('Failed to clean up WebGazer camera resources:', error);
        }
      } else if (beginPromiseRef.current) {
        beginPromiseRef.current.then(() => {
          try {
            stopWebGazer(webGazerRef.current);
          } catch (error) {
            console.error('Failed to clean up WebGazer after camera startup:', error);
          }
        }, () => {});
      }
    };
  }, []);

  function updateEstimate(prediction) {
    const now = performance.now();
    if (Number.isFinite(prediction?.x) && Number.isFinite(prediction?.y)) {
      predictionHistoryRef.current.push({
        x: prediction.x,
        y: prediction.y,
        timestamp: now,
      });
    }
    predictionHistoryRef.current = predictionHistoryRef.current.filter((point) => (
      now - point.timestamp <= 1500
    ));
    const nextEstimate = assessWebGazerPrediction({
      prediction,
      history: predictionHistoryRef.current,
      now,
      bounds: getScreenBounds(),
      calibrated: calibrationReadyRef.current,
    });
    latestEstimateRef.current = nextEstimate;
    if (mountedRef.current) setEstimate(nextEstimate);
  }

  async function startCamera() {
    if (cameraStatus === 'loading' || cameraStatus === 'ready') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('הדפדפן אינו תומך בגישה למצלמה.');
      return;
    }
    setCameraStatus('loading');
    setCameraError('');
    stopRequestedRef.current = false;

    try {
      const module = await import('webgazer');
      if (!mountedRef.current || stopRequestedRef.current) return;
      const webgazer = module.default;
      webGazerRef.current = webgazer;
      webgazer.params.faceMeshSolutionPath = `${import.meta.env.BASE_URL}mediapipe/webgazer-face-mesh`;
      webgazer.params.saveDataAcrossSessions = false;
      webgazer.saveDataAcrossSessions(false);
      webgazer.showVideo(true);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);
      webgazer.showPredictionPoints(false);
      webgazer.showVideoPreview(true);
      webgazer.setGazeListener((prediction) => updateEstimate(prediction));

      const pendingStart = webgazer.begin();
      beginPromiseRef.current = pendingStart;
      await pendingStart;
      if (!mountedRef.current || stopRequestedRef.current) {
        stopWebGazer(webgazer);
        return;
      }
      webgazer.removeMouseEventListeners();
      const videoContainer = document.getElementById('webgazerVideoContainer');
      if (videoContainer && cameraSlotRef.current) {
        cameraSlotRef.current.appendChild(videoContainer);
        videoContainer.classList.add('webgazer-experiment-camera-container');
      }
      setCameraStatus('ready');
      setInstruction('התחילו כיול קצר בחמש נקודות. בכל נקודה יש ללחוץ שלוש פעמים.');
    } catch (error) {
      if (webGazerRef.current) {
        try {
          stopWebGazer(webGazerRef.current);
        } catch (cleanupError) {
          console.error('Failed to clean up WebGazer after startup error:', cleanupError);
        }
      }
      if (mountedRef.current && !stopRequestedRef.current) {
        setCameraStatus('error');
        setCameraError(error?.name === 'NotAllowedError'
          ? 'הגישה למצלמה נדחתה. אפשר לאשר אותה בהגדרות הדפדפן ולנסות שוב.'
          : `לא ניתן להפעיל את WebGazer או את המצלמה. ${error?.message || 'בדקו את התאימות ונסו שוב.'}`);
      }
    } finally {
      beginPromiseRef.current = null;
    }
  }

  function stopCamera() {
    stopRequestedRef.current = true;
    synthesisRef.current?.cancel();
    clearTestTimers();
    testRunRef.current += 1;
    if (recorderRef.current.getSnapshot().recording) {
      recorderRef.current.stop(performance.now());
      setReport(recorderRef.current.getSnapshot());
      setTestMode('cancelled');
      setTestPhase('cancelled');
    }
    const instance = webGazerRef.current;
    webGazerRef.current = null;
    if (instance) {
      try {
        stopWebGazer(instance);
      } catch (error) {
        console.error('Failed to stop WebGazer camera resources:', error);
        setCameraError('אירעה שגיאה בעת שחרור המצלמה. כדאי לרענן את הדף.');
      }
    }
    setCameraStatus('off');
    setCalibrationReady(false);
    calibrationReadyRef.current = false;
    setCalibrationIndex(-1);
    setCalibrationTargetEnabled(false);
    setCalibratedTargetCount(0);
    setEstimate(null);
    setInstruction('הפעילו את המצלמה כדי להתחיל.');
    setTestStep(0);
    setTestMode('idle');
    setTestPhase('idle');
    setReport(null);
  }

  function speak(instructionText, onComplete) {
    const synthesis = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    const voice = getHebrewVoice(synthesis);
    if (!synthesis || !Utterance || !voice) {
      setVoiceMessage('לא נמצא קול עברי בדפדפן. ההוראה מוצגת על המסך להמשך ידני.');
      onComplete();
      return;
    }
    synthesisRef.current = synthesis;
    synthesis.cancel();
    const utterance = new Utterance(instructionText);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onend = onComplete;
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      setVoiceMessage('ההקראה נכשלה. אפשר להמשיך לפי ההוראה שמוצגת על המסך.');
      onComplete();
    };
    synthesis.speak(utterance);
  }

  function prepareCalibrationTarget(index) {
    window.clearTimeout(calibrationDelayRef.current);
    calibrationDelayRef.current = null;
    if (!mountedRef.current || index >= CALIBRATION_TARGETS.length) {
      setCalibrationIndex(-1);
      setCalibrationTargetEnabled(false);
      setVoiceMessage('');
      predictionHistoryRef.current = [];
      latestEstimateRef.current = null;
      setEstimate(null);
      calibrationReadyRef.current = true;
      setCalibrationReady(true);
      setInstruction('הכיול הסתיים. אפשר להתחיל את ארבעת תנאי הבדיקה.');
      return;
    }
    const target = CALIBRATION_TARGETS[index];
    setCalibrationIndex(index);
    setCalibrationTargetEnabled(false);
    setCalibrationClickCount(0);
    setInstruction(`הסתכלי על הנקודה ${target.label} ולחצי עליה שלוש פעמים.`);
    setVoiceMessage('');
    speak(`הסתכלי על הנקודה ${target.label} במסך ולחצי עליה שלוש פעמים.`, () => {
      calibrationDelayRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setVoiceMessage('אפשר ללחוץ על נקודת הכיול.');
          setCalibrationTargetEnabled(true);
        }
      }, 500);
    });
  }

  function beginCalibration() {
    if (cameraStatus !== 'ready') return;
    testRunRef.current += 1;
    clearTestTimers();
    if (recorderRef.current.getSnapshot().recording) {
      recorderRef.current.stop(performance.now());
    }
    setTestMode('idle');
    setTestPhase('idle');
    setTestStep(0);
    setReport(null);
    predictionHistoryRef.current = [];
    latestEstimateRef.current = null;
    calibrationReadyRef.current = false;
    setCalibrationReady(false);
    setCalibratedTargetCount(0);
    prepareCalibrationTarget(0);
  }

  async function recordCalibrationClick(event) {
    if (calibrationIndex < 0 || !calibrationTargetEnabled || calibrationBusyRef.current) return;
    calibrationBusyRef.current = true;
    const target = CALIBRATION_TARGETS[calibrationIndex];
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    try {
      const webgazer = webGazerRef.current;
      const regression = webgazer?.getRegression?.()[0];
      if (!webgazer || !regression) throw new Error('מודל WebGazer אינו מוכן.');
      const previousSampleCount = regression.getData().length;
      await webgazer.getCurrentPrediction();
      webgazer.recordScreenPosition(x, y, 'click');
      const nextSampleCount = regression.getData().length;
      if (nextSampleCount <= previousSampleCount) {
        setVoiceMessage('לא התקבלה מדידת עיניים לכיול. ודאו שהפנים מוארות ונראות במצלמה ונסו שוב.');
        return;
      }

      const nextClickCount = calibrationClickCount + 1;
      setCalibrationClickCount(nextClickCount);
      if (nextClickCount < CALIBRATION_CLICKS_PER_TARGET) {
        setVoiceMessage(`נקלטה לחיצה ${nextClickCount} מתוך ${CALIBRATION_CLICKS_PER_TARGET}. המשיכי להביט בנקודה ולחצי שוב.`);
        return;
      }
      const nextIndex = calibrationIndex + 1;
      setCalibratedTargetCount(nextIndex);
      if (nextIndex === CALIBRATION_TARGETS.length) {
        prepareCalibrationTarget(nextIndex);
      } else {
        prepareCalibrationTarget(nextIndex);
      }
    } catch (error) {
      setVoiceMessage(error?.message || 'לא ניתן לשמור את נקודת הכיול.');
    } finally {
      calibrationBusyRef.current = false;
    }
  }

  function clearTestTimers() {
    window.clearTimeout(testTimerRef.current);
    window.clearInterval(sampleTimerRef.current);
    testTimerRef.current = null;
    sampleTimerRef.current = null;
  }

  function finishTest(runId, cancelled = false) {
    if (testRunRef.current !== runId) return;
    clearTestTimers();
    synthesisRef.current?.cancel();
    if (recorderRef.current.getSnapshot().recording) {
      recorderRef.current.stop(performance.now());
    }
    setReport(recorderRef.current.getSnapshot());
    setTestMode(cancelled ? 'cancelled' : 'complete');
    setTestPhase(cancelled ? 'cancelled' : 'complete');
    if (!cancelled) setTestStep(TEST_CONDITIONS.length);
  }

  function runTestCondition(runId, index) {
    if (!mountedRef.current || testRunRef.current !== runId) return;
    if (index >= TEST_CONDITIONS.length) {
      finishTest(runId);
      return;
    }
    const condition = TEST_CONDITIONS[index];
    setTestStep(index + 1);
    setInstruction(condition.instruction);
    setTestPhase('speaking');
    speak(condition.instruction, () => {
      if (!mountedRef.current || testRunRef.current !== runId) return;
      setTestPhase('settling');
      testTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current || testRunRef.current !== runId) return;
        recorderRef.current.setStage(condition, performance.now());
        setTestPhase('recording');
        sampleTimerRef.current = window.setInterval(() => {
          if (!mountedRef.current || testRunRef.current !== runId) return;
          recorderRef.current.record(
            latestEstimateRef.current,
            performance.now(),
          );
        }, DIAGNOSTIC_SAMPLE_INTERVAL_MS);
        testTimerRef.current = window.setTimeout(() => {
          window.clearInterval(sampleTimerRef.current);
          sampleTimerRef.current = null;
          recorderRef.current.endStage(performance.now());
          runTestCondition(runId, index + 1);
        }, TEST_STAGE_DURATION_MS);
      }, SETTLING_DELAY_MS);
    });
  }

  function startGuidedTest() {
    if (cameraStatus !== 'ready' || !calibrationReady || testMode === 'active') return;
    clearTestTimers();
    const runId = testRunRef.current + 1;
    testRunRef.current = runId;
    recorderRef.current.start(performance.now());
    setReport(null);
    setTestMode('active');
    setTestPhase('speaking');
    runTestCondition(runId, 0);
  }

  function cancelGuidedTest() {
    if (testMode !== 'active') return;
    const runId = testRunRef.current;
    finishTest(runId, true);
    testRunRef.current += 1;
  }

  const target = calibrationIndex >= 0 ? CALIBRATION_TARGETS[calibrationIndex] : null;
  const stateLabel = {
    [WEBGAZER_STATES.SCREEN]: 'מבט משוער בתוך המסך',
    [WEBGAZER_STATES.AWAY]: 'מבט משוער מחוץ למסך',
    [WEBGAZER_STATES.UNKNOWN]: 'לא ניתן לקבוע',
  }[estimate?.state ?? WEBGAZER_STATES.UNKNOWN];
  const canExport = Boolean(report?.sampleCount);
  const markerX = estimate?.predictionAvailable && estimate.screenBounds
    ? `${Math.max(0, Math.min(100, (estimate.x / estimate.screenBounds.width) * 100))}%`
    : null;
  const markerY = estimate?.predictionAvailable && estimate.screenBounds
    ? `${Math.max(0, Math.min(100, (estimate.y / estimate.screenBounds.height) * 100))}%`
    : null;

  return (
    <main className="webgazer-experiment" dir="rtl" lang="he">
      <header className="webgazer-experiment-header">
        <p>סביבת פיתוח נפרדת · WebGazer.js</p>
        <h1>ניסוי מבט — הוכחת היתכנות</h1>
        <p>
          ניסוי מקומי מבודד. אינו משנה את זיהוי המבט הקיים ואינו זמין בגרסת הייצור.
        </p>
      </header>

      <section className="webgazer-experiment-card" aria-labelledby="webgazer-camera-heading">
        <div className="webgazer-experiment-camera-row">
          <div className="webgazer-experiment-camera-slot" ref={cameraSlotRef}>
            {cameraStatus !== 'ready' && (
              <div className="webgazer-experiment-camera-placeholder" role="status">
                {cameraStatus === 'loading' ? 'מפעילים את WebGazer ואת המצלמה…' : 'המצלמה כבויה'}
              </div>
            )}
          </div>
          <div className="webgazer-experiment-intro">
            <h2 id="webgazer-camera-heading">מצלמה ותצוגת אומדן</h2>
            <p>
              WebGazer מבקש גישה למצלמה רק אחרי לחיצה. הוא מחשב אומדן מקומי בדפדפן;
              לא נשמרות תמונות או הקלטות.
            </p>
            {(cameraStatus === 'off' || cameraStatus === 'error') && (
              <button type="button" className="webgazer-experiment-primary" onClick={startCamera}>
                הפעלת מצלמה והתחלת WebGazer
              </button>
            )}
            {cameraStatus === 'loading' && <p role="status">מתחילים את המצלמה…</p>}
            {cameraStatus === 'ready' && (
              <button type="button" className="webgazer-experiment-secondary" onClick={stopCamera}>
                כיבוי מצלמה
              </button>
            )}
            {cameraError && <p className="webgazer-experiment-error" role="alert">{cameraError}</p>}
          </div>
        </div>
        <div className={`webgazer-experiment-status webgazer-experiment-status--${estimate?.state ?? 'UNKNOWN'}`} role="status">
          <span className="webgazer-experiment-status-dot" aria-hidden="true" />
          <strong>{stateLabel}</strong>
          <span>
            {estimate?.predictionAvailable
              ? `x: ${estimate.x.toFixed(0)} · y: ${estimate.y.toFixed(0)}`
              : 'מיקום המבט אינו זמין'}
          </span>
          {estimate?.insideScreenBounds !== null && estimate?.insideScreenBounds !== undefined && (
            <span>{estimate.insideScreenBounds ? 'בתוך גבולות המסך' : 'מחוץ לגבולות המסך'}</span>
          )}
        </div>
        <div
          className="webgazer-screen-map"
          role="img"
          aria-label="מפת אומדן מיקום מבט ביחס לגבולות המסך"
        >
          <span className="webgazer-screen-map-label">גבולות המסך</span>
          {markerX && markerY && (
            <span
              className={`webgazer-screen-map-marker${estimate.insideScreenBounds ? '' : ' webgazer-screen-map-marker--outside'}`}
              style={{ left: markerX, top: markerY }}
            />
          )}
        </div>
        <p className="webgazer-experiment-caveat">
          אין ל־WebGazer מדד confidence מובנה. יציבות התחזיות היא מדד איכות גס בלבד;
          נקודה מחוץ לגבולות אינה הוכחה ודאית שהמבט מחוץ למסך.
        </p>
      </section>

      <section className="webgazer-experiment-card" aria-labelledby="webgazer-calibration-heading">
        <h2 id="webgazer-calibration-heading">כיול קצר — חמש נקודות</h2>
        <p>
          בכל נקודה יש להביט ישירות בנקודה וללחוץ עליה שלוש פעמים. הכיול משתמש בלחיצות;
          ארבעת תנאי הבדיקה שאחריו מוקלטים בלי שימוש בעכבר או במקלדת.
        </p>
        {calibratedTargetCount > 0 && (
          <progress
            className="webgazer-experiment-progress"
            value={calibratedTargetCount}
            max={CALIBRATION_TARGETS.length}
            aria-label={`התקדמות כיול: ${calibratedTargetCount} מתוך ${CALIBRATION_TARGETS.length} נקודות`}
          />
        )}
        {cameraStatus === 'ready' && !calibrationReady && calibrationIndex < 0 && (
          <button type="button" className="webgazer-experiment-primary" onClick={beginCalibration}>
            התחלת כיול קולי
          </button>
        )}
        {target && (
          <>
            <p className="webgazer-experiment-instruction" role="status">{instruction}</p>
            <div className="webgazer-experiment-target-board">
              <button
                type="button"
                className="webgazer-experiment-target"
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                aria-label={`נקודת כיול ${target.label}, לחיצה ${calibrationClickCount + 1} מתוך ${CALIBRATION_CLICKS_PER_TARGET}`}
                disabled={
                  cameraStatus !== 'ready'
                  || !calibrationTargetEnabled
                  || calibrationBusyRef.current
                }
                onClick={recordCalibrationClick}
              >
                <span className="webgazer-experiment-visually-hidden">
                  נקודת כיול {target.label}
                </span>
              </button>
            </div>
            <p className="webgazer-experiment-step">
              נקודה {calibrationIndex + 1} מתוך {CALIBRATION_TARGETS.length}
              {' · '}
              לחיצות {calibrationClickCount} מתוך {CALIBRATION_CLICKS_PER_TARGET}
            </p>
          </>
        )}
        {calibrationReady && (
          <p className="webgazer-experiment-ready" role="status">
            הכיול הושלם בחמש נקודות. אפשר להתחיל את הבדיקה המודרכת.
          </p>
        )}
        {voiceMessage && <p className="webgazer-experiment-note" role="status">{voiceMessage}</p>}
      </section>

      {calibrationReady && (
        <section className="webgazer-experiment-card" aria-labelledby="webgazer-test-heading">
          <h2 id="webgazer-test-heading">בדיקה מודרכת — ארבעה תנאים</h2>
          <ol className="webgazer-experiment-conditions">
            {TEST_CONDITIONS.map((condition) => <li key={condition.id}>{condition.expectedCondition}</li>)}
          </ol>
          <p>כל תנאי יוקרא, ימתין 1.5 שניות לתנועה, ואז יימדד במשך 5 שניות.</p>
          {testMode === 'idle' && (
            <button type="button" className="webgazer-experiment-primary" onClick={startGuidedTest}>
              התחלת ארבעת התנאים
            </button>
          )}
          {testMode === 'active' && (
            <>
              <p className="webgazer-experiment-instruction" role="status">
                תנאי {testStep} מתוך {TEST_CONDITIONS.length} · {instruction}
              </p>
              <p className="webgazer-experiment-step" role="status">
                {testPhase === 'speaking'
                  ? 'מושמעות הוראות — אין איסוף'
                  : testPhase === 'settling'
                    ? 'המתנה לסיום התנועה — אין איסוף'
                    : 'אוספים תחזיות WebGazer'}
              </p>
              <button type="button" className="webgazer-experiment-secondary" onClick={cancelGuidedTest}>
                ביטול הבדיקה
              </button>
            </>
          )}
          {(testMode === 'complete' || testMode === 'cancelled') && report && (
            <>
              <p className="webgazer-experiment-ready" role="status">
                {testMode === 'complete' ? 'הבדיקה הושלמה.' : 'הבדיקה בוטלה.'}
                {' '}נאספו {report.sampleCount} דגימות.
              </p>
              <ul className="webgazer-experiment-summaries">
                {report.stageSummaries.map((stage) => (
                  <li key={stage.id}>
                    {stage.expectedCondition}: {stage.sampleCount} דגימות; מסך{' '}
                    {stage.predictedStateCounts[WEBGAZER_STATES.SCREEN]}, מחוץ{' '}
                    {stage.predictedStateCounts[WEBGAZER_STATES.AWAY]}, לא ידוע{' '}
                    {stage.predictedStateCounts[WEBGAZER_STATES.UNKNOWN]}
                  </li>
                ))}
              </ul>
              <div className="webgazer-experiment-actions">
                <button
                  type="button"
                  className="webgazer-experiment-primary"
                  disabled={!canExport}
                  onClick={() => downloadExperiment(recorderRef.current, setExportError)}
                >
                  הורדת תוצאות הניסוי (JSON)
                </button>
                <button type="button" className="webgazer-experiment-secondary" onClick={startGuidedTest}>
                  הרצת הבדיקה מחדש
                </button>
              </div>
            </>
          )}
          {exportError && <p className="webgazer-experiment-error" role="alert">{exportError}</p>}
        </section>
      )}

      {cameraStatus === 'ready' && estimate && (
        <p className="webgazer-experiment-quality">
          איכות זמינות: {estimate.quality.stable ? 'תחזיות יציבות בחלון האחרון' : 'אין עדיין רצף יציב'}
          {' · '}
          {estimate.quality.recentPredictionCount} תחזיות בחלון
          {estimate.quality.spreadPx !== null
            ? ` · פיזור ${estimate.quality.spreadPx.toFixed(0)} פיקסלים`
            : ''}
          {' · '}
          אין ציון ביטחון זמין
        </p>
      )}

      <p className="webgazer-experiment-privacy">
        כל הדגימות נשארות בזיכרון הדפדפן ומיוצאות רק בלחיצה. WebGazer מוגדר לא לשמור
        נתוני כיול בין הפעלות. אין שליחת נתונים לשרת, ואין שמירת תמונות, וידאו, אודיו או מזהים.
      </p>
    </main>
  );
}
