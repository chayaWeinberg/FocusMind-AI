import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import Notice, { useNotice } from '../../components/Notice.jsx';
import { CourseDialog } from './CourseDialogs.jsx';
import { listMyCourses } from './coursesApi.js';
import { CATALOG_URL, COURSES_URL, NEW_COURSE_URL, courseEditUrl, courseUrl, navigateTo } from './courseRoutes.js';
import { ContinueLink, CourseCard, LoadState } from './CourseParts.jsx';
import useLoader from './useLoader.js';
import './Courses.css';

function CourseSection({ title, subtitle, courses, empty }) {
  return (
    <section className="courses-section" aria-label={title}>
      <div className="signature-section-heading">
        <div>
          <small>{subtitle}</small>
          <h2>{title}</h2>
        </div>
      </div>
      {courses.length === 0 ? (
        <div className="course-empty">{empty}</div>
      ) : (
        <div className="course-grid">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              actions={(
                <>
                  <ContinueLink course={course} />
                  <a className="course-link" href={courseUrl(course.id)}>פרטי הקורס</a>
                </>
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** `startCreating`: opened as /courses/new (the creation dialog is open). */
export default function MyCoursesPage({ startCreating = false }) {
  const { status, data, error, reload } = useLoader(listMyCourses, []);
  const [creating, setCreating] = useState(startCreating);
  const [notice, showNotice, clearNotice] = useNotice();
  const courses = data || [];

  useEffect(() => {
    if (startCreating) setCreating(true);
  }, [startCreating]);

  function closeDialog() {
    setCreating(false);
    if (window.location.pathname === NEW_COURSE_URL) navigateTo(COURSES_URL, { replace: true });
  }

  async function created(course) {
    closeDialog();
    showNotice(`הקורס ״${course.title}״ נוצר.`, { href: courseEditUrl(course.id), label: 'להוספת שיעורים ←' });
    await reload({ quiet: true });
  }

  const createButton = (label, className) => (
    <button type="button" className={className} onClick={() => setCreating(true)}>{label}</button>
  );
  const personal = courses.filter((course) => course.type === 'personal');
  const catalog = courses.filter((course) => course.type === 'catalog');

  return (
    <AppShell active="courses" labelledBy="my-courses-title">
      <header className="courses-hero">
        <div>
          <small>מסלול הלמידה שלך</small>
          <h1 id="my-courses-title">הקורסים שלי</h1>
          <p>קורסים אישיים שיצרתם וקורסים מהקטלוג שנרשמתם אליהם, עם ההתקדמות שלכם בכל אחד.</p>
        </div>
        <div className="courses-hero-actions">
          {createButton(<>יצירת קורס אישי <span aria-hidden="true">+</span></>, 'signature-primary-button')}
          <a className="signature-secondary-button" href={CATALOG_URL}>לקטלוג הקורסים</a>
        </div>
      </header>

      <Notice notice={notice} onClose={clearNotice} />
      {creating && <CourseDialog onClose={closeDialog} onSaved={created} />}
      <LoadState status={status} error={error} onRetry={reload} loadingText="טוענים את הקורסים שלך…" />
      {status === 'ready' && (
        <>
          <CourseSection
            title="קורסים אישיים"
            subtitle="קורסים שיצרתם בעצמכם"
            courses={personal}
            empty={(
              <>
                <strong>עדיין לא יצרתם קורס אישי</strong>
                <p>צרו קורס, הוסיפו שיעורים עם סרטונים מהמחשב או קישורים, ולמדו עם מעקב הקשב.</p>
                {createButton('ליצירת קורס ראשון', 'signature-primary-button')}
              </>
            )}
          />
          <CourseSection
            title="קורסים מהקטלוג"
            subtitle="קורסים שנרשמתם אליהם"
            courses={catalog}
            empty={(
              <>
                <strong>עדיין לא נרשמתם לקורסים מהקטלוג</strong>
                <p>עיינו בקטלוג ובחרו קורס שמעניין אתכם.</p>
                <a className="signature-secondary-button" href={CATALOG_URL}>לקטלוג הקורסים</a>
              </>
            )}
          />
        </>
      )}
    </AppShell>
  );
}
