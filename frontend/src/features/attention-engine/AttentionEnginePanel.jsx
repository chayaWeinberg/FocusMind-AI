import { useCallback, useEffect, useRef, useState } from 'react';
import useCameraStream from '../vision/useCameraStream.js';
import useAttentionEngine from './useAttentionEngine.js';
import CalibrationOverlay from './CalibrationOverlay.jsx';
import { ATTENTION_STATES } from './contracts.js';
import {
  CALIBRATION_FAILURE_TEXTS,
  FATIGUE_TEXTS,
  MODEL_USED_TEXTS,
  QUALITY_TEXTS,
  REASON_TEXTS,
  STATE_LABELS,
} from './labels.js';
import './AttentionEnginePanel.css';

function formatNumber(value, digits = 1, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
}

function QualityBar({ value, label }) {
  const percent = Number.isFinite(value) ? Math.round(value * 100) : 0;
  return (
    <span className="ae-quality" aria-label={`${label}: ${percent}%`}>
      <span className="ae-quality-fill" style={{ width: `${percent}%` }} />
    </span>
  );
}

function GazeMap({ raw, modelError }) {
  // Shows the range [-0.5, 1.5] on both axes; the screen is the middle half.
  const point = raw?.gazePoint;
  const toPercent = (value) => Math.min(100, Math.max(0, ((value + 0.5) / 2) * 100));
  const radius = Number.isFinite(modelError) ? Math.max(2, (modelError / 2) * 100) : 0;
  return (
    <figure className="ae-gaze-map" aria-label="מפת נקודת המבט המשוערת" dir="ltr">
      <div className="ae-gaze-map-area">
        <div className="ae-gaze-map-screen"><span>מסך</span></div>
        {point ? (
          <span
            className={`ae-gaze-point ae-state--${raw.state.toLowerCase()}`}
            style={{ left: `${toPercent(point.x)}%`, top: `${toPercent(point.y)}%`, '--ae-radius': `${radius}%` }}
            data-testid="gaze-point"
          />
        ) : null}
      </div>
      <figcaption dir="rtl">
        {point
          ? 'הנקודה היא הערכה לפי הכיול. העיגול מסמן את טווח הטעות הצפוי.'
          : 'נקודת מבט תוצג לאחר כיול אישי, כשהפנים מזוהות.'}
      </figcaption>
    </figure>
  );
}

function Timeline({ entries }) {
  return (
    <div className="ae-timeline" aria-label="ציר זמן של 60 השניות האחרונות" dir="ltr">
      {entries.length === 0
        ? <span className="ae-timeline-empty" dir="rtl">ציר הזמן יתמלא כשהמצלמה פועלת</span>
        : entries.map((entry) => (
          <span key={entry.t} className={`ae-timeline-slot ae-state--${entry.state.toLowerCase()}`} title={STATE_LABELS[entry.state]} />
        ))}
    </div>
  );
}

