// API client for courses, lessons, progress, uploads and learning sessions.
// Same-origin `/api/...` with the session cookie, like authApi.js.

import { API_BASE_URL } from '../auth/authApi.js';

export const COURSE_REQUEST_TIMEOUT_MS = 20000;

// Server messages (English) mapped to Hebrew; anything else falls back to a
// message per status code, so internal details are never shown.
const DETAIL_TEXTS = {
  'Only secure https links are supported.': 'אפשר להוסיף רק קישורים מאובטחים (https).',
  'The link is not a valid address.': 'הקישור אינו כתובת תקינה.',
  'Links to local or private addresses are not allowed.': 'אי אפשר לקשר לכתובת מקומית או פרטית.',
  'Links to IP addresses are not allowed; use a public domain name.': 'אי אפשר לקשר לכתובת IP. השתמשו בשם דומיין ציבורי.',
  'This YouTube link does not point to a single video.': 'קישור YouTube הזה אינו מפנה לסרטון יחיד.',
  'Unsupported link. Use a direct link to a video file (.mp4 or .webm) or a YouTube video link.':
    'הקישור אינו נתמך. השתמשו בקישור ישיר לקובץ וידאו (‎.mp4 או ‎.webm) או בקישור לסרטון YouTube.',
  'The video is larger than the allowed upload size.': 'הקובץ גדול מהגודל המרבי שמותר להעלות.',
  'Your video storage quota is full. Remove videos and try again.': 'נפח האחסון שלכם לסרטונים מלא. הסירו סרטונים ונסו שוב.',
  'Unsupported video format. Upload an MP4 or WebM file.': 'פורמט הווידאו אינו נתמך. העלו קובץ MP4 או WebM.',
  'The uploaded file is empty.': 'הקובץ שנבחר ריק.',
  'The upload was interrupted.': 'ההעלאה נקטעה. נסו שוב.',
  'Enroll in the course to learn this lesson.': 'כדי ללמוד את השיעור צריך להירשם לקורס.',
  'Catalog courses cannot be modified.': 'אי אפשר לערוך קורסים מהקטלוג.',
  'Catalog lessons cannot be modified.': 'אי אפשר לערוך שיעורים של קורסים מהקטלוג.',
  'A lesson without a video cannot be completed.': 'אי אפשר להשלים שיעור שאין בו סרטון.',
  'This lesson is completed automatically when the video is watched to the end.':
    'השיעור יסומן כהושלם אוטומטית כשתצפו בסרטון עד הסוף.',
  'The new order must list every lesson of the course exactly once.': 'הסדר החדש חייב לכלול כל שיעור פעם אחת.',
  'A lesson without a video cannot be learned yet.': 'אי אפשר ללמוד שיעור שעדיין אין בו סרטון.',
  'Bookmarks need a video whose playback position can be read.': 'בסרטון מסוג זה אי אפשר לקרוא את מיקום הצפייה, ולכן אי אפשר לסמן בו רגעים.',
  'Bookmarks are deleted, not dismissed.': 'סימניות מוחקים, לא מסתירים.',
  'Suggestions are dismissed, not deleted.': 'המלצות אפשר להסתיר, לא למחוק.',
  'Replay item not found.': 'הקטע לחזרה לא נמצא.',
  'Enroll in the course before setting a study goal for it.': 'כדי להגדיר מטרה לקורס צריך קודם להירשם אליו.',
  'Every answer must refer to a different question of this lesson.': 'כל תשובה צריכה להתייחס לשאלה אחרת של השיעור.',
  'The chosen option does not exist.': 'התשובה שנבחרה אינה קיימת.',
  'Question not found.': 'השאלה לא נמצאה.',
  'Only content managers can manage the catalog.': 'רק מנהלי תוכן יכולים לנהל את הקטלוג.',
  'Only catalog courses can be published or unpublished.': 'אפשר לפרסם או להסתיר רק קורסים מהקטלוג.',
  'Catalog courses with enrolled learners cannot be deleted. Unpublish the course instead.':
    'אי אפשר למחוק קורס קטלוג שיש בו לומדים רשומים. אפשר להסתיר אותו מהקטלוג במקום זאת.',
  'Catalog lessons with learner progress cannot be deleted.': 'אי אפשר למחוק שיעור קטלוג שיש בו התקדמות של לומדים.',
};

const STATUS_TEXTS = {
  400: 'הבקשה אינה תקינה.',
  401: 'פג תוקף ההתחברות. התחברו מחדש.',
  403: 'אין לכם הרשאה לפעולה הזו.',
  404: 'הפריט לא נמצא, או שאין לכם גישה אליו.',
  409: 'הפעולה אינה אפשרית במצב הנוכחי.',
  413: 'הקובץ גדול מדי.',
  415: 'סוג הקובץ אינו נתמך.',
  422: 'חלק מהפרטים אינם תקינים.',
  503: 'השירות אינו זמין כרגע. נסו שוב בעוד רגע.',
};

export class CourseApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CourseApiError';
    this.status = status;
  }
}

