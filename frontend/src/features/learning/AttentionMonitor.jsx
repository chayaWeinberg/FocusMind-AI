import { useEffect, useRef } from 'react';
import useCameraStream from '../vision/useCameraStream.js';
import useAttentionEngine from '../attention-engine/useAttentionEngine.js';
import useAttentionModel from '../attention-model/useAttentionModel.js';
import { ATTENTION_MODEL_VERSION, attentionLevelOf } from '../attention-model/attentionModel.js';
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

/** The course attention model's score (0..1), shown first: the assignment's main measure. */
function ModelScoreCard({ model }) {
  if (model.status === 'error') {
    return (
      <section className="attention-concentration attention-model-score" aria-label="ציון קשב (מודל הקורס)">
        <div className="attention-concentration-head"><span>ציון קשב (מודל {ATTENTION_MODEL_VERSION})</span><b>לא זמין</b></div>
        <p>טעינת מודל הקשב נכשלה. הערכת הריכוז שלמטה ממשיכה לעבוד.</p>
      </section>
    );
  }
  if (model.score === null) {
    return (
      <section className="attention-concentration attention-model-score" aria-label="ציון קשב (מודל הקורס)">
        <div className="attention-concentration-head">
          <span>ציון קשב (מודל {ATTENTION_MODEL_VERSION})</span>
          <b>{model.status === 'loading' ? 'טוענים את המודל…' : 'אוספים 10 שניות…'}</b>
        </div>
        <span className="attention-monitor-bar" aria-hidden="true"><span style={{ width: percent(model.progress) }} /></span>
        <p>הציון הראשון מופיע אחרי כ-10 שניות של פנים מול המצלמה, ומתעדכן כל 2 שניות.</p>
      </section>
    );
  }
  const level = attentionLevelOf(model.score);
  return (
    <section className={`attention-concentration attention-model-score attention-model-score--${level.key}`} aria-label="ציון קשב (מודל הקורס)">
      <div className="attention-concentration-head">
        <span>ציון קשב (מודל {ATTENTION_MODEL_VERSION})</span>
        <strong aria-label={`ציון קשב ${model.score.toFixed(2)} מתוך 1`}>{model.score.toFixed(2)}</strong>
        <b>{level.label}</b>
      </div>
      <span className="attention-monitor-bar attention-concentration-bar" aria-hidden="true">
        <span style={{ width: percent(model.score) }} />
      </span>
      <p>בין 0 ל-1: גבוה יותר = קשב גבוה יותר. מחושב בדפדפן על 10 השניות האחרונות.</p>
    </section>
  );
}

export default function AttentionMonitor({ onStateChange, sessionRunning = false }) {
  const videoRef = useRef(null);
  const camera = useCameraStream();
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const cameraOn = Boolean(camera.stream);
  const modelScoreRef = useRef(null);
  const model = useAttentionModel({
    active: cameraOn,
    onScore: (score) => { modelScoreRef.current = score; },
  });
  const engine = useAttentionEngine(videoRef, camera.stream, {
    onFrame: (frame) => onStateChangeRef.current?.(
      measuredStateOf(frame),
      concentrationScoreOf(frame),
      frame.state === ATTENTION_STATES.FACE_ABSENT ? null : modelScoreRef.current,
    ),
    onLandmarks: model.push,
  });
  const { frame } = engine;
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
      {measuring && frame.state !== ATTENTION_STATES.FACE_ABSENT && <ModelScoreCard model={model} />}
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
        הווידאו מעובד בדפדפן בלבד ואינו נשמר או נשלח: רק הציונים נשמרים. ציון הקשב מגיע ממודל הקשב של הקורס (אומן על סרטונים של לומדים), והערכת הריכוז משוערת לפי כיוון המבט וסימני עייפות (עצימת עיניים, פיהוקים, מצמוץ). שניהם הערכות, והערכה כזו אינה מדידה מדויקת של ריכוז.
      </p>
    </section>
  );
}
