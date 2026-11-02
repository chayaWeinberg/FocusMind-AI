import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import './DashboardPage.css';

function FocusLogo() {
  return (
    <svg className="dashboard-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 13 21 21M35 13 27 21M13 35l8-8m14 8-8-8" />
      <circle cx="24" cy="24" r="4.25" />
    </svg>
  );
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

  return (
    <main className="initial-dashboard" dir="rtl" lang="he">
      <header className="dashboard-topbar">
        <a className="dashboard-brand" href="/" aria-label="FocusMind AI - דף הבית">
          <FocusLogo />
          <span>FocusMind<span> AI</span></span>
        </a>
        <nav className="dashboard-actions" aria-label="ניווט וחשבון">
          <a className="dashboard-learning-link" href="/learning">למידה חכמה</a>
          <button
            className="dashboard-logout"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'מתנתקים...' : 'התנתקות'}
          </button>
        </nav>
      </header>

      <section className="dashboard-welcome" aria-labelledby="dashboard-title">
        <span className="dashboard-kicker">המרחב האישי שלך</span>
        <h1 id="dashboard-title">ברוך שובך, {user?.displayName || 'חבר'} <span aria-hidden="true">✦</span></h1>
        <p>זהו לוח הבקרה הראשוני שלך. בקרוב נרחיב אותו לכלים שיעזרו לך להתקדם בקצב שלך.</p>
        {error && <p className="dashboard-error" role="alert">{error}</p>}
      </section>

      <section className="dashboard-placeholder" aria-label="המשך הדרך">
        <div className="dashboard-placeholder-icon" aria-hidden="true">✧</div>
        <div>
          <h2>הדרך שלך מתחילה כאן</h2>
          <p>המרחב הזה מוכן לצמוח יחד איתך. עוד אפשרויות יגיעו בהמשך.</p>
        </div>
        <span className="dashboard-coming-soon">בהכנה</span>
      </section>
    </main>
  );
}
