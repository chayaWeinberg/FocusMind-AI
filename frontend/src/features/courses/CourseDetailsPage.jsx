import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import { enrollInCourse, formatDuration, getCourse } from './coursesApi.js';
import { COURSES_URL, courseEditUrl, lessonUrl } from './courseRoutes.js';
import { ContinueLink, LoadState, ProgressBar, TypeBadge, completedText } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import './Courses.css';

export function lessonStatus(lesson) {
  if (lesson.video.sourceType === 'none') return { key: 'no-video', text: 'אין עדיין סרטון' };
  if (lesson.progress?.completed) return { key: 'completed', text: 'הושלם' };
  if (lesson.progress && lesson.progress.positionSeconds > 0) return { key: 'in-progress', text: 'בתהליך' };
  return { key: 'not-started', text: 'טרם התחיל' };
}

const STATUS_ICONS = { completed: '✓', 'in-progress': '◔', 'not-started': '○', 'no-video': '–' };

function videoLabel(video) {
  if (video.sourceType === 'upload') return 'סרטון שהועלה';
  if (video.sourceType === 'external') return video.provider === 'youtube' ? 'YouTube' : 'קישור לסרטון';
  return null;
}

export default function CourseDetailsPage({ courseId }) {
  const { status, data: course, error, reload, setData } = useLoader(() => getCourse(courseId), [courseId]);
  const [enrollState, setEnrollState] = useState({ busy: false, error: '' });

  async function enroll() {
    setEnrollState({ busy: true, error: '' });
    try {
      setData(await enrollInCourse(courseId));
      setEnrollState({ busy: false, error: '' });
    } catch (enrollError) {
      setEnrollState({ busy: false, error: enrollError.message });
    }
  }

  return (
    <AppShell active={course?.type === 'catalog' && !course?.enrolled ? 'catalog' : 'courses'} labelledBy="course-title">
      <a className="course-back" href={COURSES_URL}><span aria-hidden="true">→</span> חזרה לקורסים שלי</a>
      <LoadState status={status} error={error} onRetry={reload} loadingText="טוענים את הקורס…" />
      {course && status !== 'loading' && (
        <>
          <header className="courses-hero course-detail-hero">
            <div>
              <small>{course.category || 'ללא קטגוריה'} · <TypeBadge type={course.type} /></small>
              <h1 id="course-title">{course.title}</h1>
              {course.description && <p>{course.description}</p>}
              <p className="course-card-meta">{completedText(course.progress)}</p>
              {course.lessonCount > 0 && (
                <ProgressBar percent={course.progress?.percent} label="התקדמות כוללת בקורס" />
              )}
            </div>
            <div className="courses-hero-actions">
              {course.canLearn && <ContinueLink course={course} />}
              {course.type === 'catalog' && !course.enrolled && (
                <button type="button" className="signature-primary-button" onClick={enroll} disabled={enrollState.busy}>
                  {enrollState.busy ? 'נרשמים…' : 'הרשמה לקורס'}
                </button>
              )}
              {course.type === 'catalog' && course.enrolled && (
                <span className="course-enrolled" role="status">✓ רשומים לקורס</span>
              )}
              {course.canEdit && (
                <a className="signature-secondary-button" href={courseEditUrl(course.id)}>עריכת הקורס והשיעורים</a>
              )}
              {enrollState.error && <p className="course-inline-error" role="alert">{enrollState.error}</p>}
            </div>
          </header>

          <section className="courses-section" aria-labelledby="lessons-title">
            <div className="signature-section-heading">
              <div>
                <small>{course.lessonCount} שיעורים לפי הסדר</small>
                <h2 id="lessons-title">שיעורי הקורס</h2>
              </div>
            </div>
            {course.lessons.length === 0 ? (
              <div className="course-empty">
                <strong>עדיין אין שיעורים בקורס</strong>
                {course.canEdit && <a className="signature-primary-button" href={courseEditUrl(course.id)}>הוספת שיעור ראשון</a>}
              </div>
            ) : (
              <ol className="lesson-list">
                {course.lessons.map((lesson, index) => {
                  const lessonState = lessonStatus(lesson);
                  const duration = formatDuration(lesson.durationSeconds);
                  const playable = course.canLearn && lesson.video.sourceType !== 'none';
                  return (
                    <li key={lesson.id} className={`lesson-row lesson-row--${lessonState.key}`}>
                      <span className="lesson-row-status" aria-hidden="true">{STATUS_ICONS[lessonState.key]}</span>
                      <div className="lesson-row-body">
                        <strong>
                          {index + 1}. {playable ? <a href={lessonUrl(lesson.id)}>{lesson.title}</a> : lesson.title}
                        </strong>
                        {lesson.description && <p>{lesson.description}</p>}
                        <small>
                          <span className="lesson-row-state">{lessonState.text}</span>
                          {duration && <> · {duration}</>}
                          {videoLabel(lesson.video) && <> · {videoLabel(lesson.video)}</>}
                        </small>
                      </div>
                      {playable && (
                        <a className="course-link" href={lessonUrl(lesson.id)} aria-label={`פתיחת השיעור ${lesson.title} בלמידה חכמה`}>
                          ללמידה <span aria-hidden="true">←</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {course.type === 'catalog' && course.lessons.some((lesson) => lesson.video.sourceType === 'none') && (
              <p className="course-note">חלק מהשיעורים בקורס הזה עדיין ללא סרטון. הם יהיו זמינים לצפייה כשהסרטון יתווסף.</p>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
