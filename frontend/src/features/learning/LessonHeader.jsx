import { useState } from 'react';
import { completeLesson, formatDuration } from '../courses/coursesApi.js';
import { courseUrl, lessonUrl } from '../courses/courseRoutes.js';

/** Title of the Smart Learning page when it plays a course lesson (inside AppShell). */
export default function LessonHeader({ context }) {
  return (
    <header className="courses-hero lesson-hero">
      <div className="lesson-heading">
        <small>
          {context ? (
            <>
              <a href={courseUrl(context.course.id)}>{context.course.title}</a>
              {' · '}שיעור {context.lessonNumber} מתוך {context.lessonTotal}
            </>
          ) : 'למידה חכמה'}
        </small>
        <h1 id="learning-title">{context?.lesson.title || 'טוענים את השיעור…'}</h1>
        {context?.lesson.description && <p>{context.lesson.description}</p>}
      </div>
      {context && (
        <div className="courses-hero-actions">
          <a className="signature-secondary-button" href={courseUrl(context.course.id)}>
            חזרה לקורס <span aria-hidden="true">←</span>
          </a>
        </div>
      )}
    </header>
  );
}

function progressText(lesson, progress) {
  if (lesson.video.sourceType === 'none') return 'אין עדיין סרטון בשיעור הזה.';
  if (progress?.completed) return 'השיעור הושלם.';
  if (!lesson.video.trackable) return 'מיקום הצפייה אינו נשמר בסרטון מסוג זה.';
  if (progress?.positionSeconds > 0) {
    const position = formatDuration(progress.positionSeconds) || '0:00';
    return `ההתקדמות נשמרה בנקודה ${position}.`;
  }
  return 'ההתקדמות תישמר אוטומטית בזמן הצפייה. השיעור יסומן כהושלם כשתצפו עד הסוף (90% ומעלה).';
}

/** Lesson progress, manual completion (embeds only) and lesson navigation. */
export function LessonStatusBar({ context, progress, onProgress, saveError }) {
  const { lesson } = context;
  const [state, setState] = useState({ busy: false, error: '' });
  const completed = Boolean(progress?.completed);
  const canMarkComplete = context.canLearn && lesson.video.sourceType === 'external' && !lesson.video.trackable && !completed;

  async function markComplete() {
    setState({ busy: true, error: '' });
    try {
      onProgress(await completeLesson(lesson.id));
      setState({ busy: false, error: '' });
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  }

  return (
    <section className="lesson-status" aria-label="התקדמות בשיעור">
      <p className={completed ? 'lesson-status-text is-complete' : 'lesson-status-text'} role="status">
        {completed && <span aria-hidden="true">✓ </span>}
        {progressText(lesson, progress)}
      </p>
      {saveError && <p className="lesson-video-error" role="alert">{saveError}</p>}
      {canMarkComplete && (
        <button type="button" className="signature-secondary-button" onClick={markComplete} disabled={state.busy}>
          {state.busy ? 'שומרים…' : 'סימון השיעור כהושלם'}
        </button>
      )}
      {state.error && <p className="lesson-video-error" role="alert">{state.error}</p>}
      <nav className="lesson-nav" aria-label="ניווט בין שיעורים">
        {context.previousLessonId && (
          <a className="signature-secondary-button" href={lessonUrl(context.previousLessonId)}>
            <span aria-hidden="true">→</span> השיעור הקודם
          </a>
        )}
        <a className="signature-secondary-button" href={courseUrl(context.course.id)}>לכל שיעורי הקורס</a>
        {context.nextLessonId && (
          <a className="signature-primary-button" href={lessonUrl(context.nextLessonId)}>
            השיעור הבא <span aria-hidden="true">←</span>
          </a>
        )}
      </nav>
    </section>
  );
}
