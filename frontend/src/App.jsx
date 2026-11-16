import { useCallback, useEffect, useState } from 'react';
import RegisterPage from './features/auth/RegisterPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import SmartLearningPage from './features/learning/SmartLearningPage.jsx';
import MyCoursesPage from './features/courses/MyCoursesPage.jsx';
import CatalogPage from './features/courses/CatalogPage.jsx';
import CourseDetailsPage from './features/courses/CourseDetailsPage.jsx';
import CourseEditorPage from './features/courses/CourseEditorPage.jsx';
import ReviewPage from './features/replay/ReviewPage.jsx';
import InsightsPage from './features/insights/InsightsPage.jsx';
import StudyPage from './features/study/StudyPage.jsx';
import PrivacyPage from './features/privacy/PrivacyPage.jsx';
import CatalogAdminPage from './features/admin/CatalogAdminPage.jsx';
import AuthProvider, { useAuth } from './features/auth/AuthContext.jsx';

export const ROUTES = Object.freeze({
  register: '/register',
  login: '/login',
  dashboard: '/dashboard',
  learning: '/learning',
  courses: '/courses',
  catalog: '/courses/catalog',
  newCourse: '/courses/new',
});

const ID = '([^/]+)';
// Signed-in pages. Order matters: fixed paths before parameterised ones.
const PROTECTED_ROUTES = [
  { name: 'dashboard', pattern: /^\/dashboard$/ },
  { name: 'learning', pattern: /^\/learning$/ },
  { name: 'lesson', pattern: new RegExp(`^/learning/lessons/${ID}$`) },
  { name: 'lessonReplay', pattern: new RegExp(`^/learning/lessons/${ID}/review/${ID}$`) },
  { name: 'review', pattern: /^\/review$/ },
  { name: 'insights', pattern: /^\/insights$/ },
  { name: 'study', pattern: /^\/study$/ },
  { name: 'privacy', pattern: /^\/privacy$/ },
  { name: 'adminCatalog', pattern: /^\/admin\/catalog$/ },
  { name: 'courses', pattern: /^\/courses$/ },
  { name: 'catalog', pattern: /^\/courses\/catalog$/ },
  { name: 'newCourse', pattern: /^\/courses\/new$/ },
  { name: 'course', pattern: new RegExp(`^/courses/${ID}$`) },
  { name: 'editCourse', pattern: new RegExp(`^/courses/${ID}/edit$`) },
];

export function matchProtectedRoute(path) {
  for (const route of PROTECTED_ROUTES) {
    const match = route.pattern.exec(path);
    if (match) {
      let param = null;
      let second = null;
      try {
        param = match[1] ? decodeURIComponent(match[1]) : null;
        second = match[2] ? decodeURIComponent(match[2]) : null;
      } catch {
        return null;
      }
      return second === null ? { name: route.name, param } : { name: route.name, param, second };
    }
  }
  return null;
}

// Paths rendered by the SPA without a full page load when a link is clicked.
const PUBLIC_CLIENT_PATHS = new Set(['/', ROUTES.register, ROUTES.login]);
const isClientPath = (path) => PUBLIC_CLIENT_PATHS.has(path) || matchProtectedRoute(path) !== null;

function ProtectedPage({ route }) {
  switch (route.name) {
    case 'dashboard': return <DashboardPage />;
    case 'learning': return <SmartLearningPage />;
    // A new key per lesson resets the player, timer and statistics.
    case 'lesson': return <SmartLearningPage key={route.param} lessonId={route.param} />;
    // Opened from ReplayAI: the same player, seeking to the chosen interval.
    case 'lessonReplay': return <SmartLearningPage key={`${route.param}/${route.second}`} lessonId={route.param} replayItemId={route.second} />;
    case 'review': return <ReviewPage />;
    case 'insights': return <InsightsPage />;
    case 'study': return <StudyPage />;
    case 'privacy': return <PrivacyPage />;
    case 'adminCatalog': return <CatalogAdminPage />;
    // Same element for both paths: /courses/new only opens the creation dialog.
    case 'courses': return <MyCoursesPage key="my-courses" />;
    case 'newCourse': return <MyCoursesPage key="my-courses" startCreating />;
    case 'catalog': return <CatalogPage />;
    case 'course': return <CourseDetailsPage key={route.param} courseId={route.param} />;
    case 'editCourse': return <CourseEditorPage key={route.param} courseId={route.param} />;
    default: return null;
  }
}

function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}


function Redirecting({ children }) {
  return <main className="route-loading" dir="rtl" lang="he" role="status">{children}</main>;
}

function AuthRoutes({ path, navigate }) {
  const { status } = useAuth();
  const protectedRoute = matchProtectedRoute(path);
  const isProtected = protectedRoute !== null;
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
    return <ProtectedPage route={protectedRoute} />;
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
      if (!isClientPath(nextPath)) return;

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

  return (
    <AuthProvider>
      <AuthRoutes path={path} navigate={navigate} />
    </AuthProvider>
  );
}
