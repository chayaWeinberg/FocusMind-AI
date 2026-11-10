import { useCallback, useEffect, useState } from 'react';
import RegisterPage from './features/auth/RegisterPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import SmartLearningPage from './features/learning/SmartLearningPage.jsx';
import AuthProvider, { useAuth } from './features/auth/AuthContext.jsx';

function DevelopmentWebGazerRoute() {
  const [ExperimentPage, setExperimentPage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    import('./features/learning/WebGazerExperimentPage.jsx')
      .then(({ default: page }) => {
        if (active) setExperimentPage(() => page);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || 'לא ניתן לטעון את ניסוי WebGazer.');
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return <main className="route-loading" role="alert">טעינת ניסוי WebGazer נכשלה: {error}</main>;
  }
  if (!ExperimentPage) {
    return <main className="route-loading" role="status">טוענים את סביבת הניסוי…</main>;
  }
  return <ExperimentPage />;
}

function AuthRoutes({ path, navigate }) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'loading') return;
    if ((path === '/dashboard' || path === '/learning') && status === 'unauthenticated') {
      navigate('/login', true);
    } else if (path === '/login' && status === 'authenticated') {
      navigate('/dashboard', true);
    }
  }, [navigate, path, status]);

  if (status === 'loading' && (path === '/login' || path === '/dashboard' || path === '/learning')) {
    return (
      <main className="route-loading" dir="rtl" lang="he" role="status">
        <span className="route-loading-spinner" aria-hidden="true" />
        טוענים את המרחב האישי שלך...
      </main>
    );
  }

  if (path === '/login') {
    return status === 'authenticated'
      ? <main className="route-loading" role="status">מעבירים ללוח הבקרה...</main>
      : <LoginPage onAuthenticated={() => navigate('/dashboard', true)} />;
  }

  if (path === '/dashboard') {
    return status === 'authenticated'
      ? <DashboardPage />
      : <main className="route-loading" role="status">מעבירים להתחברות...</main>;
  }

  if (path === '/learning') {
    return status === 'authenticated'
      ? <SmartLearningPage />
      : <main className="route-loading" role="status">מעבירים להתחברות...</main>;
  }

  return <RegisterPage />;
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  const navigate = useCallback((nextPath, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextPath);
    setPath(nextPath);
  }, []);

  if (import.meta.env.DEV && path === '/__experiments/webgazer') {
    return <DevelopmentWebGazerRoute />;
  }

  return (
    <AuthProvider>
      <AuthRoutes path={path} navigate={navigate} />
    </AuthProvider>
  );
}
