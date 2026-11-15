// URLs of the course screens (shared by App routing and the pages).
export const courseUrl = (courseId) => `/courses/${encodeURIComponent(courseId)}`;
export const courseEditUrl = (courseId) => `/courses/${encodeURIComponent(courseId)}/edit`;
export const lessonUrl = (lessonId) => `/learning/lessons/${encodeURIComponent(lessonId)}`;
export const COURSES_URL = '/courses';
export const CATALOG_URL = '/courses/catalog';
export const NEW_COURSE_URL = '/courses/new';

/** Client-side navigation (App listens to popstate and re-renders the route). */
export function navigateTo(url, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo?.(0, 0);
}
