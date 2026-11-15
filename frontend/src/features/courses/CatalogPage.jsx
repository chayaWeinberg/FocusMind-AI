import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import { enrollInCourse, listCatalog, listCategories } from './coursesApi.js';
import { courseUrl } from './courseRoutes.js';
import { CourseCard, LoadState } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import './Courses.css';

const SEARCH_DELAY_MS = 300;

function EnrollButton({ course, onEnrolled }) {
  const [state, setState] = useState({ busy: false, error: '' });
  if (course.enrolled) {
    return <span className="course-enrolled" role="status">✓ רשומים לקורס</span>;
  }
  async function enroll() {
    setState({ busy: true, error: '' });
    try {
      await enrollInCourse(course.id);
      onEnrolled(course.id);
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  }
  return (
    <>
      <button
        type="button"
        className="signature-primary-button"
        onClick={enroll}
        disabled={state.busy}
        aria-label={`הרשמה לקורס ${course.title}`}
      >
        {state.busy ? 'נרשמים…' : 'הרשמה לקורס'}
      </button>
      {state.error && <span className="course-inline-error" role="alert">{state.error}</span>}
    </>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = useLoader(listCategories, []);
  const catalog = useLoader(() => listCatalog({ q: query, category }), [query, category]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  function markEnrolled(courseId) {
    catalog.setData((catalog.data || []).map((course) => (
      course.id === courseId ? { ...course, enrolled: true } : course
    )));
  }

  const courses = catalog.data || [];
  return (
    <AppShell active="catalog" labelledBy="catalog-title">
      <header className="courses-hero">
        <div>
          <small>קורסים מוכנים ללמידה</small>
          <h1 id="catalog-title">קטלוג קורסים</h1>
          <p>חפשו קורס, קראו את הפרטים ונרשמו. ההתקדמות שלכם נשמרת באופן אישי.</p>
        </div>
      </header>

      <form className="course-filters" role="search" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
        <label>
          <span>חיפוש</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="למשל: Python"
            maxLength={100}
          />
        </label>
        <label>
          <span>קטגוריה</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">כל הקטגוריות</option>
            {(categories.data || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </form>

      <LoadState status={catalog.status} error={catalog.error} onRetry={catalog.reload} loadingText="טוענים את הקטלוג…" />
      {catalog.status === 'ready' && (
        courses.length === 0 ? (
          <div className="course-empty">
            <strong>{query || category ? 'לא נמצאו קורסים מתאימים' : 'הקטלוג עדיין ריק'}</strong>
            <p>{query || category ? 'נסו מילת חיפוש אחרת או קטגוריה אחרת.' : 'קורסים יופיעו כאן כשיתפרסמו.'}</p>
          </div>
        ) : (
          <div className="course-grid" aria-live="polite">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                actions={(
                  <>
                    <EnrollButton course={course} onEnrolled={markEnrolled} />
                    <a className="course-link" href={courseUrl(course.id)}>פרטי הקורס</a>
                  </>
                )}
              />
            ))}
          </div>
        )
      )}
    </AppShell>
  );
}
