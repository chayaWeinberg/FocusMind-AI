import { useEffect, useRef, useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import {
  addLesson,
  createCourse,
  deleteCourse,
  deleteLesson,
  formatDuration,
  getCourse,
  readVideoDuration,
  removeLessonVideo,
  reorderLessons,
  setLessonVideoUrl,
  updateCourse,
  updateLesson,
  uploadLessonVideo,
} from './coursesApi.js';
import { COURSES_URL, courseEditUrl, courseUrl, lessonUrl, navigateTo } from './courseRoutes.js';
import { LoadState } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import './Courses.css';

const VIDEO_ACCEPT = 'video/mp4,video/webm,video/ogg,.mp4,.webm,.m4v,.ogv';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function useAction() {
  const [state, setState] = useState({ busy: false, error: '', message: '' });
  async function run(action, success = '') {
    setState({ busy: true, error: '', message: '' });
    try {
      const result = await action();
      setState({ busy: false, error: '', message: success });
      return result;
    } catch (error) {
      setState({ busy: false, error: error.message || 'משהו השתבש.', message: '' });
      return undefined;
    }
  }
  return [state, run];
}

function Feedback({ state }) {
  if (state.error) return <p className="course-inline-error" role="alert">{state.error}</p>;
  if (state.message) return <p className="course-inline-success" role="status">{state.message}</p>;
  return null;
}

// --- course details form ----------------------------------------------------

function CourseForm({ initial, submitLabel, onSubmit, state }) {
  const [values, setValues] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || '',
  });
  const [touched, setTouched] = useState(false);
  const titleError = values.title.trim().length < 2 ? 'שם הקורס חייב לכלול לפחות 2 תווים.' : '';

  function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (titleError) return;
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
    });
  }

  const change = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));
  return (
    <form className="course-form" onSubmit={submit} noValidate aria-label="פרטי הקורס">
      <div className="course-form-field">
        <label>
          <span>שם הקורס</span>
          <input
            value={values.title}
            onChange={change('title')}
            maxLength={120}
            required
            aria-invalid={touched && Boolean(titleError)}
            aria-describedby={touched && titleError ? 'course-title-error' : undefined}
          />
        </label>
        {touched && titleError && <small id="course-title-error" className="course-field-error">{titleError}</small>}
      </div>
      <label>
        <span>קטגוריה</span>
        <input value={values.category} onChange={change('category')} maxLength={60} placeholder="למשל: מתמטיקה" />
      </label>
      <label className="course-form-wide">
        <span>תיאור</span>
        <textarea value={values.description} onChange={change('description')} maxLength={2000} rows={3} />
      </label>
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>
          {state.busy ? 'שומרים…' : submitLabel}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

// --- video of one lesson ----------------------------------------------------

function VideoEditor({ lesson, onLessonChange }) {
  const [mode, setMode] = useState(lesson.video.sourceType === 'external' ? 'url' : 'file');
  const [url, setUrl] = useState(lesson.video.sourceType === 'external' ? lesson.video.url : '');
  const [upload, setUpload] = useState(null); // { progress, abort }
  const [state, run] = useAction();
  const uploadRef = useRef(null);
  const fileInputId = `lesson-${lesson.id}-file`;

  useEffect(() => () => uploadRef.current?.abort(), []);

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(async () => {
      const durationSeconds = await readVideoDuration(file);
      const request = uploadLessonVideo(lesson.id, file, {
        durationSeconds,
        onProgress: (progress) => setUpload((previous) => (previous ? { ...previous, progress } : previous)),
      });
      uploadRef.current = request;
      setUpload({ progress: 0, abort: request.abort, name: file.name });
      try {
        onLessonChange(await request.promise);
      } finally {
        uploadRef.current = null;
        setUpload(null);
      }
    }, 'הסרטון הועלה בהצלחה.');
  }

  async function saveUrl(event) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    await run(async () => {
      let updated = await setLessonVideoUrl(lesson.id, trimmed);
      if (updated.video.trackable && !updated.durationSeconds) {
        const durationSeconds = await readVideoDuration(trimmed);
        if (durationSeconds) updated = await updateLesson(lesson.id, { durationSeconds });
      }
      onLessonChange(updated);
    }, 'הקישור נשמר.');
  }

  async function removeVideo() {
    await run(async () => onLessonChange(await removeLessonVideo(lesson.id)), 'הסרטון הוסר מהשיעור.');
  }

  const { video } = lesson;
  return (
    <div className="lesson-video-editor">
      <p className="lesson-video-current">
        <strong>סרטון נוכחי: </strong>
        {video.sourceType === 'none' && 'אין עדיין סרטון.'}
        {video.sourceType === 'upload' && `${video.originalName || 'קובץ שהועלה'} (${formatBytes(video.sizeBytes)})`}
        {video.sourceType === 'external' && (
          <>
            {video.provider === 'youtube' ? 'סרטון YouTube' : 'קישור ישיר'}: <bdi dir="ltr">{video.url}</bdi>
          </>
        )}
      </p>
      {video.sourceType === 'external' && video.provider === 'youtube' && (
        <p className="course-note">בסרטוני YouTube אי אפשר לשמור את מיקום הצפייה. הלומד יסמן את השיעור כהושלם בעצמו.</p>
      )}

      <fieldset className="lesson-video-mode">
        <legend>{video.sourceType === 'none' ? 'הוספת סרטון' : 'החלפת הסרטון'}</legend>
        <label><input type="radio" name={`mode-${lesson.id}`} checked={mode === 'file'} onChange={() => setMode('file')} /> העלאת קובץ מהמחשב</label>
        <label><input type="radio" name={`mode-${lesson.id}`} checked={mode === 'url'} onChange={() => setMode('url')} /> קישור חיצוני</label>
      </fieldset>

      {mode === 'file' ? (
        <div className="lesson-video-upload">
          <label className="signature-secondary-button" htmlFor={fileInputId} aria-disabled={Boolean(upload)}>
            בחירת קובץ וידאו (MP4 או WebM)
          </label>
          <input
            id={fileInputId}
            className="visually-hidden"
            type="file"
            accept={VIDEO_ACCEPT}
            onChange={chooseFile}
            disabled={Boolean(upload)}
            aria-label={`בחירת קובץ וידאו לשיעור ${lesson.title}`}
          />
          {upload && (
            <div className="lesson-upload-progress">
              <span>מעלים את {upload.name}…</span>
              <div role="progressbar" aria-label="התקדמות ההעלאה" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(upload.progress * 100)}>
                <span style={{ width: `${Math.round(upload.progress * 100)}%` }} />
              </div>
              <b>{Math.round(upload.progress * 100)}%</b>
              <button type="button" className="course-link" onClick={upload.abort}>ביטול ההעלאה</button>
            </div>
          )}
        </div>
      ) : (
        <form className="lesson-video-url" onSubmit={saveUrl}>
          <label>
            <span>קישור לסרטון</span>
            <input
              type="url"
              dir="ltr"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/lesson.mp4"
              maxLength={2048}
              aria-describedby={`url-help-${lesson.id}`}
            />
          </label>
          <button type="submit" className="signature-secondary-button" disabled={state.busy || !url.trim()}>שמירת הקישור</button>
          <small id={`url-help-${lesson.id}`}>
            נתמכים: קישור ישיר לקובץ ‎.mp4/‎.webm (https), או קישור לסרטון YouTube. דפי אינטרנט רגילים אינם נתמכים.
          </small>
        </form>
      )}
      {video.sourceType !== 'none' && !upload && (
        <button type="button" className="course-link course-link--danger" onClick={removeVideo} disabled={state.busy}>
          הסרת הסרטון מהשיעור
        </button>
      )}
      <Feedback state={state} />
    </div>
  );
}

