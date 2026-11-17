import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { deleteCourse, unenrollFromCourse } from './coursesApi.js';
import useAction from './useAction.js';

/**
 * Confirmation before leaving a catalog course. It closes only after the
 * server removed the enrollment; on failure it stays open with the error.
 */
export function UnenrollDialog({ course, onClose, onDone }) {
  const [state, run] = useAction();
  async function confirm() {
    const done = await run(async () => {
      await unenrollFromCourse(course.id);
      return true;
    });
    if (done) onDone(course);
  }
  return (
    <Modal
      title="ביטול ההרשמה לקורס"
      description={`לבטל את ההרשמה לקורס ״${course.title}״?`}
      onClose={onClose}
      busy={state.busy}
    >
      <div className="course-manage-dialog">
        <ul>
          <li>הקורס יוסר מ״הקורסים שלי״ ויישאר בקטלוג. אפשר להירשם אליו שוב בכל זמן.</li>
          <li>ההתקדמות, הקטעים לחזרה והתשובות שלכם נשמרים באופן פרטי וחוזרים כשנרשמים שוב. אפשר למחוק אותם בעמוד ״פרטיות ונתונים״.</li>
          <li>מטרת לימוד שהוגדרה לקורס הזה תוסר.</li>
        </ul>
        {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
        <div className="course-confirm">
          <button type="button" className="signature-primary-button" onClick={confirm} disabled={state.busy}>
            {state.busy ? 'מבטלים…' : 'כן, לבטל את ההרשמה'}
          </button>
          <button type="button" className="signature-secondary-button" onClick={onClose} disabled={state.busy}>
            להשאיר את ההרשמה
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Stronger confirmation before deleting one's own course: the button is
 * enabled only after ticking that the deletion is final. The server checks
 * ownership; the dialog closes only after it confirmed the deletion.
 */
export function DeleteCourseDialog({ course, onClose, onDone }) {
  const [understood, setUnderstood] = useState(false);
  const [state, run] = useAction();
  async function confirm() {
    if (!understood) return;
    const done = await run(async () => {
      await deleteCourse(course.id);
      return true;
    });
    if (done) onDone(course);
  }
  return (
    <Modal
      title="מחיקת קורס"
      description={`למחוק לצמיתות את הקורס ״${course.title}״?`}
      onClose={onClose}
      busy={state.busy}
    >
      <div className="course-manage-dialog course-manage-dialog--danger">
        <p>
          יימחקו גם {course.lessonCount ? `${course.lessonCount} השיעורים שבקורס` : 'כל השיעורים שבקורס'}, הסרטונים שהעליתם אליו,
          ההתקדמות, מפגשי הלמידה, הקטעים לחזרה ושאלות החזרה שלו. אי אפשר לבטל את המחיקה.
        </p>
        <label className="course-manage-check">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} disabled={state.busy} />
          אני מבין/ה שהקורס וכל מה שבו יימחקו לצמיתות
        </label>
        {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
        <div className="course-confirm">
          <button
            type="button"
            className="signature-primary-button course-danger-button"
            onClick={confirm}
            disabled={!understood || state.busy}
          >
            {state.busy ? 'מוחקים…' : 'מחיקה סופית של הקורס'}
          </button>
          <button type="button" className="signature-secondary-button" onClick={onClose} disabled={state.busy}>ביטול</button>
        </div>
      </div>
    </Modal>
  );
}
