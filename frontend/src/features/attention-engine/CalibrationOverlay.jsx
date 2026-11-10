import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Full-viewport calibration targets. Screen coordinates are viewport fractions. */
export default function CalibrationOverlay({ calibration, onCancel }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  if (calibration.status !== 'running' || !calibration.target) return null;
  const { target, targetIndex, targetCount, phase, targetProgress, retrying, samplesForTarget } = calibration;

  return createPortal(
    <div className="ae-calibration" role="dialog" aria-modal="true" aria-label="כיול אישי של זיהוי המבט" dir="rtl" lang="he">
      <div className="ae-calibration-instructions">
        <strong>הביטו בנקודה עד שהיא מתמלאת</strong>
        <span>שבו כרגיל, בלי להזיז את הכיסא. מותר להזיז ראש ועיניים באופן טבעי.</span>
        <span role="status">
          נקודה {targetIndex + 1} מתוך {targetCount}
          {retrying ? ' · ננסה שוב את הנקודה הזו' : ''}
          {phase === 'collect' ? ` · ${samplesForTarget} מדידות` : ''}
        </span>
        <button type="button" className="ae-button ae-button--ghost" onClick={onCancel}>ביטול (Esc)</button>
      </div>
      <div
        className={`ae-calibration-target ae-calibration-target--${phase}`}
        style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, '--ae-progress': targetProgress }}
        data-testid="calibration-target"
        aria-hidden="true"
      >
        <span />
      </div>
    </div>,
    document.body,
  );
}
