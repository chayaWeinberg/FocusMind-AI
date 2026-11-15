import { courseUrl, lessonUrl } from './courseRoutes.js';

export function ProgressBar({ percent, label }) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="course-progress">
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span style={{ width: `${value}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

export function LoadState({ status, error, onRetry, loadingText = 'טוענים…' }) {
  if (status === 'loading') {
    return (
      <p className="course-state" role="status">
        <span className="route-loading-spinner" aria-hidden="true" /> {loadingText}
      </p>
    );
  }
  if (status === 'error') {
    return (
      <div className="course-state course-state--error" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" className="signature-secondary-button" onClick={() => onRetry()}>לנסות שוב</button>}
      </div>
    );
  }
  return null;
}

export function TypeBadge({ type }) {
  return (
    <span className={`course-badge course-badge--${type}`}>
      {type === 'personal' ? 'קורס אישי' : 'קורס מהקטלוג'}
    </span>
  );
}

export function completedText(progress) {
  if (!progress || !progress.totalLessons) return 'אין עדיין שיעורים';
  return `${progress.completedLessons} מתוך ${progress.totalLessons} שיעורים הושלמו`;
}

/** Card for My Courses (with progress) and the catalog (with enrollment). */
export function CourseCard({ course, actions }) {
  const { progress } = course;
  return (
    <article className="course-card" aria-labelledby={`course-${course.id}-title`}>
      <div className="course-card-head">
        <span className="signature-course-icon" aria-hidden="true">{course.type === 'personal' ? '✎' : '▤'}</span>
        <div>
          <small>{course.category || 'ללא קטגוריה'}</small>
          <h3 id={`course-${course.id}-title`}>
            <a href={courseUrl(course.id)}>{course.title}</a>
          </h3>
        </div>
        <TypeBadge type={course.type} />
      </div>
      {course.description && <p className="course-card-description">{course.description}</p>}
      <p className="course-card-meta">
        {course.lessonCount} שיעורים
        {progress && <> · {completedText(progress)}</>}
      </p>
      {progress && <ProgressBar percent={progress.percent} label={`התקדמות בקורס ${course.title}`} />}
      {actions && <div className="course-card-actions">{actions}</div>}
    </article>
  );
}

export function ContinueLink({ course, className = 'signature-primary-button' }) {
  const lessonId = course.progress?.continueLessonId;
  if (!lessonId) return null;
  const started = (course.progress?.completedLessons || 0) > 0;
  return (
    <a className={className} href={lessonUrl(lessonId)}>
      {started ? 'להמשיך ללמוד' : 'להתחיל ללמוד'} <span aria-hidden="true">←</span>
    </a>
  );
}
