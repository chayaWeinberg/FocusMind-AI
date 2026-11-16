import { useState } from 'react';
import { formatClock } from './learningApi.js';
import './SmartTimer.css';

function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function PreferencesForm({ preferences, onSave, onClose }) {
  // Raw text while typing; validated on save (clamping per keystroke breaks typing).
  const [values, setValues] = useState({
    ...preferences,
    studyMinutes: String(preferences.studyMinutes),
    breakMinutes: String(preferences.breakMinutes),
  });
  const [state, setState] = useState({ busy: false, error: '' });
  const number = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    const studyMinutes = Number.parseInt(values.studyMinutes, 10);
    const breakMinutes = Number.parseInt(values.breakMinutes, 10);
    if (!(studyMinutes >= 5 && studyMinutes <= 180) || !(breakMinutes >= 1 && breakMinutes <= 60)) {
      setState({ busy: false, error: 'זמן למידה: 5 עד 180 דקות. הפסקה: 1 עד 60 דקות.' });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      await onSave({ studyMinutes, breakMinutes, breakReminders: values.breakReminders });
      onClose();
    } catch (error) {
      setState({ busy: false, error: error.message || 'לא הצלחנו לשמור.' });
    }
  }

  return (
    <form className="smart-timer-settings" onSubmit={submit} aria-label="הגדרות שעון למידה">
      <label>
        <span>דקות למידה לפני תזכורת להפסקה</span>
        <input type="number" min={5} max={180} value={values.studyMinutes} onChange={number('studyMinutes')} />
      </label>
      <label>
        <span>אורך הפסקה מומלץ (דקות)</span>
        <input type="number" min={1} max={60} value={values.breakMinutes} onChange={number('breakMinutes')} />
      </label>
      <label className="smart-timer-check">
        <input
          type="checkbox"
          checked={values.breakReminders}
          onChange={(event) => setValues((previous) => ({ ...previous, breakReminders: event.target.checked }))}
        />
        <span>להציג תזכורת עדינה להפסקה</span>
      </label>
      <div className="smart-timer-buttons">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>{state.busy ? 'שומרים…' : 'שמירה'}</button>
        <button type="button" className="signature-secondary-button" onClick={onClose}>ביטול</button>
      </div>
      {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
    </form>
  );
}

/**
 * Smart Timer: active learning time (the existing session clock), break time,
 * the video position, and an optional study/break rhythm. It never pauses the
 * video by itself; breaks start only when the learner asks.
 */
export default function SmartTimerCard({
  elapsedSeconds,
  statusText,
  videoPosition,
  preferences,
  onSavePreferences,
  block,
  onBreak,
  breakSeconds,
  breakTotalSeconds,
  onStartBreak,
  onEndBreak,
  remindBreak,
  onSnooze,
  canBreak,
}) {
  const [editing, setEditing] = useState(false);
  const breakDone = onBreak && breakSeconds >= preferences.breakMinutes * 60;

  return (
    <section className="signature-timer-card smart-timer" aria-labelledby="session-title">
      <small id="session-title">שעון למידה חכם</small>
      <strong aria-label={`זמן למידה פעיל ${formatElapsed(elapsedSeconds)}`}>
        <span>{formatElapsed(elapsedSeconds)}</span>
      </strong>
      <span>זמן למידה פעיל (רק כשהסרטון מתנגן)</span>
      <span role="status">{onBreak ? 'בהפסקה' : statusText}</span>

      <dl className="smart-timer-clocks">
        <div><dt>זמן הפסקות</dt><dd>{formatClock(breakTotalSeconds)}</dd></div>
        <div><dt>מיקום בסרטון</dt><dd dir="ltr">{videoPosition === null ? '—' : formatClock(videoPosition)}</dd></div>
      </dl>

      <div className="smart-timer-block">
        <div className="smart-timer-block-label">
          <span>בלוק למידה של {preferences.studyMinutes} דק׳</span>
          <span>{block.percent}%</span>
        </div>
        <div role="progressbar" aria-label="התקדמות בבלוק הלמידה" aria-valuemin={0} aria-valuemax={100} aria-valuenow={block.percent}>
          <span style={{ width: `${block.percent}%` }} />
        </div>
      </div>

      {remindBreak && (
        <div className="smart-timer-reminder" role="status">
          <p>עברו {preferences.studyMinutes} דקות של למידה פעילה. אולי זה זמן טוב להפסקה קצרה?</p>
          <div className="smart-timer-buttons">
            <button type="button" className="signature-primary-button" onClick={onStartBreak}>להפסקה של {preferences.breakMinutes} דק׳</button>
            <button type="button" className="signature-secondary-button" onClick={onSnooze}>להמשיך ללמוד</button>
          </div>
        </div>
      )}

      {onBreak ? (
        <div className="smart-timer-break" role="group" aria-label="הפסקה">
          <p>
            הפסקה: <b dir="ltr">{formatClock(breakSeconds)}</b>
            {breakDone ? ' · ההפסקה המומלצת הסתיימה, אפשר לחזור כשנוח לכם.' : ` מתוך ${preferences.breakMinutes} דק׳ מומלצות`}
          </p>
          <button type="button" className="signature-primary-button" onClick={onEndBreak}>סיום ההפסקה</button>
        </div>
      ) : (
        <div className="smart-timer-buttons">
          <button type="button" className="signature-secondary-button" onClick={onStartBreak} disabled={!canBreak}>התחלת הפסקה</button>
          <button type="button" className="signature-secondary-button" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
            הגדרות שעון
          </button>
        </div>
      )}
      {editing && !onBreak && (
        <PreferencesForm preferences={preferences} onSave={onSavePreferences} onClose={() => setEditing(false)} />
      )}
    </section>
  );
}
