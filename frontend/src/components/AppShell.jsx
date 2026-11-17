import { useState } from 'react';
import { useAuth, useOptionalAuth } from '../features/auth/AuthContext.jsx';
import SignatureBrand from './SignatureBrand.jsx';

export const NAV_ITEMS = Object.freeze([
  { key: 'dashboard', href: '/dashboard', icon: '⌂', label: 'לוח הבקרה' },
  { key: 'courses', href: '/courses', icon: '▤', label: 'הקורסים שלי' },
  { key: 'catalog', href: '/courses/catalog', icon: '◫', label: 'קטלוג קורסים' },
  { key: 'learning', href: '/learning', icon: '✧', label: 'למידה חכמה' },
  { key: 'review', href: '/review', icon: '↺', label: 'חזרה חכמה' },
  { key: 'insights', href: '/insights', icon: '▥', label: 'תובנות' },
  { key: 'study', href: '/study', icon: '◎', label: 'תוכנית לימוד' },
  { key: 'privacy', href: '/privacy', icon: '◇', label: 'פרטיות ונתונים' },
]);

// Shown only to content managers; the API enforces the permission itself.
export const ADMIN_NAV_ITEM = Object.freeze({ key: 'admin', href: '/admin/catalog', icon: '⚙', label: 'ניהול הקטלוג' });

/** Logout for pages without the sidebar (the Smart Learning player). */
export function HeaderLogoutButton() {
  const auth = useOptionalAuth();
  const [busy, setBusy] = useState(false);
  if (!auth) return null;
  const { logout } = auth;
  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="signature-learning-back signature-header-logout" onClick={handleLogout} disabled={busy}>
      {busy ? 'מתנתקים...' : 'התנתקות'}
    </button>
  );
}

/** Sidebar navigation shared by the dashboard and the course screens. */
export function SidebarNav({ active }) {
  const { user } = useAuth();
  const items = user?.role === 'content_manager' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  return (
    <nav aria-label="ניווט ראשי">
      {items.map((item) => (
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
