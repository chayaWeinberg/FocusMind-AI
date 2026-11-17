import { useEffect, useRef, useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import Notice, { useNotice } from '../../components/Notice.jsx';
import { CourseDialog, LessonDialog } from './CourseDialogs.jsx';
import useAction from './useAction.js';
import {
  addLesson,
  deleteCourse,
  deleteLesson,
  formatDuration,
  getCourse,
  readVideoDuration,
  removeLessonVideo,
  reorderLessons,
  setLessonVideoUrl,
  updateLesson,
  uploadLessonVideo,
} from './coursesApi.js';
import { COURSES_URL, courseUrl, lessonUrl, navigateTo } from './courseRoutes.js';
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

function Feedback({ state }) {
  if (state.error) return <p className="course-inline-error" role="alert">{state.error}</p>;
  if (state.message) return <p className="course-inline-success" role="status">{state.message}</p>;
  return null;
}

// --- video of one lesson ----------------------------------------------------

function VideoEditor({ lesson, onLessonChange }) {
  const [mode, setMode] = useState(lesson.video.sourceType === 'external' ? 'url' : 'file');
  const [url, setUrl] = useState(lesson.video.sourceType === 'external' ? lesson.video.url : '');
  const [linkKind, setLinkKind] = useState(lesson.video.provider === 'page' ? 'page' : 'video');
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
      let updated = await setLessonVideoUrl(lesson.id, trimmed, undefined, linkKind);
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
            {video.provider === 'youtube' ? 'סרטון YouTube' : video.provider === 'page' ? 'עמוד וידאו חיצוני' : 'קישור ישיר'}: <bdi dir="ltr">{video.url}</bdi>
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
          <fieldset className="lesson-video-mode">
            <legend>סוג הקישור</legend>
            <label>
              <input type="radio" name={`kind-${lesson.id}`} checked={linkKind === 'video'} onChange={() => setLinkKind('video')} />
              {' '}קובץ וידאו ישיר או YouTube
            </label>
            <label>
              <input type="radio" name={`kind-${lesson.id}`} checked={linkKind === 'page'} onChange={() => setLinkKind('page')} />
              {' '}עמוד אינטרנט שמציג את הסרטון (ייפתח באתר החיצוני)
            </label>
          </fieldset>
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
            {linkKind === 'page'
              ? 'עמוד אינטרנט (https) שבו מוצג הסרטון. הלומדים יפתחו אותו באתר החיצוני. מיקום הצפייה לא נמדד, ו-ReplayAI אינו זמין.'
              : 'נתמכים: קישור ישיר לקובץ ‎.mp4/‎.webm (https), או קישור לסרטון YouTube. לעמוד אינטרנט בחרו "עמוד אינטרנט".'}
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

function LessonEditor({ lesson, index, total, onMove, onLessonChange, onLessonSaved, onDelete, busy }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duration = formatDuration(lesson.durationSeconds);

  return (
    <li className="lesson-editor">
      <div className="lesson-editor-summary">
        <span className="lesson-editor-number">{index + 1}</span>
        <div>
          <strong>{lesson.title}</strong>
          <small>
            {lesson.video.sourceType === 'none' ? 'אין סרטון' : lesson.video.sourceType === 'upload' ? (lesson.video.demo ? 'סרטון הדגמה' : 'סרטון שהועלה') : lesson.video.provider === 'page' ? 'עמוד וידאו חיצוני' : 'קישור חיצוני'}
            {duration && ` · ${duration}`}
          </small>
        </div>
        <div className="lesson-editor-tools">
          <button type="button" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label={`הזזת השיעור ${lesson.title} למעלה`}>▲</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={busy || index === total - 1} aria-label={`הזזת השיעור ${lesson.title} למטה`}>▼</button>
          <button type="button" onClick={() => setEditing(true)} aria-label={`עריכת פרטי השיעור ${lesson.title}`}>פרטים</button>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${open ? 'סגירת' : 'פתיחת'} הסרטון והכלים של השיעור ${lesson.title}`}>
            {open ? 'סגירה' : 'סרטון'}
          </button>
        </div>
      </div>
      {editing && (
        <LessonDialog
          lesson={lesson}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onLessonSaved(saved);
          }}
        />
      )}
      {open && (
        <div className="lesson-editor-body">
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

const EMPTY_LESSON = Object.freeze({ title: '', description: '', source: 'none', url: '' });

/**
 * A fresh "add lesson" form. It reports success only after the server
 * confirmed the lesson (and its upload, when a file was chosen); on failure it
 * stays open with everything the user typed. A lesson that was created but
 * whose upload failed is remembered, so trying again only retries the upload
 * and never creates a second lesson.
 */
function AddLessonForm({ courseId, onCreated, onDone, onCancel }) {
  const [values, setValues] = useState(EMPTY_LESSON);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [created, setCreated] = useState(null);
  const [state, run] = useAction();
  const uploadRef = useRef(null);
  const titleRef = useRef(null);
  const fileInputId = `add-lesson-file-${courseId}`;

  useEffect(() => {
    titleRef.current?.focus();
    return () => uploadRef.current?.abort();
  }, []);

  const set = (field) => (event) => setValues({ ...values, [field]: event.target.value });
  const locked = state.busy || Boolean(created); // details are fixed once the lesson exists
  const valid = values.title.trim().length >= 2
    && (values.source !== 'url' || values.url.trim().length > 0)
    && (values.source !== 'file' || Boolean(file));

  async function submit(event) {
    event.preventDefault();
    if (!valid || state.busy) return;
    const lesson = await run(async () => {
      let current = created;
      if (!current) {
        current = await addLesson(courseId, {
          title: values.title.trim(),
          description: values.description.trim(),
          ...(values.source === 'url' ? { externalUrl: values.url.trim() } : {}),
        });
        setCreated(current);
        onCreated(current); // already on the server: show it in the list right away
      }
      if (values.source === 'file' && current.video.sourceType !== 'upload') {
        const durationSeconds = await readVideoDuration(file);
        const request = uploadLessonVideo(current.id, file, { durationSeconds, onProgress: setProgress });
        uploadRef.current = request;
        setProgress(0);
        try {
          current = await request.promise;
        } catch (error) {
          throw new Error(`השיעור נוצר, אבל העלאת הסרטון נכשלה: ${error.message} אפשר לנסות שוב – השיעור לא ייווצר פעם נוספת.`);
        } finally {
          uploadRef.current = null;
          setProgress(null);
        }
      }
      return current;
    });
    if (lesson) onDone(lesson);
  }

  return (
    <form className="course-form lesson-add" onSubmit={submit} aria-label="הוספת שיעור" aria-busy={state.busy}>
      <h3>הוספת שיעור</h3>
      <label>
        <span>שם השיעור</span>
        <input ref={titleRef} value={values.title} onChange={set('title')} maxLength={120} required minLength={2} disabled={locked} />
      </label>
      <fieldset className="lesson-add-source course-form-wide" disabled={locked}>
        <legend>סרטון לשיעור</legend>
        <label><input type="radio" name={`add-source-${courseId}`} checked={values.source === 'none'} onChange={() => setValues({ ...values, source: 'none' })} /> בלי סרטון כרגע</label>
        <label><input type="radio" name={`add-source-${courseId}`} checked={values.source === 'url'} onChange={() => setValues({ ...values, source: 'url' })} /> קישור לסרטון</label>
        <label><input type="radio" name={`add-source-${courseId}`} checked={values.source === 'file'} onChange={() => setValues({ ...values, source: 'file' })} /> העלאת קובץ וידאו</label>
      </fieldset>
      {values.source === 'url' && (
        <label className="course-form-wide">
          <span>קישור לסרטון (קובץ וידאו ישיר, YouTube או עמוד וידאו)</span>
          <input type="url" dir="ltr" value={values.url} onChange={set('url')} placeholder="https://…" maxLength={2048} required disabled={locked} />
        </label>
      )}
      {values.source === 'file' && (
        <div className="course-form-wide lesson-add-file">
          <label htmlFor={fileInputId}>
            <span>קובץ וידאו (MP4 או WebM)</span>
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm,.m4v"
            aria-label="קובץ וידאו לשיעור החדש"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={state.busy}
          />
          {file && <small dir="auto">{file.name} · {formatBytes(file.size)}</small>}
          {progress !== null && (
            <progress max="1" value={progress} aria-label="התקדמות ההעלאה">{Math.round(progress * 100)}%</progress>
          )}
        </div>
      )}
      <label className="course-form-wide">
        <span>תיאור (לא חובה)</span>
        <textarea value={values.description} onChange={set('description')} maxLength={2000} rows={2} disabled={locked} />
      </label>
      {created && !state.busy && (
        <p className="course-note course-form-wide">השיעור ״{created.title}״ כבר נשמר. נשאר רק להעלות את הסרטון.</p>
      )}
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy || !valid}>
          {state.busy ? (progress !== null ? `מעלים… ${Math.round(progress * 100)}%` : 'שומרים…') : (created ? 'ניסיון חוזר להעלאה' : 'שמירת השיעור')}
        </button>
        <button type="button" className="signature-secondary-button" onClick={onCancel} disabled={state.busy}>
          {created ? 'סגירה (השיעור נשמר בלי סרטון)' : 'ביטול'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

// --- page -------------------------------------------------------------------

function EditCourse({ courseId }) {
  const { status, data: course, error, reload, setData } = useLoader(() => getCourse(courseId), [courseId]);
  const [listState, runList] = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [notice, showNotice, clearNotice] = useNotice();
  // null: open automatically only while the course has no lessons yet.
  const [addingLesson, setAddingLesson] = useState(null);
  const [addFormKey, setAddFormKey] = useState(0);
  const addButtonRef = useRef(null);
  // After the form closes, keyboard focus returns to "+ הוספת שיעור".
  useEffect(() => {
    if (addingLesson === false) addButtonRef.current?.focus();
  }, [addingLesson]);

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

  // The new lesson replaces an earlier copy of itself (created, then uploaded), never duplicates.
  const upsertLesson = (lesson) => setData((current) => {
    const existing = current?.lessons || [];
    const next = existing.some((entry) => entry.id === lesson.id)
      ? existing.map((entry) => (entry.id === lesson.id ? { ...entry, ...lesson } : entry))
      : [...existing, lesson];
    return { ...current, lessons: next, lessonCount: next.length };
  });

  const addFormOpen = addingLesson ?? lessons.length === 0;

  function openAddLesson() {
    setAddFormKey((key) => key + 1); // a fresh, empty form every time
    setAddingLesson(true);
  }

  function lessonAdded(lesson) {
    upsertLesson(lesson);
    setAddingLesson(false);
    showNotice(lesson.video.sourceType === 'none'
      ? `השיעור ״${lesson.title}״ נוסף. אפשר להוסיף לו סרטון בכפתור "סרטון".`
      : `השיעור ״${lesson.title}״ נוסף עם הסרטון.`);
  }

  function courseSaved(updated) {
    setEditingCourse(false);
    setData(updated);
    showNotice('פרטי הקורס נשמרו.');
  }

  function lessonSaved(updated) {
    replaceLesson(updated);
    showNotice(`השיעור ״${updated.title}״ נשמר.`);
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
              <small>{course.type === 'catalog' ? 'עריכת קורס בקטלוג' : 'עריכת קורס אישי'}</small>
              <h1 id="editor-title">{course.title}</h1>
              <p>{lessons.length} שיעורים</p>
            </div>
            <div className="courses-hero-actions">
              <a className="signature-secondary-button" href={courseUrl(courseId)}>תצוגת הקורס</a>
            </div>
          </header>

          <Notice notice={notice} onClose={clearNotice} />
          <section className="course-panel" aria-labelledby="course-details-title">
            <h2 id="course-details-title">פרטי הקורס</h2>
            <dl className="course-details-summary">
              <div><dt>שם</dt><dd>{course.title}</dd></div>
              <div><dt>קטגוריה</dt><dd>{course.category || 'ללא קטגוריה'}</dd></div>
              <div><dt>תיאור</dt><dd>{course.description || 'אין תיאור'}</dd></div>
            </dl>
            <div className="course-form-actions">
              <button type="button" className="signature-secondary-button" onClick={() => setEditingCourse(true)}>עריכת פרטי הקורס</button>
            </div>
          </section>
          {editingCourse && <CourseDialog course={course} onClose={() => setEditingCourse(false)} onSaved={courseSaved} />}

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
                    onLessonSaved={lessonSaved}
                    onDelete={removeLesson}
                  />
                ))}
              </ol>
            )}
            {addFormOpen ? (
              <AddLessonForm
                key={addFormKey}
                courseId={courseId}
                onCreated={upsertLesson}
                onDone={lessonAdded}
                onCancel={() => setAddingLesson(false)}
              />
            ) : (
              <button type="button" className="signature-primary-button lesson-add-open" onClick={openAddLesson} ref={addButtonRef}>
                + הוספת שיעור
              </button>
            )}
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
  return <EditCourse courseId={courseId} />;
}
