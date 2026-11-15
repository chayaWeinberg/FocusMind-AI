import { useEffect, useRef } from 'react';
import useCameraStream from '../vision/useCameraStream.js';
import useAttentionEngine from '../attention-engine/useAttentionEngine.js';
import { ATTENTION_REASONS, ATTENTION_STATES } from '../attention-engine/contracts.js';
import {
  CONCENTRATION_FACTOR_TEXTS,
  CONCENTRATION_LEVEL_LABELS,
  FATIGUE_TEXTS,
  GAZE_MODEL_LABELS,
  REASON_TEXTS,
  STATE_LABELS,
} from '../attention-engine/labels.js';

const UNMEASURED_REASONS = new Set([ATTENTION_REASONS.CAMERA_UNAVAILABLE, ATTENTION_REASONS.PAUSED]);

/** Maps an engine frame to the state counted in session statistics (null = not measured). */
export function measuredStateOf(frame) {
  if (!frame || UNMEASURED_REASONS.has(frame.reason)) return null;
  return frame.state;
}

/** The concentration score counted in session statistics (null = not available). */
export function concentrationScoreOf(frame) {
  if (measuredStateOf(frame) === null) return null;
  return frame.concentration?.score ?? null;
}

const percent = (value) => `${Math.round((value || 0) * 100)}%`;
const signedDegrees = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}°`;

function ConcentrationCard({ estimate }) {
  if (!estimate?.ready || estimate.score === null) {
    return (
      <section className="attention-concentration" aria-label="הערכת ריכוז">
        <div className="attention-concentration-head">
          <span>הערכת ריכוז</span>
          <b>אוספים נתונים…</b>
        </div>
        <span className="attention-monitor-bar" aria-hidden="true">
          <span style={{ width: percent(estimate?.progress) }} />
        </span>
        <p>ההערכה תופיע אחרי כמה שניות של מבט מול המצלמה.</p>
      </section>
    );
  }

  const { score, level, factors } = estimate;
  return (
    <section className={`attention-concentration attention-concentration--${level}`} aria-label="הערכת ריכוז">
      <div className="attention-concentration-head">
        <span>הערכת ריכוז</span>
        <strong aria-label={`הערכת ריכוז ${score}%`}>{score}%</strong>
        <b>{CONCENTRATION_LEVEL_LABELS[level]}</b>
      </div>
      <span className="attention-monitor-bar attention-concentration-bar" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </span>
      {factors.length > 0 ? (
        <ul className="attention-concentration-factors" aria-label="מה מוריד את הערכת הריכוז">
          {factors.map((factor) => <li key={factor}>{CONCENTRATION_FACTOR_TEXTS[factor]}</li>)}
        </ul>
      ) : (
        <p>אין כרגע סימנים שמורידים את ההערכה.</p>
      )}
      <dl className="attention-concentration-metrics">
        <div><dt>מבט למסך (לאחרונה)</dt><dd>{percent(estimate.onScreenShare)}</dd></div>
        <div><dt>עצימות ממושכות (2 דק׳)</dt><dd>{estimate.longClosures}</dd></div>
        <div><dt>פיהוקים (5 דק׳)</dt><dd>{estimate.yawns}</dd></div>
        <div>
          <dt>מצמוצים לדקה</dt>
          <dd>{estimate.blinkRatePerMinute === null ? 'נמדד אחרי 20 שנ׳' : Math.round(estimate.blinkRatePerMinute)}</dd>
        </div>
      </dl>
    </section>
  );
}

function MeasurementDetails({ details, fatigue, estimate }) {
  if (!details) return null;
  const { offset, tolerance } = details;
  return (
    <details className="attention-monitor-details">
      <summary>פרטי המדידה</summary>
      <dl>
        <div><dt>מודל</dt><dd>{GAZE_MODEL_LABELS[details.modelUsed] ?? '—'}</dd></div>
        {offset && tolerance && (
          <>
            <div>
              <dt>סטיית מבט אופקית</dt>
              <dd>{signedDegrees(offset.horizontal)} <small>(גבול ±{Math.round(tolerance.horizontal)}°)</small></dd>
            </div>
            <div>
              <dt>סטיית מבט אנכית</dt>
              <dd>{signedDegrees(offset.vertical)} <small>(גבול ±{Math.round(tolerance.vertical)}°)</small></dd>
            </div>
          </>
        )}
        <div><dt>איכות מדידת העיניים</dt><dd>{percent(details.eyeQuality)}</dd></div>
        <div><dt>עיניים עצומות כרגע</dt><dd>{fatigue?.eyesClosed ? 'כן' : 'לא'}</dd></div>
        {estimate?.perclos !== null && estimate?.perclos !== undefined && (
          <div><dt>זמן עיניים עצומות (30 שנ׳)</dt><dd>{percent(estimate.perclos)}</dd></div>
        )}
        {fatigue?.jawOpen !== null && fatigue?.jawOpen !== undefined && (
          <div><dt>פתיחת פה</dt><dd>{percent(fatigue.jawOpen)}</dd></div>
        )}
      </dl>
      <p>סטייה בתוך הגבול נחשבת מבט למסך. ההערכה מתאימה את עצמה למיקום שלכם.</p>
    </details>
  );
}

export default function AttentionMonitor({ onStateChange, sessionRunning = false }) {
  const videoRef = useRef(null);
  const camera = useCameraStream();
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const engine = useAttentionEngine(videoRef, camera.stream, {
    onFrame: (frame) => onStateChangeRef.current?.(measuredStateOf(frame), concentrationScoreOf(frame)),
  });
  const { frame } = engine;
  const cameraOn = Boolean(camera.stream);
  const measuring = cameraOn && engine.status === 'running';
  const adapting = measuring && !frame.adapted;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = camera.stream;
    if (camera.stream) video.play?.()?.catch?.(() => {});
  }, [camera.stream]);

  const stateKey = measuring ? frame.state : null;
  const label = !cameraOn
    ? 'המצלמה כבויה'
    : engine.status === 'loading' ? 'טוענים את זיהוי הפנים…'
      : engine.status === 'error' ? 'המעקב אינו זמין'
        : STATE_LABELS[frame.state];
  const reason = !cameraOn
    ? REASON_TEXTS[ATTENTION_REASONS.CAMERA_UNAVAILABLE]
    : engine.status === 'loading' ? 'המודל נטען מהמחשב שלכם ופועל בדפדפן בלבד.'
      : engine.status === 'error' ? engine.error
        : REASON_TEXTS[frame.reason];
  const showConfidence = measuring && frame.state !== ATTENTION_STATES.UNCERTAIN;
  const confidencePercent = Math.round((frame.confidence || 0) * 100);

  return (
    <section className="signature-attention-monitor" aria-labelledby="attention-monitor-title">
      <div className="attention-monitor-heading">
        <small>מעקב קשב בזמן אמת</small>
        <h2 id="attention-monitor-title">כיוון המבט</h2>
      </div>

      <div className="attention-monitor-video">
        <video ref={videoRef} muted playsInline autoPlay aria-label="תצוגה חיה מהמצלמה" hidden={!cameraOn} />
        {!cameraOn && (
          <div className="attention-monitor-video-off">
            <span aria-hidden="true">◉</span>
            <span>המצלמה תופעל רק לאחר לחיצה על הכפתור.</span>
          </div>
        )}
      </div>

      <strong
        className={`attention-monitor-state${stateKey ? ` attention-monitor-state--${stateKey.toLowerCase()}` : ''}`}
        role="status"
        aria-live="polite"
        aria-label="מצב הקשב"
      >
        {label}
      </strong>
      {showConfidence && (
        <div className="attention-monitor-confidence" aria-label={`ודאות ${confidencePercent}%`}>
          <span>ודאות</span>
          <span className="attention-monitor-bar"><span style={{ width: `${confidencePercent}%` }} /></span>
          <b>{confidencePercent}%</b>
        </div>
      )}
      {adapting && (
        <div className="attention-monitor-confidence" aria-label="התאמה למיקום שלכם">
          <span>התאמה</span>
          <span className="attention-monitor-bar"><span style={{ width: `${Math.round(frame.adaptationProgress * 100)}%` }} /></span>
        </div>
      )}
      <p className="attention-monitor-reason">{reason}</p>
      {measuring && frame.fatigueIndicators.length > 0 && (
        <p className="attention-monitor-fatigue" role="status">
          סימן אפשרי לעייפות: {frame.fatigueIndicators.map((indicator) => FATIGUE_TEXTS[indicator]).join(' · ')}
        </p>
      )}
      {measuring && frame.adapted && <ConcentrationCard estimate={frame.concentration} />}
      {measuring && frame.adapted && (
        <MeasurementDetails details={engine.details} fatigue={engine.fatigue} estimate={frame.concentration} />
      )}
      {sessionRunning && !cameraOn && (
        <p className="attention-monitor-hint">המפגש פעיל, אבל כיוון המבט אינו נמדד. הפעילו את המצלמה כדי לקבל סטטיסטיקה.</p>
      )}
      {camera.error && <p className="attention-monitor-error" role="alert">{camera.error}</p>}

      <div className="attention-monitor-actions">
        <button
          type="button"
          className={cameraOn ? 'signature-secondary-button' : 'signature-primary-button'}
          onClick={cameraOn ? camera.stop : camera.start}
          disabled={camera.status === 'starting'}
        >
          {cameraOn ? 'כיבוי מצלמה' : camera.status === 'starting' ? 'מתחברים למצלמה…' : 'הפעלת מצלמה'}
        </button>
        {measuring && frame.adapted && (
          <button type="button" className="attention-monitor-link" onClick={engine.recenter}>
            התאמה מחדש למיקום שלי
          </button>
        )}
      </div>
      <p className="attention-monitor-privacy">
        הווידאו מעובד בדפדפן בלבד ואינו נשמר או נשלח. הערכת הריכוז משוערת לפי כיוון המבט וסימני עייפות (עצימת עיניים, פיהוקים, מצמוץ), ואינה מדידה מדויקת של ריכוז.
      </p>
    </section>
  );
}
