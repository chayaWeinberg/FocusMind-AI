import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import SignatureBrand from './SignatureBrand.jsx';

export const NAV_ITEMS = Object.freeze([
  { key: 'dashboard', href: '/dashboard', icon: '⌂', label: 'לוח הבקרה' },
  { key: 'courses', href: '/courses', icon: '▤', label: 'הקורסים שלי' },
  { key: 'catalog', href: '/courses/catalog', icon: '◫', label: 'קטלוג קורסים' },
  { key: 'learning', href: '/learning', icon: '✧', label: 'למידה חכמה' },
]);

/** Sidebar navigation shared by the dashboard and the course screens. */
export function SidebarNav({ active }) {
  return (
    <nav aria-label="ניווט ראשי">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={item.key === active ? 'is-active' : undefined}
          aria-current={item.key === active ? 'page' : undefined}
          aria-label={item.label}
        >
          <span className="signature-nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="signature-nav-label">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function SidebarUser() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = user?.displayName || 'לומד';

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
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
  );
}

/** Dashboard-style page: sidebar + top bar + content column. */
export default function AppShell({ active, children, labelledBy }) {
  return (
    <main className="signature-production" dir="rtl" lang="he">
      <div className="signature-page signature-dashboard">
        <aside className="signature-dashboard-sidebar">
          <SignatureBrand />
          <SidebarNav active={active} />
          <SidebarUser />
        </aside>
        <div className="signature-dashboard-main">
          <header className="signature-dashboard-top">
            <span>FocusMind AI <span aria-hidden="true">·</span> המרחב האישי שלך</span>
            <span>לומדים בסקרנות, צעד אחר צעד</span>
          </header>
          <div className="signature-dashboard-content courses-content" aria-labelledby={labelledBy}>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
