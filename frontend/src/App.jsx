import { useCallback, useEffect, useState } from 'react';
import RegisterPage from './features/auth/RegisterPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import SmartLearningPage from './features/learning/SmartLearningPage.jsx';
import AuthProvider, { useAuth } from './features/auth/AuthContext.jsx';

export const ROUTES = Object.freeze({
  register: '/register',
  login: '/login',
  dashboard: '/dashboard',
  learning: '/learning',
  webGazerExperiment: '/__experiments/webgazer',
  attentionEngineExperiment: '/__experiments/attention-engine',
});

const PROTECTED_PATHS = new Set([ROUTES.dashboard, ROUTES.learning]);
// Paths rendered by the SPA without a full page load when a link is clicked.
const CLIENT_PATHS = new Set(['/', ROUTES.register, ROUTES.login, ...PROTECTED_PATHS]);

function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

// Development-only experiment pages, loaded on demand (never in production).
const DEVELOPMENT_EXPERIMENTS = {
  [ROUTES.webGazerExperiment]: {
    load: () => import('./features/learning/WebGazerExperimentPage.jsx'),
    name: 'ניסוי WebGazer',
  },
  [ROUTES.attentionEngineExperiment]: {
    load: () => import('./features/attention-engine/AttentionEngineExperimentPage.jsx'),
    name: 'מנוע זיהוי המבט',
  },
};

function DevelopmentExperimentRoute({ experiment }) {
  const [ExperimentPage, setExperimentPage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    experiment.load()
      .then(({ default: page }) => {
        if (active) setExperimentPage(() => page);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || `לא ניתן לטעון את ${experiment.name}.`);
      });
    return () => { active = false; };
  }, [experiment]);

  if (error) {
    return <main className="route-loading" role="alert">טעינת {experiment.name} נכשלה: {error}</main>;
  }
  if (!ExperimentPage) {
    return <main className="route-loading" role="status">טוענים את סביבת הניסוי…</main>;
  }
  return <ExperimentPage />;
}

function Redirecting({ children }) {
  return <main className="route-loading" dir="rtl" lang="he" role="status">{children}</main>;
}

function AuthRoutes({ path, navigate }) {
  const { status } = useAuth();
  const isProtected = PROTECTED_PATHS.has(path);
  const isLogin = path === ROUTES.login;
  // "/", "/register" and any unknown path show the registration page.
  const isRegister = !isProtected && !isLogin;

  useEffect(() => {
    if (status === 'loading') return;
    if (isProtected && status === 'unauthenticated') {
      navigate(ROUTES.login, true);
    } else if ((isLogin || isRegister) && status === 'authenticated') {
      navigate(ROUTES.dashboard, true);
    }
  }, [isLogin, isProtected, isRegister, navigate, status]);

  if (status === 'loading' && (isProtected || isLogin)) {
    return (
      <Redirecting>
        <span className="route-loading-spinner" aria-hidden="true" />
        טוענים את המרחב האישי שלך...
      </Redirecting>
    );
  }

  if (isLogin) {
    return status === 'authenticated'
      ? <Redirecting>מעבירים ללוח הבקרה...</Redirecting>
      : <LoginPage onAuthenticated={() => navigate(ROUTES.dashboard, true)} />;
  }

  if (isProtected) {
    if (status !== 'authenticated') return <Redirecting>מעבירים להתחברות...</Redirecting>;
    return path === ROUTES.dashboard ? <DashboardPage /> : <SmartLearningPage />;
  }

  return status === 'authenticated'
    ? <Redirecting>מעבירים ללוח הבקרה...</Redirecting>
    : <RegisterPage />;
}

function useClientNavigation(navigate) {
  // Internal <a href> links switch screens without a full reload, so the
  // session is not re-fetched and the camera is released cleanly on unmount.
  useEffect(() => {
    function handleClick(event) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      ) {
        return;
      }
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || url.search) return;
      const nextPath = normalizePath(url.pathname);
      if (!CLIENT_PATHS.has(nextPath)) return;

      event.preventDefault();
      if (nextPath !== normalizePath(window.location.pathname)) navigate(nextPath);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const updatePath = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  const navigate = useCallback((nextPath, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextPath);
    setPath(nextPath);
    window.scrollTo?.(0, 0);
  }, []);

  useClientNavigation(navigate);

  if (import.meta.env.DEV && DEVELOPMENT_EXPERIMENTS[path]) {
    return <DevelopmentExperimentRoute experiment={DEVELOPMENT_EXPERIMENTS[path]} />;
  }

  return (
    <AuthProvider>
      <AuthRoutes path={path} navigate={navigate} />
    </AuthProvider>
  );
}
