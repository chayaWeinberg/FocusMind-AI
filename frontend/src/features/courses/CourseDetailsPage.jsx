import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import Notice, { useNotice } from '../../components/Notice.jsx';
import { CourseDialog } from './CourseDialogs.jsx';
import { enrollInCourse, formatDuration, getCourse } from './coursesApi.js';
import { COURSES_URL, courseEditUrl, lessonUrl } from './courseRoutes.js';
import { ContinueLink, LoadState, ProgressBar, TypeBadge, completedText } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import { getCourseLearningSummary, listReplayItems } from '../learning/learningApi.js';
import { replayItemUrl } from '../replay/ReviewPage.jsx';
import { itemRange, reasonLines } from '../replay/replayLogic.js';
import './Courses.css';
import '../replay/Replay.css';

function CourseReplay({ courseId }) {
  const items = useLoader(() => listReplayItems({ courseId, status: 'pending' }), [courseId]);
  if (items.status !== 'ready') return null;
  return (
    <section className="courses-section" aria-labelledby="course-replay-title">
      <div className="signature-section-heading">
        <div>
          <small>ReplayAI</small>
          <h2 id="course-replay-title">קטעים לחזרה בקורס</h2>
        </div>
        <a className="course-link" href="/review">לכל הקטעים <span aria-hidden="true">←</span></a>
      </div>
      {items.data.length === 0 ? (
        <p className="replay-empty">אין כרגע קטעים שממתינים לחזרה בקורס הזה.</p>
      ) : (
        <ul className="course-replay-list">
          {items.data.map((item) => (
            <li key={item.id}>
              <a href={replayItemUrl(item)}>
                <strong>{item.lessonTitle}</strong> · <span dir="ltr">{itemRange(item)}</span>
              </a>
              <small>{item.kind === 'bookmark' ? (item.note || 'סימנייה שלכם') : reasonLines(item)[0]}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function lessonStatus(lesson) {
  if (lesson.video.sourceType === 'none') return { key: 'no-video', text: 'אין עדיין סרטון' };
  if (lesson.progress?.completed) return { key: 'completed', text: 'הושלם' };
  if (lesson.progress && lesson.progress.positionSeconds > 0) return { key: 'in-progress', text: 'בתהליך' };
  return { key: 'not-started', text: 'טרם התחיל' };
}

function LessonBadges({ summary }) {
  if (!summary) return null;
  const badges = [];
  if (summary.pendingReplay) badges.push(`${summary.pendingReplay} קטעים לחזרה`);
  if (summary.bookmarks) badges.push(`${summary.bookmarks} סימניות`);
  if (summary.questionCount) {
    badges.push(summary.lastQuizPercent === null
      ? `${summary.questionCount} שאלות חזרה`
      : `שאלות חזרה: ${summary.lastQuizPercent}% בניסיון האחרון`);
  }
  if (!badges.length) return null;
  return <span className="lesson-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}</span>;
}

const STATUS_ICONS = { completed: '✓', 'in-progress': '◔', 'not-started': '○', 'no-video': '–' };

function videoLabel(video) {
  if (video.sourceType === 'upload') return 'סרטון שהועלה';
  if (video.sourceType === 'external') {
    if (video.provider === 'youtube') return 'YouTube';
    if (video.provider === 'page') return 'סרטון באתר חיצוני';
    return 'קישור לסרטון';
  }
  return null;
}

export default function CourseDetailsPage({ courseId }) {
  const { status, data: course, error, reload, setData } = useLoader(() => getCourse(courseId), [courseId]);
  const [enrollState, setEnrollState] = useState({ busy: false, error: '' });
  const [editing, setEditing] = useState(false);
  const [notice, showNotice, clearNotice] = useNotice();
  const summary = useLoader(() => getCourseLearningSummary(courseId).catch(() => null), [courseId]);
  const lessonSummary = new Map((summary.data?.lessons || []).map((entry) => [entry.lessonId, entry]));

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
      <Notice notice={notice} onClose={clearNotice} />
      {editing && course && (
        <CourseDialog
          course={course}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            setData(updated);
            showNotice('פרטי הקורס נשמרו.');
          }}
        />
      )}
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
                <>
                  <button type="button" className="signature-secondary-button" onClick={() => setEditing(true)}>עריכת פרטי הקורס</button>
                  <a className="signature-secondary-button" href={courseEditUrl(course.id)}>עריכת הקורס והשיעורים</a>
                </>
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
                        <LessonBadges summary={lessonSummary.get(lesson.id)} />
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
          {course.canLearn && <CourseReplay courseId={course.id} />}
        </>
      )}
    </AppShell>
  );
}
