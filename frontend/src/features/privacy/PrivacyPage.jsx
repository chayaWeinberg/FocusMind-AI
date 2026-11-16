import { useState } from 'react';
import AppShell from '../../components/AppShell.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import { LoadState } from '../courses/CourseParts.jsx';
import useLoader from '../courses/useLoader.js';
import { deleteLearningData, formatDateTime, getPrivacySummary } from '../learning/learningApi.js';
import '../courses/Courses.css';
import '../insights/Insights.css';

/** What is measured, what is stored, and deleting it. */
export default function PrivacyPage() {
  const summary = useLoader(getPrivacySummary, []);
  const [options, setOptions] = useState({ includeBookmarks: false, includeQuizAttempts: false });
  const [state, setState] = useState({ busy: false, error: '', message: '' });
  const data = summary.data;

  async function remove(olderThanDays) {
    setState({ busy: true, error: '', message: '' });
    try {
      const result = await deleteLearningData({ olderThanDays, ...options });
      setState({
        busy: false,
        error: '',
        message: `נמחקו ${result.sessions} מפגשים, ${result.segments} קטעי מדידה, ${result.suggestions} המלצות, ${result.bookmarks} סימניות ו-${result.quizAttempts} ניסיונות במבחנים.`,
      });
      await summary.reload({ quiet: true });
    } catch (error) {
      setState({ busy: false, error: error.message, message: '' });
    }
  }

  return (
    <AppShell active="privacy" labelledBy="privacy-title">
      <header className="courses-hero">
        <div>
          <small>פרטיות ונתונים</small>
          <h1 id="privacy-title">מה נמדד ומה נשמר</h1>
          <p>FocusMind מעבד את המצלמה בדפדפן בלבד. תמונות מהמצלמה ונקודות פנים לא נשמרות ולא נשלחות לשרת אף פעם.</p>
        </div>
      </header>

      <section className="course-panel privacy-explain" aria-labelledby="measured-title">
        <h2 id="measured-title">מה המשמעות של כל מצב</h2>
        <dl>
          <div><dt>מבט לכיוון המסך</dt><dd>כיוון הראש והעיניים פנה למסך. זה לא מוכיח ריכוז או הבנה: אפשר להביט במסך ולחשוב על משהו אחר.</dd></div>
          <div><dt>מבט מחוץ למסך</dt><dd>כיוון המבט פנה הרחק מהמסך. מבטים קצרים מתעלמים מהם. רק מבט ממושך או חוזר יכול להפוך להמלצת חזרה.</dd></div>
          <div><dt>פנים לא זוהו</dt><dd>המצלמה לא זיהתה פנים, למשל כשקמתם מהשולחן או כשהתאורה חלשה.</dd></div>
          <div><dt>לא ודאי</dt><dd>המדידה לא הייתה אמינה מספיק. המצב הזה לא נספר כקשב ולא כהסחת דעת.</dd></div>
          <div><dt>לא נמדד</dt><dd>המצלמה הייתה כבויה. הצפייה נשמרת כרגיל, בלי מידע על המבט.</dd></div>
        </dl>
        <h2>מה נשמר בחשבון שלכם</h2>
        <ul className="privacy-list">
          <li>מפגשי למידה: מתי התחלתם, זמן צפייה פעיל וזמן הפסקות.</li>
          <li>קטעי מדידה: מצב המבט לכל קטע של זמן בסרטון. זה המידע ש-ReplayAI משתמש בו.</li>
          <li>המלצות לחזרה, סימניות שיצרתם, תשובות לשאלות חזרה, והתקדמות בשיעורים.</li>
          <li>רק אתם רואים את הנתונים האלה. אין גישה אליהם למשתמשים אחרים או למנהלי תוכן.</li>
        </ul>
        <p className="insight-note">
          המלצות ReplayAI, FocusCoach והתוכנית מחושבות לפי כללים קבועים מהנתונים האלה. אין שימוש בשירות בינה מלאכותית חיצוני,
          ושום מידע לא נשלח החוצה.
        </p>
      </section>

      <LoadState status={summary.status} error={summary.error} onRetry={summary.reload} loadingText="טוענים את סיכום הנתונים…" />
      {data && (
        <section className="course-panel course-danger" aria-labelledby="stored-title">
          <h2 id="stored-title">הנתונים השמורים כרגע</h2>
          <ul className="privacy-counts">
            <li><b>{data.sessions}</b> מפגשי למידה</li>
            <li><b>{data.segments}</b> קטעי מדידת מבט</li>
            <li><b>{data.suggestions}</b> המלצות ReplayAI</li>
            <li><b>{data.bookmarks}</b> סימניות</li>
            <li><b>{data.quizAttempts}</b> ניסיונות בשאלות חזרה</li>
          </ul>
          {data.oldestSessionAt && <p className="insight-note">המפגש הישן ביותר: {formatDateTime(data.oldestSessionAt)}.</p>}
          {data.retentionDays > 0 && <p className="insight-note">השרת מוחק אוטומטית מפגשים וקטעי מדידה בני יותר מ-{data.retentionDays} ימים.</p>}

          <h3>מחיקת נתוני הקשב</h3>
          <p className="insight-note">
            המחיקה כוללת את המפגשים ואת קטעי מדידת המבט. המלצות ReplayAI יחושבו מחדש מהנתונים שנשארו.
            ההתקדמות בשיעורים, הקורסים והחשבון לא נמחקים.
          </p>
          <label className="smart-timer-check">
            <input type="checkbox" checked={options.includeBookmarks} onChange={(event) => setOptions((previous) => ({ ...previous, includeBookmarks: event.target.checked }))} />
            <span>למחוק גם את הסימניות שיצרתי</span>
          </label>
          <label className="smart-timer-check">
            <input type="checkbox" checked={options.includeQuizAttempts} onChange={(event) => setOptions((previous) => ({ ...previous, includeQuizAttempts: event.target.checked }))} />
            <span>למחוק גם את התשובות שלי לשאלות החזרה</span>
          </label>
          <div className="course-form-actions">
            <ConfirmButton
              label="מחיקת נתונים בני יותר מ-30 יום"
              confirmLabel="כן, למחוק"
              question="למחוק נתונים בני יותר מ-30 יום? אי אפשר לבטל את המחיקה."
              busy={state.busy}
              onConfirm={() => remove(30)}
            />
            <ConfirmButton
              label="מחיקת כל נתוני הקשב"
              confirmLabel="כן, למחוק הכול"
              question="למחוק את כל נתוני הקשב? אי אפשר לבטל את המחיקה."
              busy={state.busy}
              onConfirm={() => remove(undefined)}
            />
          </div>
          {state.message && <p className="course-inline-success" role="status">{state.message}</p>}
          {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
        </section>
      )}
    </AppShell>
  );
}
