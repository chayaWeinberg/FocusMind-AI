import { useEffect, useState } from 'react';
import AdditionalDesigns from './AdditionalDesigns.jsx';
import MoreDesigns from './MoreDesigns.jsx';
import SignatureDesign from './SignatureDesign.jsx';
import './DesignPreview.css';

const concepts = [
  { id: 'focus-flow', name: 'FOCUS FLOW 2.0', style: 'פרימיום סגול וכחול' },
  { id: 'mindspark', name: 'MINDSPARK', style: 'אנרגיה נועזת' },
  { id: 'neuro-space', name: 'NEURO SPACE', style: 'עתיד טורקיז' },
  { id: 'bloom', name: 'BLOOM', style: 'פסטל שמח' },
  { id: 'harmony', name: 'FOCUSMIND HARMONY', style: 'חם, מאוזן ומזמין' },
  { id: 'soft-tech', name: 'SOFT TECH', style: 'מדויק וטכנולוגי' },
  { id: 'sunrise-minimal', name: 'SUNRISE MINIMAL', style: 'שקט, מרווח ואלגנטי' },
  { id: 'modern-bloom', name: 'MODERN BLOOM', style: 'אורגני ויצירתי' },
  { id: 'serenity', name: 'FOCUSMIND SERENITY', style: 'טבע, שקט ומיקוד' },
  { id: 'inspire', name: 'FOCUSMIND INSPIRE', style: 'מסע של צמיחה' },
  { id: 'naturetech', name: 'FOCUSMIND NATURETECH', style: 'טבע וטכנולוגיה' },
  { id: 'flow', name: 'FOCUSMIND FLOW', style: 'למידה זורמת וקלילה' },
  { id: 'elegant', name: 'FOCUSMIND ELEGANT', style: 'מינימליזם מוקפד' },
  { id: 'bloom-14', name: 'FOCUSMIND BLOOM', style: 'אביב, יצירה והשראה' },
  { id: 'signature', name: 'FOCUSMIND SIGNATURE', style: 'טבע, חמימות ואלגנטיות' },
];

const themeStorageKey = 'focusmind-design-preview-theme';
const weeklyProgress = 72;
const weeklyActivity = [
  { label: 'א׳', value: 42 },
  { label: 'ב׳', value: 68 },
  { label: 'ג׳', value: 54 },
  { label: 'ד׳', value: 83 },
  { label: 'ה׳', value: 61 },
  { label: 'ו׳', value: 72 },
  { label: 'ש׳', value: 35 },
];

const initialTasks = [
  { id: 'plan', label: 'לתכנן את השבוע', done: true, time: '09:00' },
  { id: 'report', label: 'לעבור על הפרויקט', done: true, time: '10:30' },
  { id: 'break', label: 'הפסקה קצרה לנשימה', done: false, time: 'עכשיו' },
  { id: 'read', label: 'לקרוא 10 עמודים', done: false, time: 'בהמשך' },
];

const navigation = [
  { id: 'dashboard', label: 'לוח הבקרה', icon: '▦' },
  { id: 'tasks', label: 'המשימות שלי', icon: '✓' },
  { id: 'progress', label: 'ההתקדמות שלי', icon: '↗' },
  { id: 'settings', label: 'הגדרות', icon: '⚙' },
];

function getStoredTheme() {
  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    return concepts.some((item) => item.id === savedTheme) ? savedTheme : concepts[0].id;
  } catch {
    return concepts[0].id;
  }
}

function BrandLogo() {
  return (
    <svg viewBox="0 0 48 48" className="concept-logo-mark" aria-hidden="true">
      <path className="logo-ray logo-ray--one" d="M13 13 21 21" />
      <path className="logo-ray logo-ray--two" d="M35 13 27 21" />
      <path className="logo-ray logo-ray--three" d="m13 35 8-8" />
      <path className="logo-ray logo-ray--four" d="m35 35-8-8" />
      <circle className="logo-focus-point" cx="24" cy="24" r="4.25" />
    </svg>
  );
}

