import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';

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

  return (
    <main className="signature-production" dir="rtl" lang="he">
      <div className="signature-page signature-dashboard">
        <aside className="signature-dashboard-sidebar">
          <SignatureBrand />
          <nav aria-label="ניווט ראשי">
            <a href="/dashboard" className="is-active" aria-current="page" aria-label="לוח הבקרה">
              <span className="signature-nav-icon" aria-hidden="true">⌂</span>
              <span className="signature-nav-label">לוח הבקרה</span>
            </a>
            <button type="button" aria-label="הקורסים שלי" disabled>
              <span className="signature-nav-icon" aria-hidden="true">▤</span>
              <span className="signature-nav-label">הקורסים שלי</span>
            </button>
            <button type="button" aria-label="ההתקדמות שלי" disabled>
              <span className="signature-nav-icon" aria-hidden="true">◔</span>
              <span className="signature-nav-label">ההתקדמות שלי</span>
            </button>
            <a href="/learning" aria-label="למידה חכמה">
              <span className="signature-nav-icon" aria-hidden="true">✧</span>
              <span className="signature-nav-label">למידה חכמה</span>
            </a>
          </nav>
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
                <strong aria-label="אין עדיין נתוני התקדמות">—</strong>
                <span>נתוני ההתקדמות יופיעו כאן לאחר למידה.</span>
                <div className="signature-progress-empty" aria-label="אין עדיין נתוני התקדמות" />
              </article>
              <article className="signature-stat-card signature-stat-card--streak">
                <small>ימי למידה ברצף</small>
                <strong aria-label="אין עדיין נתונים">—</strong>
                <span>יוצג לאחר שיצטברו מפגשי למידה.</span>
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
              </div>
              <div className="signature-course-grid">
                <article className="signature-course signature-course--empty">
                  <span className="signature-course-icon" aria-hidden="true">◌</span>
                  <div>
                    <small>עדיין אין קורסים</small>
                    <h3>הקורסים שלך יופיעו כאן</h3>
                    <p>כשתתווסף למידה בקורסים, נציג כאן את ההתקדמות שלך.</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="signature-dashboard-ai" aria-label="תובנות למידה">
              <span aria-hidden="true">✧</span>
              <div>
                <small>תובנות אישיות</small>
                <strong>התובנות שלך יופיעו כאן</strong>
                <p>עדיין לא נאספו נתוני למידה להצגת המלצות.</p>
              </div>
              <button type="button" disabled>אין עדיין תובנות</button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
