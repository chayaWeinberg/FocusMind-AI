import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import CoachTips from '../coach/CoachTips.jsx';
import { LoadState, ProgressBar } from '../courses/CourseParts.jsx';
import { lessonUrl } from '../courses/courseRoutes.js';
import { listMyCourses } from '../courses/coursesApi.js';
import useLoader from '../courses/useLoader.js';
import { replayItemUrl } from '../replay/ReviewPage.jsx';
import { itemRange } from '../replay/replayLogic.js';
import {
  deleteStudyGoal,
  formatClock,
  formatDate,
  getCoachTips,
  getStudyPlan,
  saveStudyGoal,
} from '../learning/learningApi.js';
import '../courses/Courses.css';
import './Study.css';

const STEP_TEXT = {
  replay: 'חזרה על קטע מומלץ',
  bookmark: 'חזרה לסימנייה',
  continue: 'המשך השיעור',
  lesson: 'שיעור חדש',
};

function stepLink(step) {
  if (step.itemId) return replayItemUrl({ lessonId: step.lessonId, id: step.itemId });
  return lessonUrl(step.lessonId);
}

function GoalForm({ courses, goal, onSaved, onCancel }) {
  const [values, setValues] = useState({
    courseId: goal?.courseId || courses[0]?.id || '',
    sessionMinutes: goal?.sessionMinutes || 30,
    weeklyMinutes: goal?.weeklyMinutes || '',
    targetDate: goal?.targetDate || '',
  });
  const [state, setState] = useState({ busy: false, error: '' });
  const change = (field) => (event) => setValues((previous) => ({ ...previous, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    const sessionMinutes = Number.parseInt(values.sessionMinutes, 10);
    const weeklyMinutes = values.weeklyMinutes === '' ? null : Number.parseInt(values.weeklyMinutes, 10);
    if (!values.courseId) return setState({ busy: false, error: 'בחרו קורס.' });
    if (!Number.isFinite(sessionMinutes) || sessionMinutes < 10 || sessionMinutes > 240) {
      return setState({ busy: false, error: 'זמן פנוי למפגש: בין 10 ל-240 דקות.' });
    }
    if (weeklyMinutes !== null && (!Number.isFinite(weeklyMinutes) || weeklyMinutes < 10 || weeklyMinutes > 2400)) {
      return setState({ busy: false, error: 'מטרה שבועית: בין 10 ל-2400 דקות, או להשאיר ריק.' });
    }
    setState({ busy: true, error: '' });
    try {
      await saveStudyGoal({ courseId: values.courseId, sessionMinutes, weeklyMinutes, targetDate: values.targetDate || null });
      setState({ busy: false, error: '' });
      onSaved();
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
    return undefined;
  }

  return (
    <form className="course-form study-form" onSubmit={submit} noValidate aria-label="מטרת לימוד">
      <label>
        <span>קורס להתמקד בו</span>
        <select value={values.courseId} onChange={change('courseId')}>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <label>
        <span>כמה זמן פנוי יש לכם למפגש (דקות)</span>
        <input type="number" min={10} max={240} value={values.sessionMinutes} onChange={change('sessionMinutes')} />
      </label>
      <label>
        <span>מטרה שבועית בדקות (לא חובה)</span>
        <input type="number" min={10} max={2400} value={values.weeklyMinutes} onChange={change('weeklyMinutes')} placeholder="למשל 120" />
      </label>
      <label>
        <span>תאריך יעד לסיום הקורס (לא חובה)</span>
        <input type="date" value={values.targetDate} onChange={change('targetDate')} />
      </label>
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>{state.busy ? 'שומרים…' : 'שמירת המטרה'}</button>
        {onCancel && <button type="button" className="signature-secondary-button" onClick={onCancel}>ביטול</button>}
        {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}

function Plan({ plan }) {
  const { goal, progress, suggestedSession: session } = plan;
  const weeklyPercent = progress.weeklyTargetMinutes
    ? Math.min(100, Math.round((100 * progress.weeklyDoneMinutes) / progress.weeklyTargetMinutes))
    : null;
  return (
    <>
      <section className="course-panel" aria-labelledby="goal-progress-title">
        <h2 id="goal-progress-title">ההתקדמות לעבר המטרה</h2>
        <p className="course-card-meta">{progress.completedLessons} מתוך {progress.totalLessons} שיעורים הושלמו בקורס ״{goal.courseTitle}״.</p>
        <ProgressBar percent={progress.percent} label="התקדמות בקורס המטרה" />
        {weeklyPercent !== null && (
          <>
            <p className="course-card-meta">השבוע: {progress.weeklyDoneMinutes} מתוך {progress.weeklyTargetMinutes} דקות למידה פעילה בקורס.</p>
            <ProgressBar percent={weeklyPercent} label="התקדמות במטרה השבועית" />
          </>
        )}
        {progress.targetDate && (
          <p className="course-card-meta">
            תאריך יעד: {formatDate(progress.targetDate, { day: 'numeric', month: 'long', year: 'numeric' })}
            {progress.daysLeft >= 0 ? ` (בעוד ${progress.daysLeft} ימים)` : ' (התאריך עבר)'}
            {progress.lessonsPerWeekNeeded !== null && ` · כדי לעמוד ביעד: כ-${progress.lessonsPerWeekNeeded} שיעורים בשבוע.`}
          </p>
        )}
      </section>

      <section className="course-panel" aria-labelledby="next-session-title">
        <h2 id="next-session-title">המפגש הבא המוצע ({goal.sessionMinutes} דקות)</h2>
        {!session ? (
          <p className="coach-empty">אין מה לתכנן: כל השיעורים עם סרטון הושלמו ואין קטעים שממתינים לחזרה.</p>
        ) : (
          <>
            <ol className="study-steps">
              {session.steps.map((step) => (
                <li key={`${step.type}-${step.itemId || step.lessonId}`}>
                  <span className={`study-step-type study-step-type--${step.type}`}>{STEP_TEXT[step.type]}</span>
                  <strong>{step.lessonTitle}</strong>
                  <small>
                    {step.seconds === null ? 'משך לא ידוע' : `כ-${formatClock(step.seconds)}`}
                    {step.startSeconds ? ` · מ-${formatClock(step.startSeconds)}` : ''}
                  </small>
                  <a className="course-link" href={stepLink(step)}>להתחיל <span aria-hidden="true">←</span></a>
                </li>
              ))}
            </ol>
            <p className="insight-note">
              מתוכנן: כ-{formatClock(session.plannedSeconds)} מתוך {formatClock(session.budgetSeconds)}.
              {session.hasUnknownDurations && ' לשיעור אחד לא ידוע המשך, ולכן התוכנית נעצרת אחריו.'}
              {session.exceedsBudget && ' השיעור הבא ארוך מהזמן הפנוי, ואפשר לעצור באמצע. ההתקדמות נשמרת.'}
              {' '}קודם חוזרים על קטעים שממתינים, אחר כך ממשיכים מהמקום שעצרתם, ואחר כך מתחילים שיעורים חדשים לפי הסדר.
            </p>
          </>
        )}
      </section>

      <section className="course-panel" aria-labelledby="unfinished-title">
        <h2 id="unfinished-title">שיעורים שעוד לא הושלמו</h2>
        {plan.unfinishedLessons.length === 0 ? (
          <p className="coach-empty">כל השיעורים בקורס הושלמו. כל הכבוד!</p>
        ) : (
          <ol className="study-lessons">
            {plan.unfinishedLessons.map((lesson) => (
              <li key={lesson.lessonId}>
                {lesson.hasVideo ? <a href={lessonUrl(lesson.lessonId)}>{lesson.title}</a> : <span>{lesson.title}</span>}
                <small>
                  {!lesson.hasVideo
                    ? 'אין עדיין סרטון'
                    : lesson.remainingSeconds !== null
                      ? `נשארו כ-${formatClock(lesson.remainingSeconds)}`
                      : lesson.trackable ? 'משך לא ידוע' : 'YouTube: משך ומיקום לא נמדדים'}
                  {lesson.pendingReplay > 0 && ` · ${lesson.pendingReplay} קטעים לחזרה`}
                </small>
              </li>
            ))}
          </ol>
        )}
        {plan.pendingReplay.length > 0 && (
          <>
            <h3 className="study-subtitle">קטעים שממתינים לחזרה בקורס</h3>
            <ul className="study-lessons">
              {plan.pendingReplay.map((item) => (
                <li key={item.id}>
                  <a href={replayItemUrl(item)}>{item.lessonTitle}</a>
                  <small dir="ltr">{itemRange(item)}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/** AdaptiveStudy: one goal, a realistic next session and FocusCoach tips. */
export default function StudyPage() {
  const plan = useLoader(getStudyPlan, []);
  const courses = useLoader(listMyCourses, []);
  const coach = useLoader(getCoachTips, []);
  const [editing, setEditing] = useState(false);
  const [removeState, setRemoveState] = useState({ busy: false, error: '' });
  const goal = plan.data?.goal;
  const learnable = (courses.data || []).filter((course) => course.lessonCount > 0);

  async function removeGoal() {
    setRemoveState({ busy: true, error: '' });
    try {
      await deleteStudyGoal();
      setRemoveState({ busy: false, error: '' });
      await plan.reload();
      await coach.reload({ quiet: true });
    } catch (error) {
      setRemoveState({ busy: false, error: error.message });
    }
  }

  return (
    <AppShell active="study" labelledBy="study-title">
      <header className="courses-hero">
        <div>
          <small>AdaptiveStudy · FocusCoach</small>
          <h1 id="study-title">תוכנית לימוד</h1>
          <p>מגדירים קורס וזמן פנוי, ומקבלים הצעה למפגש הבא לפי השיעורים שנשארו, משך השיעורים, הקטעים שממתינים לחזרה וההתקדמות שלכם.</p>
        </div>
      </header>

      <section className="course-panel" aria-labelledby="coach-title">
        <h2 id="coach-title">FocusCoach – המלצות אישיות</h2>
        <p className="insight-note">ההמלצות מחושבות לפי כללים קבועים ושקופים מתוך הנתונים השמורים שלכם. ליד כל המלצה מוסבר למה היא מוצגת.</p>
        <CoachTips tips={coach.data} status={coach.status} error={coach.error} onRetry={coach.reload} />
      </section>

      <LoadState status={plan.status} error={plan.error} onRetry={plan.reload} loadingText="מכינים את תוכנית הלימוד…" />
      {plan.status === 'ready' && (
        <>
          <section className="course-panel" aria-labelledby="goal-title">
            <h2 id="goal-title">מטרת הלימוד</h2>
            {courses.status === 'ready' && learnable.length === 0 && !goal && (
              <div className="course-empty">
                <strong>כדי להגדיר מטרה צריך קורס עם שיעורים</strong>
                <a className="signature-primary-button" href="/courses">לקורסים שלי</a>
              </div>
            )}
            {goal && !editing && (
              <div className="study-goal">
                <p>
                  קורס: <b>{goal.courseTitle}</b> · זמן למפגש: <b>{goal.sessionMinutes} דקות</b>
                  {goal.weeklyMinutes ? <> · מטרה שבועית: <b>{goal.weeklyMinutes} דקות</b></> : null}
                  {goal.targetDate ? <> · יעד: <b>{formatDate(goal.targetDate, { day: 'numeric', month: 'long', year: 'numeric' })}</b></> : null}
                </p>
                <div className="course-form-actions">
                  <button type="button" className="signature-secondary-button" onClick={() => setEditing(true)}>עריכת המטרה</button>
                  <ConfirmButton label="מחיקת המטרה" confirmLabel="כן, למחוק" question="למחוק את מטרת הלימוד?" onConfirm={removeGoal} busy={removeState.busy} />
                </div>
                {removeState.error && <p className="course-inline-error" role="alert">{removeState.error}</p>}
              </div>
            )}
            {(editing || !goal) && learnable.length > 0 && (
              <GoalForm
                courses={learnable}
                goal={goal}
                onCancel={goal ? () => setEditing(false) : null}
                onSaved={async () => {
                  setEditing(false);
                  await plan.reload();
                  await coach.reload({ quiet: true });
                }}
              />
            )}
          </section>
          {goal && plan.data.progress && <Plan plan={plan.data} />}
        </>
      )}
    </AppShell>
  );
}
