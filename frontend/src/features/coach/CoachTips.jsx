import { courseUrl, lessonUrl } from '../courses/courseRoutes.js';
import { formatClock } from '../learning/learningApi.js';
import './Coach.css';

const lessonLink = (tip) => (tip.lessonId ? lessonUrl(tip.lessonId) : null);

/** Hebrew text, evidence and action for one deterministic coach tip. */
export function describeTip(tip) {
  const e = tip.evidence || {};
  const where = tip.lessonTitle ? `״${tip.lessonTitle}״` : '';
  switch (tip.kind) {
    case 'take_break':
      return {
        title: 'הגיע הזמן להפסקה קצרה',
        evidence: `למדתם כ-${e.activeMinutes} דקות פעילות בשעתיים האחרונות.`,
        action: null,
      };
    case 'review_before_next':
      return {
        title: `לחזור על ${where} לפני שממשיכים`,
        evidence: `השיעור הושלם, אבל ${e.count === 1 ? 'קטע אחד ממתין' : `${e.count} קטעים ממתינים`} לחזרה (כ-${formatClock(e.seconds)}). השיעור הבא: ״${e.nextLessonTitle}״.`,
        action: { href: '/review', label: 'לקטעים לחזרה' },
      };
    case 'review_flagged':
      return {
        title: `קטעים לחזרה בשיעור ${where}`,
        evidence: `${e.count === 1 ? 'קטע אחד ממתין' : `${e.count} קטעים ממתינים`} לחזרה, הראשון מ-${formatClock(e.firstStart)}.`,
        action: { href: '/review', label: 'לקטעים לחזרה' },
      };
    case 'continue_lesson':
      return {
        title: `להמשיך את ${where}`,
        evidence: `עצרתם בדקה ${formatClock(e.positionSeconds)}${e.durationSeconds ? ` מתוך ${formatClock(e.durationSeconds)}` : ''}${e.daysAgo ? `, לפני ${e.daysAgo} ימים` : ''}.`,
        action: { href: lessonLink(tip), label: 'להמשיך מהמקום שעצרתם' },
      };
    case 'return_to_bookmark':
      return {
        title: `לחזור לסימניות ב-${where}`,
        evidence: `סימנתם ${e.count === 1 ? 'רגע אחד' : `${e.count} רגעים`} לחזרה בשיעור הזה.`,
        action: { href: '/review', label: 'לסימניות' },
      };
    case 'retry_quiz':
      return {
        title: `לנסות שוב את שאלות החזרה של ${where}`,
        evidence: `בניסיון האחרון ${e.wrong} מתוך ${e.total} תשובות לא היו נכונות.`,
        action: { href: lessonLink(tip), label: 'לשאלות החזרה' },
      };
    case 'goal_behind':
      return {
        title: `המטרה השבועית בקורס ״${tip.courseTitle}״`,
        evidence: `השבוע למדתם ${e.doneMinutes} דקות מתוך ${e.targetMinutes}. לפי הקצב המתוכנן הייתם אמורים להגיע לכ-${e.expectedMinutes} דקות עד היום.`,
        action: { href: '/study', label: 'לתוכנית הלימוד' },
      };
    case 'resume_course':
      return {
        title: `לחזור לקורס ״${tip.courseTitle}״`,
        evidence: e.daysAgo === null || e.daysAgo === undefined
          ? `עדיין לא התחלתם. הושלמו ${e.completed} מתוך ${e.total} שיעורים.`
          : `הלמידה האחרונה בקורס הייתה לפני ${e.daysAgo} ימים. הושלמו ${e.completed} מתוך ${e.total} שיעורים.`,
        action: tip.lessonId ? { href: lessonLink(tip), label: 'להמשיך בקורס' } : { href: courseUrl(tip.courseId), label: 'לעמוד הקורס' },
      };
    case 'start_learning':
    default:
      return {
        title: 'להתחיל ללמוד',
        evidence: 'עדיין אין לכם קורסים. צרו קורס אישי או הירשמו לקורס מהקטלוג.',
        action: { href: '/courses/catalog', label: 'לקטלוג הקורסים' },
      };
  }
}

export default function CoachTips({ tips, status, error, onRetry, limit, compact = false }) {
  if (status === 'loading') {
    return <p className="course-state" role="status"><span className="route-loading-spinner" aria-hidden="true" /> מכינים המלצות…</p>;
  }
  if (status === 'error') {
    return (
      <div className="course-state course-state--error" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" className="signature-secondary-button" onClick={() => onRetry()}>לנסות שוב</button>}
      </div>
    );
  }
  const list = Array.isArray(tips) ? tips : [];
  const shown = list.slice(0, limit ?? list.length);
  if (shown.length === 0) {
    return <p className="coach-empty">אין כרגע המלצות. כל הכבוד, הכול מעודכן!</p>;
  }
  return (
    <ol className={`coach-list${compact ? ' coach-list--compact' : ''}`}>
      {shown.map((tip) => {
        const text = describeTip(tip);
        return (
          <li key={`${tip.kind}-${tip.lessonId || tip.courseId || ''}`} className={`coach-tip coach-tip--${tip.kind}`}>
            <strong>{text.title}</strong>
            <p><span className="coach-why">למה?</span> {text.evidence}</p>
            {text.action?.href && <a className="course-link" href={text.action.href}>{text.action.label} <span aria-hidden="true">←</span></a>}
          </li>
        );
      })}
    </ol>
  );
}
