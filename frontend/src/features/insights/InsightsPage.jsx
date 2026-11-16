import AppShell from '../../components/AppShell.jsx';
import { BarChart, HBarList, StateDistribution } from '../../components/charts/Charts.jsx';
import { LoadState } from '../courses/CourseParts.jsx';
import useLoader from '../courses/useLoader.js';
import { courseUrl, lessonUrl } from '../courses/courseRoutes.js';
import { formatClock, formatDate, formatDateTime, formatMinutes, getInsights } from '../learning/learningApi.js';
import '../courses/Courses.css';
import './Insights.css';

export const STATE_LABELS = Object.freeze({
  ON_SCREEN: 'מבט לכיוון המסך',
  OFF_SCREEN: 'מבט מחוץ למסך',
  FACE_ABSENT: 'פנים לא זוהו',
  UNCERTAIN: 'לא ודאי',
  NOT_MEASURED: 'לא נמדד (מצלמה כבויה)',
});

const SESSION_STATUS = { active: 'פעיל עכשיו', ended: 'הסתיים', interrupted: 'נקטע (הדף נסגר)' };
const WEEKDAY = new Intl.DateTimeFormat('he-IL', { weekday: 'narrow' });

function Tile({ label, value, hint }) {
  return (
    <article className="insight-tile">
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}

export default function InsightsPage() {
  const { status, data, error, reload } = useLoader(getInsights, []);

  return (
    <AppShell active="insights" labelledBy="insights-title">
      <header className="courses-hero">
        <div>
          <small>FocusInsights</small>
          <h1 id="insights-title">תובנות למידה</h1>
          <p>כל המספרים כאן מחושבים מהלמידה שנשמרה בחשבון שלכם: זמן צפייה פעיל, שיעורים שהושלמו, קטעים לחזרה וזמן המבט לכיוון המסך.</p>
        </div>
      </header>
      <LoadState status={status} error={error} onRetry={reload} loadingText="מחשבים את התובנות שלך…" />
      {status === 'ready' && data && <InsightsContent data={data} />}
    </AppShell>
  );
}

export function InsightsContent({ data }) {
  const { totals, streak, replay, quizzes } = data;
  const newUser = totals.sessionCount === 0 && totals.lessonsCompleted === 0;
  const daily = data.daily.map((day) => {
    const date = new Date(`${day.date}T12:00:00`);
    return {
      key: day.date,
      label: formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'numeric' }),
      short: Number.isNaN(date.getTime()) ? '' : `${WEEKDAY.format(date)} ${date.getDate()}`,
      value: Math.round(day.activeMs / 60000),
      display: formatMinutes(day.activeMs),
    };
  });
  const weekly = data.weekly.map((week) => ({
    key: week.weekStart,
    label: `שבוע מ-${formatDate(week.weekStart)}`,
    short: formatDate(week.weekStart),
    value: Math.round(week.activeMs / 60000),
    display: formatMinutes(week.activeMs),
  }));
  const share = data.weekly.map((week) => {
    const percent = week.measuredMs ? Math.round((100 * week.onScreenMs) / week.measuredMs) : 0;
    return {
      key: week.weekStart,
      label: `שבוע מ-${formatDate(week.weekStart)}`,
      short: formatDate(week.weekStart),
      value: percent,
      display: week.measuredMs ? `${percent}% מהזמן שנמדד` : 'אין מדידה',
    };
  });
  const parts = Object.keys(STATE_LABELS).map((key) => ({
    key,
    label: STATE_LABELS[key],
    value: data.attention[key] || 0,
    display: formatMinutes(data.attention[key] || 0),
  }));
  const courses = data.byCourse.map((course) => ({
    key: course.courseId,
    label: course.title,
    value: Math.round(course.activeMs / 60000),
    display: `${formatMinutes(course.activeMs)} · ${course.percent}%`,
  }));

  return (
    <>
      {newUser && (
        <div className="course-empty">
          <strong>עדיין אין נתוני למידה</strong>
          <p>התובנות יתמלאו אחרי שתצפו בשיעור מתוך קורס. לא מוצגים כאן מספרים לדוגמה.</p>
          <a className="signature-primary-button" href="/courses">לקורסים שלי</a>
        </div>
      )}

      <section className="insight-tiles" aria-label="סיכום">
        <Tile label="זמן למידה פעיל היום" value={formatMinutes(totals.activeMsToday)} hint={`השבוע: ${formatMinutes(totals.activeMsThisWeek)}`} />
        <Tile label="זמן למידה פעיל בסך הכול" value={formatMinutes(totals.activeMs)} hint={`${totals.sessionCount} מפגשים · הפסקות: ${formatMinutes(totals.breakMs)}`} />
        <Tile label="שיעורים שהושלמו" value={totals.lessonsCompleted} hint={`השבוע: ${totals.lessonsCompletedThisWeek}`} />
        <Tile label="ימי למידה ברצף" value={streak.current} hint={`הרצף הארוך ביותר: ${streak.longest}${streak.activeToday ? ' · למדתם היום' : ''}`} />
        <Tile label="קטעים לחזרה (ReplayAI)" value={replay.pending} hint={`הוצעו ${replay.suggested} · נבדקו ${replay.reviewed} · סימניות ${replay.bookmarks}`} />
        <Tile label="שאלות חזרה" value={quizzes.attempts ? `${quizzes.averagePercent}%` : '—'} hint={quizzes.attempts ? `ממוצע ב-${quizzes.attempts} ניסיונות` : 'עוד לא עניתם על שאלות'} />
      </section>

      <section className="insight-grid">
        <article className="course-panel">
          <BarChart title="זמן למידה פעיל בכל יום (14 ימים, בדקות)" data={daily} valueName="דקות" emptyText="אין עדיין זמן למידה בשבועיים האחרונים." />
          <p className="insight-note">זמן פעיל נספר רק כשהסרטון מתנגן. השעון של הדפדפן קובע מה נחשב ״היום״.</p>
        </article>
        <article className="course-panel">
          <BarChart title="זמן למידה פעיל בכל שבוע (8 שבועות)" data={weekly} valueName="דקות" emptyText="אין עדיין זמן למידה ב-8 השבועות האחרונים." />
        </article>
        <article className="course-panel">
          <HBarList title="זמן למידה והתקדמות לפי קורס" data={courses} valueName="זמן והתקדמות" emptyText="עדיין לא נצבר זמן למידה בקורסים." />
          {data.byCourse.length > 0 && (
            <ul className="insight-course-links">
              {data.byCourse.map((course) => (
                <li key={course.courseId}>
                  <a href={courseUrl(course.courseId)}>{course.title}</a>: {course.completedLessons} מתוך {course.totalLessons} שיעורים הושלמו
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="course-panel">
          <StateDistribution title="התפלגות מצבי המבט בזמן צפייה" parts={parts} emptyText="עוד לא נמדד מבט בזמן צפייה. הפעילו את המצלמה בשיעור כדי לראות התפלגות." />
          <p className="insight-note">
            ״מבט לכיוון המסך״ אינו ציון ריכוז ואינו מדד מדעי להבנה. זה רק הזמן שבו כיוון הראש והעיניים פנה למסך.
            מצבים ״לא ודאי״ ו״לא נמדד״ לא נספרים כקשב או כהסחת דעת.
          </p>
        </article>
        <article className="course-panel">
          <BarChart title="זמן מבט לכיוון המסך, מתוך הזמן שנמדד, לפי שבוע (%)" data={share} valueName="אחוז" max={100} emptyText="אין עדיין שבועות עם מדידת מבט." />
        </article>
      </section>

      <section className="courses-section" aria-labelledby="sessions-title">
        <div className="signature-section-heading">
          <div>
            <small>מפגשי הלמידה האחרונים</small>
            <h2 id="sessions-title">היסטוריית מפגשים</h2>
          </div>
        </div>
        {data.recentSessions.length === 0 ? (
          <p className="coach-empty">עוד אין מפגשי למידה שמורים.</p>
        ) : (
          <div className="insight-table-wrap">
            <table className="insight-table">
              <thead>
                <tr>
                  <th scope="col">מתי</th>
                  <th scope="col">שיעור</th>
                  <th scope="col">זמן פעיל</th>
                  <th scope="col">הפסקות</th>
                  <th scope="col">זמן בסרטון</th>
                  <th scope="col">מצב</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSessions.map((session) => (
                  <tr key={session.id}>
                    <td>{formatDateTime(session.startedAt)}</td>
                    <td>
                      {session.lessonTitle
                        ? <a href={lessonUrl(session.lessonId)}>{session.lessonTitle}</a>
                        : 'שיעור שנמחק'}
                      <small>{session.courseTitle || 'קורס שנמחק'}</small>
                    </td>
                    <td>{formatMinutes(session.activeMs)}</td>
                    <td>{session.breakMs ? formatMinutes(session.breakMs) : '—'}</td>
                    <td>{session.trackable ? formatClock(session.videoSeconds) : 'לא נמדד (YouTube)'}</td>
                    <td>{SESSION_STATUS[session.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