export function describeError(status, body) {
  const detail = body?.detail;
  if (typeof detail === 'string' && DETAIL_TEXTS[detail]) return DETAIL_TEXTS[detail];
  return STATUS_TEXTS[status] || 'משהו השתבש. נסו שוב.';
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest(path, { method = 'GET', body, keepalive = false } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COURSE_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      keepalive,
      signal: controller.signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CourseApiError(0, 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.');
  } finally {
    clearTimeout(timeoutId);
  }
  if (response.status === 204) return null;
  const data = await readJson(response);
  if (!response.ok) throw new CourseApiError(response.status, describeError(response.status, data));
  return data;
}

function asArray(value) {
  if (!Array.isArray(value)) throw new CourseApiError(0, 'התקבלה תשובה לא צפויה מהשרת.');
  return value;
}

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const listCatalog = async ({ q, category } = {}) => asArray(await apiRequest(`/api/courses/catalog${query({ q, category })}`));
export const listCategories = async () => asArray(await apiRequest('/api/courses/catalog/categories'));
export const listMyCourses = async () => asArray(await apiRequest('/api/courses/mine'));
export const getCourse = (courseId) => apiRequest(`/api/courses/${encodeURIComponent(courseId)}`);
export const createCourse = (data) => apiRequest('/api/courses', { method: 'POST', body: data });
export const updateCourse = (courseId, data) => apiRequest(`/api/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: data });
export const deleteCourse = (courseId) => apiRequest(`/api/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' });
export const enrollInCourse = (courseId) => apiRequest(`/api/courses/${encodeURIComponent(courseId)}/enroll`, { method: 'POST' });

export const addLesson = (courseId, data) => apiRequest(`/api/courses/${encodeURIComponent(courseId)}/lessons`, { method: 'POST', body: data });
export const reorderLessons = (courseId, lessonIds) => apiRequest(
  `/api/courses/${encodeURIComponent(courseId)}/lessons/order`,
  { method: 'PUT', body: { lessonIds } },
);
export const getLessonContext = (lessonId) => apiRequest(`/api/lessons/${encodeURIComponent(lessonId)}`);
export const updateLesson = (lessonId, data) => apiRequest(`/api/lessons/${encodeURIComponent(lessonId)}`, { method: 'PATCH', body: data });
export const deleteLesson = (lessonId) => apiRequest(`/api/lessons/${encodeURIComponent(lessonId)}`, { method: 'DELETE' });
export const setLessonVideoUrl = (lessonId, url, durationSeconds) => apiRequest(
  `/api/lessons/${encodeURIComponent(lessonId)}/video-url`,
  { method: 'PUT', body: durationSeconds ? { url, durationSeconds } : { url } },
);
export const removeLessonVideo = (lessonId) => apiRequest(`/api/lessons/${encodeURIComponent(lessonId)}/video`, { method: 'DELETE' });

export const saveLessonProgress = (lessonId, progress, { keepalive = false } = {}) => apiRequest(
  `/api/lessons/${encodeURIComponent(lessonId)}/progress`,
  { method: 'PUT', body: progress, keepalive },
);
export const completeLesson = (lessonId) => apiRequest(`/api/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST' });

export const startLearningSession = (lessonId) => apiRequest('/api/learning-sessions', { method: 'POST', body: { lessonId } });
export const sendSessionSegments = (sessionId, segments, { keepalive = false } = {}) => apiRequest(
  `/api/learning-sessions/${encodeURIComponent(sessionId)}/segments`,
  { method: 'POST', body: { segments }, keepalive },
);
export const endLearningSession = (sessionId, activeMs, { keepalive = false, breakMs = 0 } = {}) => apiRequest(
  `/api/learning-sessions/${encodeURIComponent(sessionId)}/end`,
  { method: 'POST', body: { activeMs, breakMs }, keepalive },
);

/**
 * Uploads a video file as the raw request body (streamed by the server).
 * XMLHttpRequest is used because fetch cannot report upload progress.
 * @returns {{ promise: Promise<object>, abort: () => void }}
 */
export function uploadLessonVideo(lessonId, file, { durationSeconds, onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    const params = durationSeconds ? `?durationSeconds=${encodeURIComponent(durationSeconds)}` : '';
    xhr.open('PUT', `${API_BASE_URL}/api/lessons/${encodeURIComponent(lessonId)}/video${params}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'video'));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new CourseApiError(xhr.status, describeError(xhr.status, body)));
    };
    xhr.onerror = () => reject(new CourseApiError(0, 'ההעלאה נכשלה בגלל בעיית חיבור. נסו שוב.'));
    xhr.onabort = () => reject(new CourseApiError(0, 'ההעלאה בוטלה.'));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

/** Reads a local video's duration in the browser (null when unknown). */
export function readVideoDuration(source) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const element = document.createElement('video');
    const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
    const finish = (value) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      element.removeAttribute('src');
      resolve(Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null);
    };
    const timer = setTimeout(() => finish(null), 8000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(element.duration);
    };
    element.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    element.src = objectUrl || source;
  });
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