// --- one lesson -------------------------------------------------------------

function LessonEditor({ lesson, index, total, onMove, onLessonChange, onDelete, busy }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ title: lesson.title, description: lesson.description });
  const [state, run] = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duration = formatDuration(lesson.durationSeconds);

  async function save(event) {
    event.preventDefault();
    if (values.title.trim().length < 2) return;
    await run(async () => onLessonChange(await updateLesson(lesson.id, {
      title: values.title.trim(),
      description: values.description.trim(),
    })), 'השיעור נשמר.');
  }

  return (
    <li className="lesson-editor">
      <div className="lesson-editor-summary">
        <span className="lesson-editor-number">{index + 1}</span>
        <div>
          <strong>{lesson.title}</strong>
          <small>
            {lesson.video.sourceType === 'none' ? 'אין סרטון' : lesson.video.sourceType === 'upload' ? 'סרטון שהועלה' : 'קישור חיצוני'}
            {duration && ` · ${duration}`}
          </small>
        </div>
        <div className="lesson-editor-tools">
          <button type="button" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label={`הזזת השיעור ${lesson.title} למעלה`}>▲</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={busy || index === total - 1} aria-label={`הזזת השיעור ${lesson.title} למטה`}>▼</button>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${open ? 'סגירת' : 'עריכת'} השיעור ${lesson.title}`}>
            {open ? 'סגירה' : 'עריכה'}
          </button>
        </div>
      </div>
      {open && (
        <div className="lesson-editor-body">
          <form className="course-form" onSubmit={save} aria-label={`פרטי השיעור ${lesson.title}`}>
            <label>
              <span>שם השיעור</span>
              <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} maxLength={120} required minLength={2} />
            </label>
            <label className="course-form-wide">
              <span>תיאור השיעור</span>
              <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} maxLength={2000} rows={2} />
            </label>
            <div className="course-form-actions">
              <button type="submit" className="signature-secondary-button" disabled={state.busy}>שמירת השיעור</button>
              <Feedback state={state} />
            </div>
          </form>
          <VideoEditor lesson={lesson} onLessonChange={onLessonChange} />
          <div className="lesson-editor-footer">
            {lesson.video.sourceType !== 'none' && <a className="course-link" href={lessonUrl(lesson.id)}>פתיחה בלמידה חכמה</a>}
            {confirmDelete ? (
              <span className="course-confirm" role="group" aria-label="אישור מחיקת השיעור">
                למחוק את השיעור? ההתקדמות בו תימחק.
                <button type="button" className="course-link course-link--danger" onClick={() => onDelete(lesson.id)}>כן, למחוק</button>
                <button type="button" className="course-link" onClick={() => setConfirmDelete(false)}>ביטול</button>
              </span>
            ) : (
              <button type="button" className="course-link course-link--danger" onClick={() => setConfirmDelete(true)}>מחיקת השיעור</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function AddLessonForm({ courseId, onAdded }) {
  const [values, setValues] = useState({ title: '', description: '', url: '' });
  const [state, run] = useAction();

  async function submit(event) {
    event.preventDefault();
    if (values.title.trim().length < 2) return;
    const lesson = await run(() => addLesson(courseId, {
      title: values.title.trim(),
      description: values.description.trim(),
      ...(values.url.trim() ? { externalUrl: values.url.trim() } : {}),
    }), 'השיעור נוסף. אפשר להעלות אליו סרטון דרך "עריכה".');
    if (lesson) {
      setValues({ title: '', description: '', url: '' });
      onAdded(lesson);
    }
  }

  return (
    <form className="course-form lesson-add" onSubmit={submit} aria-label="הוספת שיעור">
      <h3>הוספת שיעור</h3>
      <label>
        <span>שם השיעור</span>
        <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} maxLength={120} required minLength={2} />
      </label>
      <label>
        <span>קישור לסרטון (לא חובה)</span>
        <input type="url" dir="ltr" value={values.url} onChange={(event) => setValues({ ...values, url: event.target.value })} placeholder="https://…" maxLength={2048} />
      </label>
      <label className="course-form-wide">
        <span>תיאור (לא חובה)</span>
        <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} maxLength={2000} rows={2} />
      </label>
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy || values.title.trim().length < 2}>
          {state.busy ? 'מוסיפים…' : 'הוספת השיעור'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

// --- page -------------------------------------------------------------------

function CreateCourse() {
  const [state, run] = useAction();
  async function create(values) {
    const course = await run(() => createCourse(values));
    if (course) navigateTo(courseEditUrl(course.id), { replace: true });
  }
  return (
    <AppShell active="courses" labelledBy="editor-title">
      <a className="course-back" href={COURSES_URL}><span aria-hidden="true">→</span> חזרה לקורסים שלי</a>
      <header className="courses-hero">
        <div>
          <small>קורס אישי חדש</small>
          <h1 id="editor-title">יצירת קורס אישי</h1>
          <p>אחרי השמירה תוכלו להוסיף שיעורים, להעלות סרטונים או להוסיף קישורים.</p>
        </div>
      </header>
      <section className="course-panel">
        <CourseForm submitLabel="יצירת הקורס" onSubmit={create} state={state} />
      </section>
    </AppShell>
  );
}

function EditCourse({ courseId }) {
  const { status, data: course, error, reload, setData } = useLoader(() => getCourse(courseId), [courseId]);
  const [formState, runForm] = useAction();
  const [listState, runList] = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (course && !course.canEdit) {
    return (
      <AppShell active="courses" labelledBy="editor-title">
        <h1 id="editor-title">עריכת קורס</h1>
        <p className="course-state course-state--error" role="alert">אי אפשר לערוך קורס זה.</p>
        <a className="course-link" href={courseUrl(courseId)}>חזרה לפרטי הקורס</a>
      </AppShell>
    );
  }

  const lessons = course?.lessons || [];
  const replaceLesson = (updated) => setData({
    ...course,
    lessons: lessons.map((lesson) => (lesson.id === updated.id ? { ...lesson, ...updated } : lesson)),
  });

  async function saveCourse(values) {
    const updated = await runForm(() => updateCourse(courseId, values), 'פרטי הקורס נשמרו.');
    if (updated) setData(updated);
  }

  async function move(index, direction) {
    const ids = lessons.map((lesson) => lesson.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const updated = await runList(() => reorderLessons(courseId, ids), 'סדר השיעורים עודכן.');
    if (updated) setData(updated);
  }

  async function removeLesson(lessonId) {
    const done = await runList(async () => {
      await deleteLesson(lessonId);
      return true;
    }, 'השיעור נמחק.');
    if (done) await reload({ quiet: true });
  }

  async function removeCourse() {
    const done = await runList(async () => {
      await deleteCourse(courseId);
      return true;
    });
    if (done) navigateTo(COURSES_URL, { replace: true });
  }

  return (
    <AppShell active="courses" labelledBy="editor-title">
      <a className="course-back" href={courseUrl(courseId)}><span aria-hidden="true">→</span> חזרה לפרטי הקורס</a>
      <LoadState status={status} error={error} onRetry={reload} loadingText="טוענים את הקורס…" />
      {course && status !== 'loading' && (
        <>
          <header className="courses-hero">
            <div>
              <small>עריכת קורס אישי</small>
              <h1 id="editor-title">{course.title}</h1>
              <p>{lessons.length} שיעורים</p>
            </div>
            <div className="courses-hero-actions">
              <a className="signature-secondary-button" href={courseUrl(courseId)}>תצוגת הקורס</a>
            </div>
          </header>

          <section className="course-panel" aria-labelledby="course-details-title">
            <h2 id="course-details-title">פרטי הקורס</h2>
            <CourseForm key={course.updatedAt} initial={course} submitLabel="שמירת השינויים" onSubmit={saveCourse} state={formState} />
          </section>

          <section className="course-panel" aria-labelledby="lessons-manage-title">
            <h2 id="lessons-manage-title">ניהול שיעורים</h2>
            <Feedback state={listState} />
            {lessons.length === 0 ? (
              <p className="course-note">עדיין אין שיעורים. הוסיפו את השיעור הראשון למטה.</p>
            ) : (
              <ol className="lesson-editor-list">
                {lessons.map((lesson, index) => (
                  <LessonEditor
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    total={lessons.length}
                    busy={listState.busy}
                    onMove={move}
                    onLessonChange={replaceLesson}
                    onDelete={removeLesson}
                  />
                ))}
              </ol>
            )}
            <AddLessonForm courseId={courseId} onAdded={(lesson) => setData({ ...course, lessons: [...lessons, lesson], lessonCount: lessons.length + 1 })} />
          </section>

          <section className="course-panel course-danger" aria-labelledby="danger-title">
            <h2 id="danger-title">מחיקת הקורס</h2>
            <p>המחיקה מסירה את כל השיעורים, הסרטונים שהועלו וההתקדמות בקורס. אי אפשר לבטל אותה.</p>
            {confirmDelete ? (
              <div className="course-confirm" role="group" aria-label="אישור מחיקת הקורס">
                <button type="button" className="signature-primary-button course-danger-button" onClick={removeCourse} disabled={listState.busy}>כן, למחוק את הקורס</button>
                <button type="button" className="signature-secondary-button" onClick={() => setConfirmDelete(false)}>ביטול</button>
              </div>
            ) : (
              <button type="button" className="signature-secondary-button course-danger-outline" onClick={() => setConfirmDelete(true)}>מחיקת הקורס</button>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default function CourseEditorPage({ courseId }) {
  return courseId ? <EditCourse courseId={courseId} /> : <CreateCourse />;
}
