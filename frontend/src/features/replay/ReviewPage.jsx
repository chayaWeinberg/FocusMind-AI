import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import { LoadState } from '../courses/CourseParts.jsx';
import { courseUrl } from '../courses/courseRoutes.js';
import useLoader from '../courses/useLoader.js';
import { deleteBookmark, listReplayItems, setReplayStatus } from '../learning/learningApi.js';
import ReplayItemCard from './ReplayItemCard.jsx';
import '../courses/Courses.css';
import './Replay.css';

export const replayItemUrl = (item) => `/learning/lessons/${encodeURIComponent(item.lessonId)}/review/${encodeURIComponent(item.id)}`;

const FILTERS = [
  { key: 'pending', label: 'ממתינים לחזרה' },
  { key: 'reviewed', label: 'נבדקו' },
  { key: 'dismissed', label: 'הוסתרו' },
  { key: 'all', label: 'הכול' },
];

function groupByLesson(items) {
  const groups = [];
  const index = new Map();
  for (const item of items) {
    if (!index.has(item.lessonId)) {
      index.set(item.lessonId, groups.length);
      groups.push({ lessonId: item.lessonId, courseId: item.courseId, lessonTitle: item.lessonTitle, courseTitle: item.courseTitle, items: [] });
    }
    groups[index.get(item.lessonId)].items.push(item);
  }
  return groups;
}

/** ReplayAI overview: every suggestion and bookmark of the learner. */
export default function ReviewPage() {
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  const { status, data, error: loadError, reload, setData } = useLoader(() => listReplayItems({ status: filter }), [filter]);
  const items = data || [];

  async function changeStatus(item, nextStatus) {
    setError('');
    try {
      const updated = await setReplayStatus(item.id, nextStatus);
      const keep = filter === 'all' || (filter === 'pending' ? updated.status === 'new' : updated.status === filter);
      setData(keep ? items.map((entry) => (entry.id === item.id ? { ...entry, ...updated } : entry)) : items.filter((entry) => entry.id !== item.id));
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function remove(item) {
    setError('');
    try {
      await deleteBookmark(item.id);
      setData(items.filter((entry) => entry.id !== item.id));
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <AppShell active="review" labelledBy="review-title">
      <header className="courses-hero">
        <div>
          <small>ReplayAI</small>
          <h1 id="review-title">חזרה חכמה</h1>
          <p>
            קטעים מהשיעורים שכדאי אולי לראות שוב, לפי זמני הסרטון שבהם המבט הופנה מהמסך, הפנים לא זוהו או הניגון נעצר שוב ושוב,
            וגם רגעים שסימנתם בעצמכם. בחירה בקטע פותחת את השיעור ומנגנת בדיוק את הקטע.
          </p>
        </div>
      </header>

      <div className="replay-filters" role="tablist" aria-label="סינון קטעים">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={filter === option.key}
            className={filter === option.key ? 'is-active' : undefined}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="course-inline-error" role="alert">{error}</p>}
      <LoadState status={status} error={loadError} onRetry={reload} loadingText="טוענים קטעים לחזרה…" />
      {status === 'ready' && items.length === 0 && (
        <div className="course-empty">
          <strong>{filter === 'pending' ? 'אין קטעים שממתינים לחזרה' : 'אין קטעים להצגה'}</strong>
          <p>המלצות נוצרות אחרי צפייה בשיעור עם מצלמה פעילה. אפשר גם לסמן רגעים בזמן הצפייה.</p>
          <a className="signature-secondary-button" href="/courses">לקורסים שלי</a>
        </div>
      )}
      {status === 'ready' && groupByLesson(items).map((group) => (
        <section key={group.lessonId} className="courses-section replay-group" aria-label={`${group.courseTitle} – ${group.lessonTitle}`}>
          <div className="signature-section-heading">
            <div>
              <small><a href={courseUrl(group.courseId)}>{group.courseTitle}</a></small>
              <h2>{group.lessonTitle}</h2>
            </div>
          </div>
          <ol className="replay-list">
            {group.items.map((item) => (
              <ReplayItemCard
                key={item.id}
                item={item}
                onStatus={changeStatus}
                onDelete={remove}
                playAction={(
                  <a className="signature-primary-button" href={replayItemUrl(item)}>
                    לניגון הקטע בשיעור <span aria-hidden="true">←</span>
                  </a>
                )}
              />
            ))}
          </ol>
        </section>
      ))}
    </AppShell>
  );
}
