import { useState } from 'react';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import { formatClock } from '../learning/learningApi.js';
import { STATUS_LABELS, itemDuration, itemRange, itemTitle, reasonLines } from './replayLogic.js';

/**
 * One suggestion or bookmark. `playAction` is either a button (lesson page,
 * reuses the existing player) or a link to the lesson (review page).
 */
export default function ReplayItemCard({ item, playAction, onStatus, onDelete, active = false, heading = null }) {
  const [busy, setBusy] = useState(false);
  const duration = itemDuration(item);
  const lines = reasonLines(item);
  const isBookmark = item.kind === 'bookmark';

  async function run(action) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`replay-item replay-item--${item.kind} replay-item--${item.status}${active ? ' is-active' : ''}`}
      aria-label={`${itemTitle(item)} ${itemRange(item)}`}
    >
      <div className="replay-item-head">
        <span className={`replay-kind replay-kind--${item.kind}`}>{isBookmark ? 'סימנייה שלכם' : 'המלצת ReplayAI'}</span>
        <strong className="replay-range" dir="ltr">{itemRange(item)}</strong>
        <span className={`replay-status replay-status--${item.status}`}>
          <span aria-hidden="true">{item.status === 'reviewed' ? '✓ ' : item.status === 'dismissed' ? '– ' : '● '}</span>
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      {heading}
      <p className="replay-item-meta">
        {duration !== null ? <>משך: {formatClock(duration)}</> : <>נקודה בסרטון</>}
        {!isBookmark && <> · {item.eventCount === 1 ? 'אירוע אחד' : `${item.eventCount} אירועים`}</>}
      </p>
      {lines.length > 0 && (
        <ul className="replay-reasons">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      {item.note && <p className="replay-note">״{item.note}״</p>}
      <div className="replay-item-actions">
        {playAction}
        {item.status !== 'reviewed' && (
          <button type="button" className="signature-secondary-button" disabled={busy} onClick={() => run(() => onStatus(item, 'reviewed'))}>
            סימון כנבדק
          </button>
        )}
        {item.status !== 'new' && (
          <button type="button" className="signature-secondary-button" disabled={busy} onClick={() => run(() => onStatus(item, 'new'))}>
            החזרה לרשימת החזרה
          </button>
        )}
        {!isBookmark && item.status !== 'dismissed' && (
          <button type="button" className="signature-secondary-button" disabled={busy} onClick={() => run(() => onStatus(item, 'dismissed'))}>
            לא רלוונטי – הסתרה
          </button>
        )}
        {isBookmark && onDelete && (
          <ConfirmButton
            label="מחיקת הסימנייה"
            confirmLabel="כן, למחוק"
            question="למחוק את הסימנייה?"
            busy={busy}
            onConfirm={() => run(() => onDelete(item))}
          />
        )}
      </div>
    </li>
  );
}
