import { useState } from 'react';
import { formatClock } from '../learning/learningApi.js';
import ReplayItemCard from './ReplayItemCard.jsx';
import { bookmarkRange } from './replayLogic.js';
import './Replay.css';

/**
 * ReplayAI section of a lesson. Suggestions come from the stored attention
 * segments (video time only); bookmarks are created by the learner. Playing
 * an item uses the lesson's existing video player (`onPlay`).
 */
export default function ReplayPanel({ replay, trackable, hasVideo, provider, getCurrentTime, getDuration, onPlay, activeItemId }) {
  const [showHidden, setShowHidden] = useState(false);
  const [markStart, setMarkStart] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  if (!hasVideo) return null;

  if (!trackable) {
    return (
      <section className="replay-panel" aria-labelledby="replay-title">
        <h2 id="replay-title">ReplayAI – קטעים לחזרה</h2>
        <p className="replay-limit" role="note">
          {provider === 'page'
            ? 'הסרטון של השיעור נפתח באתר חיצוני, ולכן FocusMind אינו יודע איזה רגע בסרטון צפיתם בו.'
            : 'בסרטון YouTube הדף אינו יכול לקרוא את מיקום הצפייה.'}
          {' '}ReplayAI לא מציע כאן קטעים ואי אפשר לסמן רגעים, כי לא נמציא זמנים שלא נמדדו.
          קטעים לחזרה זמינים בסרטונים שהועלו ובקישורים ישירים לקובצי וידאו.
        </p>
      </section>
    );
  }

  const items = replay.items;
  const visible = items.filter((item) => showHidden || item.status !== 'dismissed');
  const hiddenCount = items.filter((item) => item.status === 'dismissed').length;
  const pending = items.filter((item) => item.status === 'new').length;

  async function saveBookmark(range) {
    const created = await replay.addBookmark({ ...range, note: note.trim() });
    if (created) {
      setNote('');
      setMessage(created.endSeconds == null ? `נשמרה סימנייה בנקודה ${formatClock(created.startSeconds)}.` : 'הקטע נשמר לחזרה.');
    }
  }

  function markPoint() {
    void saveBookmark({ startSeconds: Math.round((getCurrentTime() || 0) * 100) / 100 });
  }

  function toggleRange() {
    const now = getCurrentTime() || 0;
    if (markStart === null) {
      setMarkStart(now);
      setMessage(`תחילת הקטע סומנה ב-${formatClock(now)}. המשיכו לצפות ולחצו "סיום סימון הקטע".`);
      return;
    }
    const range = bookmarkRange(markStart, now, getDuration());
    setMarkStart(null);
    void saveBookmark(range);
  }

  return (
    <section className="replay-panel" aria-labelledby="replay-title">
      <div className="replay-panel-head">
        <div>
          <h2 id="replay-title">ReplayAI – קטעים לחזרה</h2>
          <p>
            {pending ? `${pending} קטעים ממתינים לחזרה.` : 'אין כרגע קטעים שממתינים לחזרה.'}
            {' '}ההמלצות נבנות מזמני הסרטון שבהם המבט הופנה מהמסך, הפנים לא זוהו או הניגון נעצר שוב ושוב.
          </p>
        </div>
      </div>

      <div className="replay-bookmark" role="group" aria-label="סימון רגעים לחזרה">
        <button type="button" className="signature-secondary-button" onClick={markPoint}>סימון הרגע הנוכחי</button>
        <button type="button" className="signature-secondary-button" onClick={toggleRange} aria-pressed={markStart !== null}>
          {markStart === null ? 'התחלת סימון קטע' : 'סיום סימון הקטע'}
        </button>
        <label>
          <span className="visually-hidden">הערה לסימנייה</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="הערה (לא חובה)" />
        </label>
      </div>
      {message && <p className="course-inline-success" role="status">{message}</p>}
      {replay.actionError && <p className="course-inline-error" role="alert">{replay.actionError}</p>}

      {replay.status === 'loading' && <p className="course-state" role="status"><span className="route-loading-spinner" aria-hidden="true" /> טוענים קטעים לחזרה…</p>}
      {replay.status === 'error' && (
        <div className="course-state course-state--error" role="alert">
          <p>{replay.error}</p>
          <button type="button" className="signature-secondary-button" onClick={() => replay.reload()}>לנסות שוב</button>
        </div>
      )}
      {replay.status === 'ready' && visible.length === 0 && (
        <p className="replay-empty">
          עדיין אין קטעים לחזרה. הם יופיעו אחרי צפייה עם מצלמה פעילה, כשיזוהו אירועים משמעותיים, או כשתסמנו רגע בעצמכם.
        </p>
      )}
      {visible.length > 0 && (
        <ol className="replay-list">
          {visible.map((item) => (
            <ReplayItemCard
              key={item.id}
              item={item}
              active={item.id === activeItemId}
              onStatus={replay.setStatus}
              onDelete={replay.removeBookmark}
              playAction={(
                <button type="button" className="signature-primary-button" onClick={() => onPlay(item)}>
                  ניגון הקטע <span aria-hidden="true">▶</span>
                </button>
              )}
            />
          ))}
        </ol>
      )}
      {hiddenCount > 0 && (
        <button type="button" className="lesson-inline-button" onClick={() => setShowHidden((value) => !value)}>
          {showHidden ? 'הסתרת קטעים שסומנו כלא רלוונטיים' : `הצגת ${hiddenCount} קטעים מוסתרים`}
        </button>
      )}
      <p className="replay-disclaimer">
        כיוון המבט אינו מוכיח ריכוז או הבנה. אלה רק הצעות לחזרה, ואתם מחליטים אם הן רלוונטיות.
      </p>
    </section>
  );
}