function Icon({ name }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 005 5c7 0 11-6 10-16Z" /><path d="M5 20c3-4 6-7 11-10" /></>,
    nodes: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" /><path d="m11 7-5 9m7-9 5 9m-11 2h10" /></>,
  };

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name] || paths.spark}
    </svg>
  );
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function DesignPreview() {
  const [selectedId, setSelectedId] = useState(getStoredTheme);
  const [tasks, setTasks] = useState(initialTasks);
  const [activeNavigation, setActiveNavigation] = useState('dashboard');
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [celebratedTask, setCelebratedTask] = useState(null);

  const concept = concepts.find((item) => item.id === selectedId) ?? concepts[0];
  const completedTasks = tasks.filter((task) => task.done).length;

  useEffect(() => {
    try {
      window.localStorage.setItem(themeStorageKey, selectedId);
    } catch {
      // The preview remains usable when browser storage is unavailable.
    }
  }, [selectedId]);

  useEffect(() => {
    if (!timerRunning) return undefined;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerRunning]);

  function toggleTask(taskId) {
    setTasks((currentTasks) => currentTasks.map((task) => {
      if (task.id !== taskId) return task;
      const done = !task.done;
      if (done) {
        setCelebratedTask(taskId);
        window.setTimeout(() => {
          setCelebratedTask((currentTask) => (currentTask === taskId ? null : currentTask));
        }, 700);
      }
      return { ...task, done };
    }));
  }

  function toggleTimer() {
    if (remainingSeconds === 0) setRemainingSeconds(25 * 60);
    setTimerRunning((running) => !running);
  }

  return (
    <main className="design-showcase" dir="rtl" lang="he">
      <header className="showcase-toolbar">
        <div className="showcase-heading">
          <span className="showcase-kicker">מעבדת העיצוב של FocusMind AI</span>
          <h1>חמש עשרה דרכים למצוא את הפוקוס שלך</h1>
          <p>בחרו כיוון ועברו בין עולמות עיצוב שונים.</p>
        </div>
        <nav className="concept-switcher" aria-label="בחירת כיוון עיצובי">
          {concepts.map((item, index) => (
            <button
              key={item.id}
              className={`concept-tab${selectedId === item.id ? ' concept-tab--active' : ''}`}
              type="button"
              onClick={() => setSelectedId(item.id)}
              aria-pressed={selectedId === item.id}
              data-concept={item.id}
            >
              <span className="concept-tab-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="concept-tab-copy">
                <strong>{item.name}</strong>
                <small>{item.style}</small>
              </span>
            </button>
          ))}
        </nav>
      </header>

      {concept.id === 'signature' ? (
        <SignatureDesign concept={concept} />
      ) : ['serenity', 'inspire', 'naturetech', 'flow', 'elegant', 'bloom-14'].includes(concept.id) ? (
        <MoreDesigns concept={concept} />
      ) : ['harmony', 'soft-tech', 'sunrise-minimal', 'modern-bloom'].includes(concept.id) ? (
        <AdditionalDesigns concept={concept} />
      ) : (
      <section
        className="concept-preview"
        data-concept={concept.id}
        aria-label={`תצוגה מקדימה של ${concept.name}`}
      >
        <div className="dashboard-shell">
          <header className="dashboard-header">
            <a className="dashboard-brand" href="/design-preview" aria-label="FocusMind AI">
              <BrandLogo />
              <span className="dashboard-brand-copy">
                <strong>FocusMind AI</strong>
                <small>YOUR PERSONAL FOCUS SPACE</small>
              </span>
            </a>

            <nav className="dashboard-nav" aria-label="ניווט ראשי">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`dashboard-nav-item${activeNavigation === item.id ? ' dashboard-nav-item--active' : ''}`}
                  onClick={() => setActiveNavigation(item.id)}
                  aria-current={activeNavigation === item.id ? 'page' : undefined}
                >
                  <span className="nav-glyph" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            <button className="profile-button" type="button" aria-label="הפרופיל של נועה">
              <span className="profile-avatar">נ</span>
              <span className="profile-copy"><strong>נועה ישראלי</strong><small>תוכנית אישית</small></span>
              <span className="profile-chevron" aria-hidden="true">⌄</span>
            </button>
          </header>

          <div className="dashboard-content">
            <section className="welcome-row">
              <div>
                <span className="date-chip"><span className="live-dot" /> יום שלישי, 28 באוקטובר</span>
                <h2>בוקר טוב, נועה<span className="greeting-spark"> ✦</span></h2>
                <p>היום הוא הזדמנות נהדרת להתקדם.</p>
              </div>
              <div className="slogan-card">
                <span className="slogan-mark" aria-hidden="true">“</span>
                <div>
                  <strong dir="ltr">Your Mind. Your Space. Your Way.</strong>
                  <span>המחשבות שלך. המרחב שלך. הדרך שלך.</span>
                </div>
              </div>
            </section>

            <section className="dashboard-grid" aria-label="סקירת יום">
              <article className="dashboard-card tasks-card">
                <div className="card-heading">
                  <div className="card-heading-copy">
                    <span className="card-icon card-icon--tasks"><Icon name="check" /></span>
                    <div><h3>המשימות של היום</h3><p>צעד אחד בכל פעם</p></div>
                  </div>
                  <button className="more-button" type="button" aria-label="אפשרויות משימות">···</button>
                </div>
                <div className="task-summary">
                  <span>{completedTasks} משימות הושלמו</span>
                  <strong>{Math.round((completedTasks / tasks.length) * 100)}%</strong>
                </div>
                <div
                  className="task-progress-track"
                  role="progressbar"
                  aria-label="התקדמות במשימות היום"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round((completedTasks / tasks.length) * 100)}
                >
                  <span style={{ width: `${(completedTasks / tasks.length) * 100}%` }} />
                </div>
                <ul className="task-list">
                  {tasks.map((task) => (
                    <li key={task.id}                     className={`task-row${task.done ? ' task-row--done' : ''}${celebratedTask === task.id ? ' task-row--celebrating' : ''}`}>
                      <button
                        type="button"
                        className="task-check"
                        aria-label={`${task.done ? 'סימון כלא הושלמה' : 'סימון כהושלמה'}: ${task.label}`}
                        aria-pressed={task.done}
                        onClick={() => toggleTask(task.id)}
                      >
                        {task.done && <Icon name="check" />}
                      </button>
                      <span className="task-label">{task.label}</span>
                      <span className="task-time">{task.time}</span>
                    </li>
                  ))}
                </ul>
                <button className="text-action" type="button" onClick={() => setActiveNavigation('tasks')}>
                  צפייה בכל המשימות <span aria-hidden="true">←</span>
                </button>
              </article>

              <article className="dashboard-card progress-card">
                <div className="card-heading">
                  <div className="card-heading-copy">
                    <span className="card-icon card-icon--progress"><Icon name="arrow" /></span>
                    <div><h3>ההתקדמות השבועית</h3><p>המסע שלך נראה נהדר</p></div>
                  </div>
                  <span className="trend-chip"><Icon name="arrow" /> +12%</span>
                </div>
                <div
                  className="weekly-ring"
                  style={{ '--progress': `${weeklyProgress}%` }}
                  role="progressbar"
                  aria-label="ההתקדמות השבועית"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={weeklyProgress}
                >
                  <span className="weekly-ring-score">{weeklyProgress}<small>%</small></span>
                  <span className="weekly-ring-label">מהיעד השבועי</span>
                </div>
                <div className="weekly-chart" role="img" aria-label="תרשים התקדמות שבועית">
                  {weeklyActivity.map((day) => (
                    <div className="chart-column" key={day.label}>
                      <div className="chart-bar-track">
                        <span className="chart-bar" style={{ height: `${day.value}%` }} />
                      </div>
                      <span className="chart-day">{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className="progress-footer">
                  <span className="progress-legend"><span /> דקות מיקוד</span>
                  <span>{completedTasks} מתוך {tasks.length} הושלמו</span>
                </div>
              </article>

              <article className="dashboard-card assistant-card">
                <div className="assistant-topline">
                  <span className="card-icon card-icon--assistant"><Icon name="spark" /></span>
                  <div><span className="assistant-label">העוזרת האישית שלך</span><h3>רגע של בהירות</h3></div>
                  <span className="assistant-live"><i /> מוכנה לעזור</span>
                </div>
                <p className="assistant-suggestion">התחילי במשימה החשובה ביותר שלך. 25 דקות של ריכוז יכולות לשנות את כל היום.</p>
                <button className="assistant-action" type="button" onClick={() => setActiveNavigation('tasks')}>
                  עזרי לי לבחור משימה <span aria-hidden="true">←</span>
                </button>
                <div className="assistant-orbit assistant-orbit--one" aria-hidden="true" />
                <div className="assistant-orbit assistant-orbit--two" aria-hidden="true" />
              </article>

              <article className="dashboard-card timer-card">
                <div className="timer-card-heading">
                  <div><span className="timer-eyebrow">זמן מיקוד</span><h3>הזמן שלך לעצמך</h3></div>
                  <span className="card-icon card-icon--timer"><Icon name="clock" /></span>
                </div>
                <div className={`timer-dial${timerRunning ? ' timer-dial--running' : ''}`}>
                  <div className="timer-dial-inner">
                    <span className="timer-time" aria-live="polite">{formatTime(remainingSeconds)}</span>
                    <span className="timer-caption">{timerRunning ? 'את במצב מיקוד' : 'מיקוד עמוק'}</span>
                  </div>
                </div>
                <button className="primary-cta" type="button" onClick={toggleTimer}>
                  <Icon name={timerRunning ? 'clock' : 'spark'} />
                  {timerRunning ? 'השהיית הטיימר' : 'מתחילים להתמקד'}
                </button>
                <span className="timer-note"><Icon name="leaf" /> קחי נשימה. את בדיוק במקום הנכון.</span>
              </article>
            </section>

            <footer className="dashboard-footer">
              <span><span className="footer-heart">✦</span> המחשבות שלך. המרחב שלך. הדרך שלך.</span>
              <span>המרחב שלך להתקדם, בקצב שלך</span>
            </footer>
          </div>
        </div>
      </section>
      )}
    </main>
  );
}
