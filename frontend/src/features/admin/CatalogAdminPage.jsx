import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { LoadState } from '../courses/CourseParts.jsx';
import { courseEditUrl, courseUrl, navigateTo } from '../courses/courseRoutes.js';
import useLoader from '../courses/useLoader.js';
import useAction from '../courses/useAction.js';
import { createCatalogCourse, listAdminCatalog, setCourseStatus } from '../learning/learningApi.js';
import '../courses/Courses.css';
import '../insights/Insights.css';

function NewCatalogCourse() {
  const [values, setValues] = useState({ title: '', category: '', description: '' });
  const [state, run] = useAction();
  const [validation, setValidation] = useState('');
  const change = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (values.title.trim().length < 2) {
      setValidation('שם הקורס חייב לכלול לפחות 2 תווים.');
      return;
    }
    setValidation('');
    // One request even on a double click; the form stays filled if it fails.
    const course = await run(() => createCatalogCourse({
      title: values.title.trim(), category: values.category.trim(), description: values.description.trim(), status: 'draft',
    }));
    if (course) navigateTo(courseEditUrl(course.id));
  }

  return (
    <form className="course-form" onSubmit={submit} noValidate aria-label="קורס קטלוג חדש">
      <label><span>שם הקורס</span><input value={values.title} onChange={change('title')} maxLength={120} /></label>
      <label><span>קטגוריה</span><input value={values.category} onChange={change('category')} maxLength={60} /></label>
      <label className="course-form-wide"><span>תיאור</span><textarea value={values.description} onChange={change('description')} maxLength={2000} rows={3} /></label>
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>{state.busy ? 'יוצרים…' : 'יצירת טיוטה והוספת שיעורים'}</button>
        <small>הקורס נוצר כטיוטה, ולומדים לא יראו אותו עד שתפרסמו אותו.</small>
        {(validation || state.error) && <p className="course-inline-error" role="alert">{validation || state.error}</p>}
      </div>
    </form>
  );
}

/** Catalog management for content managers (role granted from the CLI only). */
export default function CatalogAdminPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'content_manager';
  const catalog = useLoader(() => (isManager ? listAdminCatalog() : Promise.resolve([])), [isManager]);
  const [error, setError] = useState('');

  async function toggle(course) {
    setError('');
    try {
      const updated = await setCourseStatus(course.id, course.status === 'published' ? 'draft' : 'published');
      catalog.setData(catalog.data.map((row) => (row.id === course.id ? { ...row, status: updated.status } : row)));
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <AppShell active="admin" labelledBy="admin-title">
      <header className="courses-hero">
        <div>
          <small>מנהלי תוכן</small>
          <h1 id="admin-title">ניהול קטלוג הקורסים</h1>
          <p>
            יצירה ועריכה של קורסי קטלוג, הוספת שיעורים וסרטונים (קבצים או קישורים נתמכים), ופרסום או הסתרה.
            הסרטונים צריכים להיות תוכן שמותר לכם לפרסם.
          </p>
        </div>
      </header>

      {!isManager ? (
        <div className="course-empty" role="alert">
          <strong>אין לכם הרשאה לנהל את הקטלוג</strong>
          <p>ההרשאה ניתנת רק על ידי מנהל המערכת, משורת הפקודה של השרת.</p>
        </div>
      ) : (
        <>
          <section className="course-panel" aria-labelledby="new-catalog-title">
            <h2 id="new-catalog-title">קורס קטלוג חדש</h2>
            <NewCatalogCourse />
          </section>
          {error && <p className="course-inline-error" role="alert">{error}</p>}
          <LoadState status={catalog.status} error={catalog.error} onRetry={catalog.reload} loadingText="טוענים את הקטלוג…" />
          {catalog.status === 'ready' && (
            <section className="courses-section" aria-labelledby="catalog-list-title">
              <h2 id="catalog-list-title" className="visually-hidden">קורסי הקטלוג</h2>
              {catalog.data.length === 0 ? (
                <div className="course-empty"><strong>אין עדיין קורסים בקטלוג</strong></div>
              ) : (
                <div className="insight-table-wrap">
                  <table className="insight-table">
                    <thead>
                      <tr>
                        <th scope="col">קורס</th>
                        <th scope="col">מצב</th>
                        <th scope="col">שיעורים</th>
                        <th scope="col">בלי סרטון</th>
                        <th scope="col">לומדים רשומים</th>
                        <th scope="col">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.data.map((course) => (
                        <tr key={course.id}>
                          <td><a href={courseUrl(course.id)}>{course.title}</a><small>{course.category || 'ללא קטגוריה'}</small></td>
                          <td>{course.status === 'published' ? 'מפורסם' : 'טיוטה (מוסתר)'}</td>
                          <td>{course.lessonCount}</td>
                          <td>{course.lessonsWithoutVideo ? `${course.lessonsWithoutVideo} – יוצג ״אין עדיין סרטון״` : '—'}</td>
                          <td>{course.enrollmentCount}</td>
                          <td className="admin-actions">
                            <a className="signature-secondary-button" href={courseEditUrl(course.id)}>עריכה ושיעורים</a>
                            <button type="button" className="signature-secondary-button" onClick={() => toggle(course)}>
                              {course.status === 'published' ? 'הסתרה מהקטלוג' : 'פרסום בקטלוג'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
