import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { CALIBRATION_TARGETS } from './screenCalibrationCollector.js';

const REFRESH_INTERVAL_MS = 100;

const TARGET_INSTRUCTIONS = {
  CENTER: 'התבוננו בנקודה שבמרכז המסך',
  TOP: 'התבוננו בנקודה בחלק העליון של המסך',
  BOTTOM: 'התבוננו בנקודה בחלק התחתון של המסך',
  LEFT: 'התבוננו בנקודה בצד השמאלי של המסך',
  RIGHT: 'התבוננו בנקודה בצד הימני של המסך',
  KEYBOARD: 'הביטו במקלדת לצורך בדיקת הערכה נפרדת',
};

const STATUS_LABELS = {
  idle: 'מוכנים לאיסוף נתוני כיול',
  countdown: 'הספירה לאחור החלה',
  collecting: 'אוספים מדידות',
  'needs-repeat': 'לא נאספו מספיק מדידות אמינות. יש לחזור על היעד.',
  'awaiting-keyboard-or-complete': 'יעדי המסך הושלמו',
  complete: 'איסוף הכיול הסתיים',
  cancelled: 'האיסוף בוטל',
  interrupted: 'האיסוף נעצר כי המצלמה או הווידאו אינם פעילים',
};

function isActiveStatus(status) {
  return status === 'countdown' || status === 'collecting';
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

export default function ScreenCalibration({
  cameraAvailable,
  videoPlaybackState,
  sessionRef,
  startCalibration,
  cancelCalibration,
  restartCalibration,
  repeatCalibrationTarget,
  startKeyboardEvaluation,
  completeCalibration,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [exportError, setExportError] = useState('');
  const trackingAvailable = cameraAvailable && videoPlaybackState === 'playing';

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

  function refreshSnapshot() {
    setSnapshot(sessionRef?.current?.getSnapshot(performance.now()) ?? null);
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

  function finishWithoutKeyboard() {
    completeCalibration?.();
    refreshSnapshot();
  }

  const status = snapshot?.status || 'idle';
  const currentTarget = snapshot?.target;
  const showingTarget = Boolean(
    currentTarget
    && (isActiveStatus(status) || status === 'needs-repeat'),
  );
  const progressCount = status === 'awaiting-keyboard-or-complete'
    || status === 'complete'
      ? CALIBRATION_TARGETS.length
      : Math.min(snapshot?.targetIndex ?? 0, CALIBRATION_TARGETS.length);
  const targetSummary = currentTarget
    ? snapshot?.collector?.targets?.[currentTarget.label]
    : null;
  const canExport = Boolean(
    snapshot?.collector
    && (
      Object.values(snapshot.collector.targets).some(
        (target) => target.acceptedSampleCount || target.rejectedSampleCount,
      )
      || snapshot.collector.keyboardEvaluation.acceptedSampleCount
      || snapshot.collector.keyboardEvaluation.rejectedSampleCount
    ),
  );

  return (
    <>
      <section className="screen-calibration" aria-label="איסוף נתוני כיול ניסיוני">
        <div className="eye-gaze-diagnostic-heading">
          <strong>איסוף נתוני כיול ניסיוני</strong>
          <span>מקומי בלבד · ללא סיווג מכויל</span>
        </div>
        <p className="screen-calibration-description">
          הביטו בכל נקודה למשך כ־4 שניות. נקודות המסך הן דוגמאות חיוביות בלבד ואינן מגדירות גבול מדויק.
        </p>
        <div className="screen-calibration-controls">
          <button type="button" onClick={begin} disabled={!trackingAvailable || status !== 'idle'}>
            התחלת כיול
          </button>
          <button type="button" onClick={cancel} disabled={!isActiveStatus(status) && status !== 'needs-repeat' && status !== 'awaiting-keyboard-or-complete'}>
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
            {status === 'needs-repeat'
              && ` · ${targetSummary?.acceptedSampleCount ?? 0}/${snapshot.minimumReliableSamples} אמינות`}
          </p>
        )}
        {status === 'needs-repeat' && (
          <button className="screen-calibration-secondary" type="button" onClick={repeat} disabled={!trackingAvailable}>
            חזרה על היעד
          </button>
        )}
        {status === 'awaiting-keyboard-or-complete' && (
          <div className="screen-calibration-controls">
            <button type="button" onClick={beginKeyboard} disabled={!trackingAvailable}>
              בדיקת מקלדת אופציונלית
            </button>
            <button type="button" onClick={finishWithoutKeyboard}>
              סיום ללא בדיקת מקלדת
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
            בדיקת מקלדת נפרדת: {snapshot.collector.keyboardEvaluation.acceptedSampleCount} אמינות,
            {' '}{snapshot.collector.keyboardEvaluation.rejectedSampleCount} שנדחו
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
            {status === 'countdown'
              ? <b>{snapshot.secondsRemaining}</b>
              : status === 'collecting'
                ? <small>{snapshot.secondsRemaining} שניות · {snapshot.acceptedSampleCount} מדידות אמינות</small>
                : <small>נדרשת חזרה על היעד כדי להגיע למינימום</small>}
          </div>
          {currentTarget.label !== 'KEYBOARD' && (
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