export default function AttentionEnginePanel({ onFrame }) {
  const videoRef = useRef(null);
  const camera = useCameraStream();
  const engine = useAttentionEngine(videoRef, camera.stream, { onFrame });
  const [enteredFullscreen, setEnteredFullscreen] = useState(false);
  const { frame, raw, fatigue, calibration, model } = engine;
  const calibrating = calibration.status === 'running';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = camera.stream;
    if (camera.stream) video.play?.().catch(() => {});
  }, [camera.stream]);

  const exitFullscreen = useCallback(() => {
    if (enteredFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setEnteredFullscreen(false);
  }, [enteredFullscreen]);

  useEffect(() => {
    if (!calibrating) exitFullscreen();
  }, [calibrating, exitFullscreen]);

  async function handleStartCalibration() {
    // Fullscreen makes the viewport match the physical screen better (optional).
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setEnteredFullscreen(true);
      }
    } catch {
      /* fullscreen is optional */
    }
    engine.startCalibration();
  }

  const stateClass = `ae-state--${frame.state.toLowerCase()}`;
  const signals = frame.signals || {};
  const cameraOn = Boolean(camera.stream);
  const lastFailure = calibration.lastResult === 'failed' ? calibration.failure : null;

  return (
    <section className="ae-panel" aria-labelledby="ae-title" dir="rtl" lang="he">
      <header className="ae-header">
        <span className="ae-kicker">מנוע זיהוי מבט · גרסת פיתוח</span>
        <h2 id="ae-title">זיהוי מבט לכיוון המסך</h2>
        <p className="ae-disclaimer">
          המנוע מעריך <strong>לאן מופנה המבט</strong> לפי המצלמה. זו אינה מדידה של ריכוז או הבנה:
          אפשר להביט במסך בלי להתרכז, ולהסיט מבט בזמן חשיבה.
        </p>
      </header>

      <div className="ae-grid">
        <div className="ae-camera-card">
          <div className="ae-video-frame">
            <video ref={videoRef} className="ae-video" muted playsInline autoPlay aria-label="תצוגה חיה מהמצלמה" hidden={!cameraOn} />
            {!cameraOn && (
              <div className="ae-video-off">
                <strong>המצלמה כבויה</strong>
                <span>הווידאו מעובד בדפדפן בלבד ואינו נשמר או נשלח.</span>
              </div>
            )}
            {cameraOn && (
              <span className="ae-video-badge" aria-live="off">
                {engine.status === 'loading' ? 'טוען מודל…' : `${engine.fps} פריימים/שנ׳`}
              </span>
            )}
          </div>
          <div className="ae-actions">
            <button
              type="button"
              className={`ae-button ${cameraOn ? 'ae-button--ghost' : 'ae-button--primary'}`}
              onClick={cameraOn ? camera.stop : camera.start}
              disabled={camera.status === 'starting'}
            >
              {cameraOn ? 'כיבוי מצלמה' : camera.status === 'starting' ? 'מתחברים למצלמה…' : 'הפעלת מצלמה'}
            </button>
            <button
              type="button"
              className="ae-button ae-button--primary"
              onClick={handleStartCalibration}
              disabled={engine.status !== 'running' || calibrating}
            >
              {model ? 'כיול מחדש' : 'כיול אישי (כ-20 שניות)'}
            </button>
            {model && (
              <button type="button" className="ae-button ae-button--ghost" onClick={engine.clearCalibration}>
                מחיקת הכיול
              </button>
            )}
          </div>
          {camera.error && <p className="ae-error" role="alert">{camera.error}</p>}
          {engine.error && <p className="ae-error" role="alert">{engine.error}</p>}
          {lastFailure && <p className="ae-error" role="alert">{CALIBRATION_FAILURE_TEXTS[lastFailure]}</p>}
          {calibration.lastResult === 'done' && model && (
            <p className="ae-success" role="status">הכיול הושלם. איכות הכיול: {QUALITY_TEXTS[model.quality]}.</p>
          )}
        </div>

        <div className="ae-state-card">
          <span className="ae-label">מצב נוכחי</span>
          <strong className={`ae-state ${stateClass}`} role="status" aria-live="polite" aria-label="מצב המבט">
            {STATE_LABELS[frame.state]}
          </strong>
          <div className="ae-confidence">
            <span>ודאות</span>
            <QualityBar value={frame.confidence} label="ודאות" />
            <b>{formatPercent(frame.confidence)}</b>
          </div>
          <p className="ae-reason">{REASON_TEXTS[frame.reason]}</p>
          {frame.recalibrationSuggested && <p className="ae-hint">מומלץ לבצע כיול מחדש.</p>}
          <GazeMap raw={raw} modelError={raw?.modelUsed === 'head-only' ? model?.headOnlyError : model?.fullError ?? model?.error} />
          <span className="ae-label">60 השניות האחרונות</span>
          <Timeline entries={engine.timeline} />
          <ul className="ae-legend" aria-label="מקרא">
            {Object.values(ATTENTION_STATES).map((state) => (
              <li key={state}><span className={`ae-legend-dot ae-state--${state.toLowerCase()}`} />{STATE_LABELS[state]}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ae-diagnostics">
        <section aria-labelledby="ae-signals-title">
          <h3 id="ae-signals-title">מה המנוע מודד</h3>
          <table className="ae-table">
            <tbody>
              <tr><th>איכות זיהוי פנים</th><td><QualityBar value={signals.faceQuality} label="איכות פנים" /></td></tr>
              <tr><th>תנוחת ראש (סבסוב / הטיה / גלגול)</th><td>{formatNumber(signals.headYaw, 0, '°')} / {formatNumber(signals.headPitch, 0, '°')} / {formatNumber(signals.headRoll, 0, '°')}</td></tr>
              <tr><th>איכות מדידת ראש</th><td><QualityBar value={signals.headQuality} label="איכות ראש" /></td></tr>
              <tr><th>מיקום אישונים (אופקי / אנכי)</th><td>{formatNumber(signals.eyeHorizontal, 2)} / {formatNumber(signals.eyeVertical, 2)}</td></tr>
              <tr><th>איכות מדידת עיניים</th><td><QualityBar value={signals.eyeQuality} label="איכות עיניים" /></td></tr>
              <tr><th>פתיחת עיניים</th><td>{formatNumber(signals.eyeOpenness, 2)}</td></tr>
              <tr><th>הסתברות למבט במסך (פריים בודד)</th><td>{formatPercent(signals.onScreenProbability)}</td></tr>
              <tr><th>החלטה גולמית ← אחרי החלקה</th><td>{raw ? STATE_LABELS[raw.state] : '—'} ← {STATE_LABELS[frame.state]}</td></tr>
              <tr><th>מודל בשימוש</th><td>{MODEL_USED_TEXTS[raw?.modelUsed ?? 'none']}</td></tr>
            </tbody>
          </table>
        </section>

        <section aria-labelledby="ae-calibration-title">
          <h3 id="ae-calibration-title">כיול אישי</h3>
          {model ? (
            <table className="ae-table">
              <tbody>
                <tr><th>איכות</th><td>{QUALITY_TEXTS[model.quality]}</td></tr>
                <tr><th>טעות צפויה (חלק מרוחב המסך)</th><td>{formatPercent(model.error)}</td></tr>
                <tr><th>משתמש בעיניים</th><td>{model.usesEyes ? 'כן' : 'לא (ראש בלבד)'}</td></tr>
                <tr><th>מדידות בכיול</th><td>{model.samples}</td></tr>
              </tbody>
            </table>
          ) : (
            <p>עדיין אין כיול. בכיול מביטים ב-9 נקודות על המסך, וכך המנוע לומד את המצלמה, את המיקום ואת תנועות הראש והעיניים שלכם. הכיול נשמר בזיכרון הדף בלבד.</p>
          )}
        </section>

        <section aria-labelledby="ae-fatigue-title">
          <h3 id="ae-fatigue-title">סימני עייפות אפשריים</h3>
          <table className="ae-table">
            <tbody>
              <tr><th>קצב מצמוץ לדקה</th><td>{fatigue?.blinkRatePerMinute != null ? Math.round(fatigue.blinkRatePerMinute) : `נאסף… (${fatigue?.observedSeconds ?? 0} שנ׳)`}</td></tr>
              <tr><th>עיניים עצומות כעת</th><td>{fatigue?.eyesClosed == null ? '—' : fatigue.eyesClosed ? 'כן' : 'לא'}</td></tr>
              <tr><th>פיהוקים אפשריים (5 דק׳)</th><td>{fatigue?.yawnsInWindow ?? 0}</td></tr>
            </tbody>
          </table>
          <p className="ae-fatigue-list" role="status">
            {frame.fatigueIndicators.length
              ? frame.fatigueIndicators.map((indicator) => FATIGUE_TEXTS[indicator]).join(' · ')
              : 'לא זוהו סימנים כרגע.'}
          </p>
          <p className="ae-note">אלה סימנים אפשריים בלבד, לא אבחנה. תאורה, יובש בעיניים, דיבור ומשקפיים משפיעים עליהם.</p>
        </section>

        <details className="ae-limits">
          <summary>מה המנוע יכול ומה אינו יכול לזהות</summary>
          <ul>
            <li>יכול: להעריך אם הראש והעיניים מופנים למסך, לזהות היעדר פנים, ולסמן מצבים לא ודאיים.</li>
            <li>לא יכול: למדוד ריכוז, הבנה או עניין. גם לא לדעת על מה בדיוק מסתכלים מחוץ למסך.</li>
            <li>הדיוק תלוי בתאורה, במשקפיים, בגודל הפנים בתמונה ובכך שלא זזים מהמיקום שבו בוצע הכיול.</li>
            <li>הסתכלות על המקלדת או על מחברת נחשבת מבט מחוץ למסך.</li>
            <li>כל העיבוד מתבצע בדפדפן. וידאו, נקודות פנים ונתוני כיול אינם נשמרים ואינם נשלחים.</li>
          </ul>
        </details>
      </div>

      <CalibrationOverlay calibration={calibration} onCancel={engine.cancelCalibration} />
    </section>
  );
}
