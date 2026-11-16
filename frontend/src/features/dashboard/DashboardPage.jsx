import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';
import { SidebarNav } from '../../components/AppShell.jsx';
import { listMyCourses } from '../courses/coursesApi.js';
import { CATALOG_URL, COURSES_URL, NEW_COURSE_URL } from '../courses/courseRoutes.js';
import { ContinueLink, CourseCard } from '../courses/CourseParts.jsx';
import useLoader from '../courses/useLoader.js';
import CoachTips from '../coach/CoachTips.jsx';
import { formatMinutes, getCoachTips, getInsights } from '../learning/learningApi.js';
import '../courses/Courses.css';

function overallProgress(courses) {
  const totals = courses.reduce((sum, course) => ({
    completed: sum.completed + (course.progress?.completedLessons || 0),
    total: sum.total + (course.progress?.totalLessons || 0),
  }), { completed: 0, total: 0 });
  return totals.total ? { ...totals, percent: Math.round((100 * totals.completed) / totals.total) } : null;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await logout();
    } catch {
      setError('לא הצלחנו להתנתק כרגע. בדקו את החיבור ונסו שוב.');
    } finally {
      setLoggingOut(false);
    }
  }

  const displayName = user?.displayName || 'לומד';
  const myCourses = useLoader(listMyCourses, []);
  const courses = myCourses.status === 'ready' ? myCourses.data : [];
  const progress = overallProgress(courses);
  const insights = useLoader(getInsights, []);
  const coach = useLoader(getCoachTips, []);
  // Only a well-formed payload is shown; anything else falls back to empty states.
  const insightsData = insights.data?.streak && insights.data?.totals && insights.data?.replay ? insights.data : null;
  const streak = insightsData?.streak;
  const pendingReview = insightsData?.replay.pending ?? 0;

  return (
    <main className="signature-production" dir="rtl" lang="he">
      <div className="signature-page signature-dashboard">
        <aside className="signature-dashboard-sidebar">
          <SignatureBrand />
          <SidebarNav active="dashboard" />
          <div className="signature-sidebar-user">
            <span aria-hidden="true">{displayName.slice(0, 1)}</span>
            <div>
              <strong>{displayName}</strong>
              <small>המרחב האישי שלך</small>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label={loggingOut ? 'מתנתקים...' : 'התנתקות'}
              title={loggingOut ? 'מתנתקים...' : 'התנתקות'}
            >
              {loggingOut ? '…' : '↗'}
            </button>
          </div>
        </aside>

        <div className="signature-dashboard-main">
          <header className="signature-dashboard-top">
            <span>FocusMind AI <span aria-hidden="true">·</span> המרחב האישי שלך</span>
            <span>לומדים בסקרנות, צעד אחר צעד</span>
          </header>
          <div className="signature-dashboard-content">
            {error && <p className="signature-dashboard-error" role="alert">{error}</p>}

            <section className="signature-dashboard-hero" aria-labelledby="dashboard-title">
              <div>
                <small>המרחב האישי שלך</small>
                <h1 id="dashboard-title">ברוך שובך, {displayName}</h1>
                <p>מקום שקט להתמקד, ללמוד ולהתקדם בקצב שלך.</p>
                <a className="signature-primary-button" href="/learning">
                  להמשיך ללמידה <span aria-hidden="true">←</span>
                </a>
              </div>
              <div className="signature-dashboard-art">
                <FocusIllustration type="dashboard" />
                <span>כל צעד מתחיל בסקרנות</span>
              </div>
            </section>

            <section className="signature-dashboard-stats" aria-label="נתוני למידה">
              <article className="signature-stat-card">
                <small>התקדמות כללית</small>
                {progress ? (
                  <>
                    <strong aria-label={`התקדמות כללית ${progress.percent}%`}>{progress.percent}%</strong>
                    <span>{progress.completed} מתוך {progress.total} שיעורים הושלמו בכל הקורסים.</span>
                    <div role="progressbar" aria-label="התקדמות כללית" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                      <span style={{ width: `${progress.percent}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <strong aria-label="אין עדיין נתוני התקדמות">—</strong>
                    <span>נתוני ההתקדמות יופיעו כאן לאחר למידה.</span>
                    <div className="signature-progress-empty" aria-label="אין עדיין נתוני התקדמות" />
                  </>
                )}
              </article>
              <article className="signature-stat-card signature-stat-card--streak">
                <small>ימי למידה ברצף</small>
                {streak && (streak.current > 0 || streak.longest > 0) ? (
                  <>
                    <strong aria-label={`${streak.current} ימי למידה ברצף`}>{streak.current}</strong>
                    <span>
                      {streak.activeToday ? 'למדתם היום. ' : ''}הרצף הארוך ביותר: {streak.longest} ימים.
                      {' '}היום: {formatMinutes(insightsData.totals.activeMsToday)} למידה פעילה.
                    </span>
                  </>
                ) : (
                  <>
                    <strong aria-label="אין עדיין נתונים">—</strong>
                    <span>{insights.status === 'error' ? 'לא הצלחנו לטעון את נתוני הרצף.' : 'יוצג אחרי יום ראשון עם דקה של למידה פעילה.'}</span>
                  </>
                )}
              </article>
              <article className="signature-smart-card">
                <span aria-hidden="true">✦</span>
                <small>למידה חכמה</small>
                <h2>לומדים בדרך שלך</h2>
                <p>פתחו מרחב למידה אישי לסרטון ולזמן שלכם.</p>
                <a href="/learning">מעבר ללמידה <span aria-hidden="true">←</span></a>
              </article>
            </section>

            <section className="signature-dashboard-courses" aria-labelledby="courses-title">
              <div className="signature-section-heading">
                <div>
                  <small>מסלול הלמידה שלך</small>
                  <h2 id="courses-title">הקורסים שלי</h2>
                </div>
                <a className="course-link" href={COURSES_URL}>לכל הקורסים <span aria-hidden="true">←</span></a>
              </div>
              {courses.length > 0 ? (
                <div className="course-grid">
                  {courses.slice(0, 3).map((course) => (
                    <CourseCard key={course.id} course={course} actions={<ContinueLink course={course} />} />
                  ))}
                </div>
              ) : (
                <div className="signature-course-grid">
                  <article className="signature-course signature-course--empty">
                    <span className="signature-course-icon" aria-hidden="true">◌</span>
                    <div>
                      <small>{myCourses.status === 'loading' ? 'טוענים…' : 'עדיין אין קורסים'}</small>
                      <h3>הקורסים שלך יופיעו כאן</h3>
                      <p>
                        <a href={NEW_COURSE_URL}>יצירת קורס אישי</a> או <a href={CATALOG_URL}>הרשמה לקורס מהקטלוג</a>.
                      </p>
                    </div>
                  </article>
                </div>
              )}
            </section>

            <section className="signature-dashboard-ai dashboard-coach" aria-labelledby="dashboard-coach-title">
              <span aria-hidden="true">✧</span>
              <div>
                <small>FocusCoach · המלצות לפי הלמידה שלך</small>
                <strong id="dashboard-coach-title">מה כדאי לעשות עכשיו</strong>
                <CoachTips tips={coach.data} status={coach.status} error={coach.error} onRetry={coach.reload} limit={3} compact />
              </div>
              <div className="dashboard-coach-links">
                <a className="signature-secondary-button" href="/review">
                  {pendingReview ? `${pendingReview} קטעים לחזרה` : 'חזרה חכמה'}
                </a>
                <a className="signature-secondary-button" href="/insights">לכל התובנות</a>
                <a className="signature-secondary-button" href="/study">תוכנית לימוד</a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
