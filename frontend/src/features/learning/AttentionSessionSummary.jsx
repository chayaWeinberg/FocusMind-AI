import { ATTENTION_STATES as S } from '../attention-engine/contracts.js';
import { STATE_LABELS } from '../attention-engine/labels.js';
import { NOT_MEASURED, TIMELINE_SLOT_MS } from './attentionSessionStats.js';

const ROWS = Object.freeze([
  { key: S.ON_SCREEN, label: STATE_LABELS[S.ON_SCREEN] },
  { key: S.OFF_SCREEN, label: STATE_LABELS[S.OFF_SCREEN] },
  { key: S.FACE_ABSENT, label: STATE_LABELS[S.FACE_ABSENT] },
  { key: S.UNCERTAIN, label: STATE_LABELS[S.UNCERTAIN] },
  { key: NOT_MEASURED, label: 'לא נמדד (מצלמה כבויה)' },
]);

export function formatDuration(milliseconds) {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function slotClass(state) {
  return `attention-slot attention-slot--${state.toLowerCase()}`;
}

/** Live session statistics, attributed only while the session timer runs. */
export default function AttentionSessionSummary({ stats }) {
  const hasData = stats.totalMs >= 1000;
  return (
    <section className="signature-assistant-card attention-summary" aria-labelledby="attention-summary-title">
      <span aria-hidden="true">✧</span>
      <small>סטטיסטיקה של המפגש</small>
      <h2 id="attention-summary-title">Focus Monitor</h2>
      {hasData ? (
        <>
          <div className="signature-learning-monitor-metrics">
            <div className="attention-summary-concentration">
              <span>ריכוז ממוצע במפגש (הערכה)</span>
              <strong aria-label={`ריכוז ממוצע במפגש: ${stats.averageConcentration ?? 'לא נמדד'}`}>
                {stats.averageConcentration === null ? '—' : `${stats.averageConcentration}%`}
              </strong>
            </div>
            {ROWS.map(({ key, label }) => (
              <div key={key}>
                <span>{label}</span>
                <strong aria-label={`${label}: ${formatDuration(stats.byState[key])}`}>
                  {formatDuration(stats.byState[key])} · {Math.round(stats.shares[key] * 100)}%
                </strong>
              </div>
            ))}
            <div>
              <span>יציאות מהמסך</span>
              <strong>{stats.awayEpisodes}</strong>
            </div>
            <div>
              <span>רצף ארוך ביותר מול המסך</span>
              <strong>{formatDuration(stats.longestOnScreenMs)}</strong>
            </div>
          </div>
          <p className="attention-summary-note">
            הנתונים הם הערכה לפי כיוון המבט בזמן שהשעון פועל. זמן לא ודאי לא נספר כקשב או כהסחה.
          </p>
        </>
      ) : (
        <p>הסטטיסטיקה תתחיל להיאסף כשהסרטון יופעל. הפעילו גם את המצלמה כדי למדוד את כיוון המבט.</p>
      )}
    </section>
  );
}

export function AttentionTimeline({ timeline }) {
  if (timeline.length === 0) {
    return (
      <>
        <p>ציר הזמן יתמלא בזמן מפגש פעיל. כל משבצת מייצגת {TIMELINE_SLOT_MS / 1000} שניות.</p>
        <span>עדיין לא נאספו מדידות</span>
      </>
    );
  }
  return (
    <>
      <div className="attention-timeline" role="img" aria-label={`ציר זמן של ${timeline.length} משבצות של ${TIMELINE_SLOT_MS / 1000} שניות`} dir="ltr">
        {timeline.map((state, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} className={slotClass(state)} title={state === NOT_MEASURED ? 'לא נמדד' : STATE_LABELS[state]} />
        ))}
      </div>
      <ul className="attention-legend" aria-label="מקרא">
        {ROWS.map(({ key, label }) => (
          <li key={key}><span className={slotClass(key)} aria-hidden="true" />{label}</li>
        ))}
      </ul>
    </>
  );
}
