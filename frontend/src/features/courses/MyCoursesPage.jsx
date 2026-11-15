import AppShell from '../../components/AppShell.jsx';
import { listMyCourses } from './coursesApi.js';
import { CATALOG_URL, NEW_COURSE_URL, courseUrl } from './courseRoutes.js';
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

export default function MyCoursesPage() {
  const { status, data, error, reload } = useLoader(listMyCourses, []);
  const courses = data || [];
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
          <a className="signature-primary-button" href={NEW_COURSE_URL}>יצירת קורס אישי <span aria-hidden="true">+</span></a>
          <a className="signature-secondary-button" href={CATALOG_URL}>לקטלוג הקורסים</a>
        </div>
      </header>

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
                <a className="signature-primary-button" href={NEW_COURSE_URL}>ליצירת קורס ראשון</a>
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
