// API client for ReplayAI, the Smart Timer, FocusInsights, FocusCoach,
// AdaptiveStudy, QuizFlow, catalog administration and privacy controls.

import { apiRequest } from '../courses/coursesApi.js';

const id = encodeURIComponent;
// Minutes UTC is ahead of local time; the server uses it for days and weeks.
export const tzOffset = () => new Date().getTimezoneOffset();

function query(params) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ReplayAI
export const getLessonReplay = (lessonId) => apiRequest(`/api/lessons/${id(lessonId)}/replay`);
export const listReplayItems = ({ status, courseId, kind } = {}) => apiRequest(`/api/replay${query({ status, courseId, kind })}`);
export const setReplayStatus = (itemId, status) => apiRequest(`/api/replay/${id(itemId)}`, { method: 'PATCH', body: { status } });
export const addBookmark = (lessonId, bookmark) => apiRequest(`/api/lessons/${id(lessonId)}/bookmarks`, { method: 'POST', body: bookmark });
export const deleteBookmark = (itemId) => apiRequest(`/api/replay/${id(itemId)}`, { method: 'DELETE' });

// Smart Timer
export const getPreferences = () => apiRequest('/api/me/preferences');
export const savePreferences = (preferences) => apiRequest('/api/me/preferences', { method: 'PUT', body: preferences });
export const sendHeartbeat = (sessionId, activeMs, breakMs, { keepalive = false } = {}) => apiRequest(
  `/api/learning-sessions/${id(sessionId)}/heartbeat`,
  { method: 'POST', body: { activeMs, breakMs }, keepalive },
);
export const listSessions = (limit = 20) => apiRequest(`/api/learning-sessions${query({ limit })}`);
/** One session with its readings (attention segments: video time, state, concentration). */
export const getSessionDetail = (sessionId) => apiRequest(`/api/learning-sessions/${id(sessionId)}`);

// FocusInsights & FocusCoach
export const getInsights = () => apiRequest(`/api/insights${query({ tzOffsetMinutes: tzOffset() })}`);
export const getCoachTips = () => apiRequest(`/api/coach${query({ tzOffsetMinutes: tzOffset() })}`);

// AdaptiveStudy
export const getStudyPlan = () => apiRequest(`/api/study/plan${query({ tzOffsetMinutes: tzOffset() })}`);
export const saveStudyGoal = (goal) => apiRequest('/api/study/goal', { method: 'PUT', body: goal });
export const deleteStudyGoal = () => apiRequest('/api/study/goal', { method: 'DELETE' });

// QuizFlow
export const getLessonQuiz = (lessonId) => apiRequest(`/api/lessons/${id(lessonId)}/quiz`);
export const addQuestion = (lessonId, question) => apiRequest(`/api/lessons/${id(lessonId)}/quiz/questions`, { method: 'POST', body: question });
export const deleteQuestion = (questionId) => apiRequest(`/api/quiz/questions/${id(questionId)}`, { method: 'DELETE' });
export const submitQuiz = (lessonId, answers) => apiRequest(`/api/lessons/${id(lessonId)}/quiz/attempts`, { method: 'POST', body: { answers } });
export const getCourseLearningSummary = (courseId) => apiRequest(`/api/courses/${id(courseId)}/learning-summary`);

// Catalog administration (content managers)
export const listAdminCatalog = () => apiRequest('/api/admin/catalog');
export const createCatalogCourse = (course) => apiRequest('/api/admin/catalog', { method: 'POST', body: course });
export const setCourseStatus = (courseId, status) => apiRequest(`/api/courses/${id(courseId)}`, { method: 'PATCH', body: { status } });

// Privacy
export const getPrivacySummary = () => apiRequest('/api/privacy/summary');
export const deleteLearningData = ({ olderThanDays, includeBookmarks = false, includeQuizAttempts = false } = {}) => apiRequest(
  `/api/privacy/learning-data${query({ olderThanDays, includeBookmarks: includeBookmarks || undefined, includeQuizAttempts: includeQuizAttempts || undefined })}`,
  { method: 'DELETE' },
);

// --- formatting shared by the learning screens ---------------------------------

export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** "1 שעה ו-5 דק׳", "12 דק׳", "פחות מדקה" */
export function formatMinutes(ms) {
  const minutes = Math.round((ms || 0) / 60000);
  if (minutes < 1) return (ms || 0) > 0 ? 'פחות מדקה' : '0 דק׳';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} דק׳`;
  return rest ? `${hours} שע׳ ו-${rest} דק׳` : `${hours} שע׳`;
}

export function formatDate(value, options = { day: 'numeric', month: 'numeric' }) {
  if (!value) return '';
  const date = typeof value === 'string' && value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('he-IL', options);
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}
