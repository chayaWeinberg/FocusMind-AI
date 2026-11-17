import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import { enrollInCourse, listCatalog, listCategories } from './coursesApi.js';
import { courseUrl } from './courseRoutes.js';
import { CourseCard, DIFFICULTY_LABELS, LoadState } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import './Courses.css';

const SEARCH_DELAY_MS = 300;

// How a course's videos can be watched; also linkable as /courses/catalog?video=academy.
export const VIDEO_FILTERS = Object.freeze({
  '': { label: 'כל הקורסים', match: () => true },
  academy: { label: 'מתנגנים בתוך FocusMind (FocusMind Academy)', match: (course) => course.academy },
  external: { label: 'הרצאות באתרים חיצוניים', match: (course) => course.externalLibrary },
});

function initialVideoFilter() {
  try {
    const value = new URLSearchParams(window.location.search).get('video') || '';
    return Object.hasOwn(VIDEO_FILTERS, value) ? value : '';
  } catch {
    return '';
  }
}

function AcademySpotlight({ courses, onShowOnly }) {
  if (!courses.length) return null;
  return (
    <section className="academy-spotlight" aria-labelledby="academy-spotlight-title">
      <div>
        <small>מתנגן כאן · התקדמות · מעקב קשב · ReplayAI</small>
        <h2 id="academy-spotlight-title">FocusMind Academy – שיעורים מלאים שאפשר לצפות בהם כאן</h2>
        <p>
          {courses.reduce((sum, course) => sum + (course.lessonCount || 0), 0)} שיעורים מקוריים שמתנגנים בתוך FocusMind, גם ברשת מסוננת.
          כאן עובדת הלמידה החכמה המלאה. הרצאות הספרייה החיצונית נפתחות באתר המקור, בלי מעקב.
        </p>
      </div>
      <ul className="academy-spotlight-links">
        {courses.map((course) => (
          <li key={course.id}><a href={courseUrl(course.id)}>{course.title}</a></li>
        ))}
      </ul>
      <button type="button" className="signature-primary-button" onClick={onShowOnly}>הצגת קורסי Academy בלבד</button>
    </section>
  );
}

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
  const [difficulty, setDifficulty] = useState('');
  const [video, setVideo] = useState(initialVideoFilter);
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

  const all = catalog.data || [];
  const courses = all
    .filter((course) => !difficulty || course.difficulty === difficulty)
    .filter(VIDEO_FILTERS[video].match);
  const academyCourses = all.filter((course) => course.academy);
  const filtered = Boolean(query || category || difficulty || video);
  const lessonTotal = courses.reduce((sum, course) => sum + (course.lessonCount || 0), 0);
  return (
    <AppShell active="catalog" labelledBy="catalog-title">
      <header className="courses-hero">
        <div>
          <small>קורסים מוכנים ללמידה</small>
          <h1 id="catalog-title">קטלוג קורסים</h1>
          <p>
            קורסי FocusMind Academy מתנגנים כאן עם למידה חכמה מלאה.
            קורסי הספרייה מקשרים להרצאות של Harvard CS50 ושל Microsoft Learn באתרים שלהן.
          </p>
        </div>
      </header>

      {catalog.status === 'ready' && !filtered && (
        <AcademySpotlight courses={academyCourses} onShowOnly={() => setVideo('academy')} />
      )}

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
        <label>
          <span>רמה</span>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">כל הרמות</option>
            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>אופן הצפייה</span>
          <select value={video} onChange={(event) => setVideo(event.target.value)}>
            {Object.entries(VIDEO_FILTERS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </form>
      {catalog.status === 'ready' && courses.length > 0 && (
        <p className="catalog-summary" role="status">{courses.length} קורסים · {lessonTotal} שיעורים</p>
      )}

      <LoadState status={catalog.status} error={catalog.error} onRetry={catalog.reload} loadingText="טוענים את הקטלוג…" />
      {catalog.status === 'ready' && (
        courses.length === 0 ? (
          <div className="course-empty">
            <strong>{filtered ? 'לא נמצאו קורסים מתאימים' : 'הקטלוג עדיין ריק'}</strong>
            <p>{filtered ? 'נסו מילת חיפוש אחרת, קטגוריה אחרת, רמה אחרת או אופן צפייה אחר.' : 'קורסים יופיעו כאן כשיתפרסמו.'}</p>
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
