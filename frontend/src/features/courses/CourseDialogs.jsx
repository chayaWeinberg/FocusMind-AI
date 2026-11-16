import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { createCourse, updateCourse, updateLesson } from './coursesApi.js';
import useAction from './useAction.js';

// Course and lesson dialogs.
//
// The dialog's content is mounted fresh each time it opens, so it always
// starts from the current server data (never stale values). It closes only
// after the server confirmed the save (`onSaved` receives the saved object);
// on failure it stays open, keeps what was typed and shows the error.

function FieldError({ id, text }) {
  return text ? <small id={id} className="course-field-error">{text}</small> : null;
}

export function CourseForm({ initial, submitLabel, busyLabel = 'שומרים…', onSubmit, onCancel, state }) {
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
    if (titleError || state.busy) return;
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
    });
  }

  const change = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));
  return (
    <form className="course-form" onSubmit={submit} noValidate aria-label="פרטי הקורס" aria-busy={state.busy || undefined}>
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
        <FieldError id="course-title-error" text={touched && titleError} />
      </div>
      <label>
        <span>קטגוריה</span>
        <input value={values.category} onChange={change('category')} maxLength={60} placeholder="למשל: מתמטיקה" />
      </label>
      <label className="course-form-wide">
        <span>תיאור</span>
        <textarea value={values.description} onChange={change('description')} maxLength={2000} rows={3} />
      </label>
      {state.error && <p className="course-inline-error course-form-wide" role="alert">{state.error}</p>}
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>
          {state.busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="signature-secondary-button" onClick={onCancel} disabled={state.busy}>ביטול</button>
        )}
      </div>
    </form>
  );
}

/** Create (no `course`) or edit a personal/catalog course's details. */
export function CourseDialog({ course = null, onClose, onSaved }) {
  const [state, run] = useAction();
  const editing = Boolean(course);

  async function save(values) {
    const saved = await run(() => (editing ? updateCourse(course.id, values) : createCourse(values)));
    if (saved) onSaved(saved);
  }

  return (
    <Modal
      title={editing ? 'עריכת פרטי הקורס' : 'יצירת קורס אישי'}
      description={editing ? null : 'אחרי השמירה תוכלו להוסיף שיעורים, להעלות סרטונים או להוסיף קישורים.'}
      onClose={onClose}
      busy={state.busy}
    >
      <CourseForm
        initial={course}
        submitLabel={editing ? 'שמירת השינויים' : 'יצירת הקורס'}
        busyLabel={editing ? 'שומרים…' : 'יוצרים…'}
        onSubmit={save}
        onCancel={onClose}
        state={state}
      />
    </Modal>
  );
}

/** Edit a lesson's title and description. */
export function LessonDialog({ lesson, onClose, onSaved }) {
  const [state, run] = useAction();
  const [values, setValues] = useState({ title: lesson.title, description: lesson.description || '' });
  const [touched, setTouched] = useState(false);
  const titleError = values.title.trim().length < 2 ? 'שם השיעור חייב לכלול לפחות 2 תווים.' : '';

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (titleError || state.busy) return;
    const saved = await run(() => updateLesson(lesson.id, {
      title: values.title.trim(),
      description: values.description.trim(),
    }));
    if (saved) onSaved(saved);
  }

  return (
    <Modal title="עריכת פרטי השיעור" onClose={onClose} busy={state.busy}>
      <form className="course-form" onSubmit={submit} noValidate aria-label="פרטי השיעור" aria-busy={state.busy || undefined}>
        <div className="course-form-field">
          <label>
            <span>שם השיעור</span>
            <input
              value={values.title}
              onChange={(event) => setValues({ ...values, title: event.target.value })}
              maxLength={120}
              aria-invalid={touched && Boolean(titleError)}
              aria-describedby={touched && titleError ? 'lesson-title-error' : undefined}
            />
          </label>
          <FieldError id="lesson-title-error" text={touched && titleError} />
        </div>
        <label className="course-form-wide">
          <span>תיאור השיעור</span>
          <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} maxLength={2000} rows={3} />
        </label>
        {state.error && <p className="course-inline-error course-form-wide" role="alert">{state.error}</p>}
        <div className="course-form-actions">
          <button type="submit" className="signature-primary-button" disabled={state.busy}>
            {state.busy ? 'שומרים…' : 'שמירת השיעור'}
          </button>
          <button type="button" className="signature-secondary-button" onClick={onClose} disabled={state.busy}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}
