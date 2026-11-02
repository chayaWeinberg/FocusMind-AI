import { useState } from 'react';
import './AdditionalDesigns.css';

const navigation = [
  { id: 'dashboard', label: 'לוח הבקרה', icon: '⌂' },
  { id: 'courses', label: 'הקורסים שלי', icon: '▤' },
  { id: 'progress', label: 'ההתקדמות שלי', icon: '↗' },
  { id: 'smart-learning', label: 'למידה חכמה', icon: '✳' },
];

const courses = [
  { id: 'neuroscience', title: 'מבוא למדעי המוח', category: 'מדעי החיים', progress: 68, lesson: 'שיעור 8 מתוך 12', color: 'teal' },
  { id: 'design', title: 'חשיבה עיצובית', category: 'יצירתיות', progress: 42, lesson: 'שיעור 5 מתוך 10', color: 'peach' },
  { id: 'data', title: 'יסודות מדעי הנתונים', category: 'טכנולוגיה', progress: 84, lesson: 'שיעור 10 מתוך 12', color: 'blue' },
];

const descriptions = {
  harmony: 'חום מעורר השראה פוגש טכנולוגיה נקייה ומאוזנת.',
  'soft-tech': 'סביבת למידה מדויקת ומאורגנת, עם טכנולוגיה בגובה העיניים.',
  'sunrise-minimal': 'מרחב עריכתי ושקט שמפנה מקום להתקדמות שלך.',
  'modern-bloom': 'למידה יצירתית ואורגנית, עם מבנה ברור ותנועה עדינה.',
};

function BrandMark({ design }) {
  if (design === 'harmony') {
    return (
      <svg className="additional-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 33c-9 0-15-5-15-13 8 0 13 3 15 9 2-10 9-16 19-17-1 13-7 21-19 21Z" />
        <path d="M14 37h24M19 11a11 11 0 0 1 11 0" />
        <circle cx="24" cy="21" r="3" />
      </svg>
    );
  }
  if (design === 'soft-tech') {
    return (
      <svg className="additional-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M12 32 23 14l12 18M12 32h24M23 14l1 18" />
        <circle cx="23" cy="13" r="3" />
        <circle cx="11" cy="33" r="3" />
        <circle cx="37" cy="33" r="3" />
        <path d="M24 31c-1-8 4-13 13-14-1 8-5 13-13 14Z" />
      </svg>
    );
  }
  if (design === 'sunrise-minimal') {
    return (
      <svg className="additional-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 31h30M14 31a10 10 0 0 1 20 0M24 9v5M12 16l4 4m20-4-4 4" />
        <path d="M20 31c1-5 4-8 10-10" />
      </svg>
    );
  }
  return (
    <svg className="additional-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 38c-2-9-1-17 1-25M24 28c-9 1-14-3-15-11 9-1 14 3 15 11Zm1-5c1-9 6-14 15-14 0 9-5 14-15 14Zm-1 8c-6-5-11-5-17-1 4 7 10 8 17 1Zm2-1c5-6 10-7 17-4-3 8-9 10-17 4Z" />
      <circle cx="25" cy="12" r="2" />
    </svg>
  );
}

function Header({ design, activeNavigation, onNavigate, sidebar = false }) {
  const links = navigation.map((item) => (
    <button
      className={`additional-nav-link${activeNavigation === item.id ? ' is-active' : ''}`}
      key={item.id}
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={activeNavigation === item.id ? 'page' : undefined}
    >
      <span aria-hidden="true">{item.icon}</span>
      {item.label}
    </button>
  ));

  if (sidebar) {
    return (
      <aside className="additional-sidebar">
        <a className="additional-brand" href="/design-preview" aria-label="FocusMind AI">
          <BrandMark design={design} />
          <span><strong>FocusMind AI</strong><small>מרחב למידה אישי</small></span>
        </a>
        <span className="additional-nav-heading">המרחב שלך</span>
        <nav className="additional-nav additional-nav--vertical" aria-label="ניווט ראשי">
          {links}
        </nav>
        <div className="additional-sidebar-note">
          <span aria-hidden="true">✦</span>
          <strong>בקצב שלך</strong>
          <small>כל צעד קטן הוא התקדמות.</small>
        </div>
        <Profile />
      </aside>
    );
  }

  return (
    <header className={`additional-header additional-header--${design}`}>
      <a className="additional-brand" href="/design-preview" aria-label="FocusMind AI">
        <BrandMark design={design} />
        <span><strong>FocusMind AI</strong><small>מרחב למידה אישי</small></span>
      </a>
      <nav className="additional-nav" aria-label="ניווט ראשי">
        {links}
      </nav>
      <Profile />
    </header>
  );
}

function Profile() {
  return (
    <button className="additional-profile" type="button" aria-label="הפרופיל של נועה">
      <span className="additional-avatar">נ</span>
      <span><strong>נועה ישראלי</strong><small>תוכנית אישית</small></span>
      <span className="additional-profile-chevron" aria-hidden="true">⌄</span>
    </button>
  );
}

function ConceptCaption({ concept }) {
  return (
    <div className="additional-concept-caption">
      <span>כיוון עיצובי 0{concept.id === 'harmony' ? 5 : concept.id === 'soft-tech' ? 6 : concept.id === 'sunrise-minimal' ? 7 : 8}</span>
      <strong>{concept.name}</strong>
      <p>{descriptions[concept.id]}</p>
    </div>
  );
}

function CourseCards({ variant = '' }) {
  return (
    <div className={`additional-course-list${variant ? ` additional-course-list--${variant}` : ''}`}>
      {courses.map((course) => (
        <article className={`additional-course additional-course--${course.color}`} key={course.id}>
          <span className="additional-course-symbol" aria-hidden="true">
            {course.color === 'teal' ? '◌' : course.color === 'peach' ? '✳' : '⌘'}
          </span>
          <div className="additional-course-copy">
            <small>{course.category}</small>
            <h3>{course.title}</h3>
            <span>{course.lesson}</span>
          </div>
          <div className="additional-course-progress">
            <div role="progressbar" aria-label={`התקדמות בקורס ${course.title}`} aria-valuenow={course.progress} aria-valuemin="0" aria-valuemax="100">
              <span style={{ width: `${course.progress}%` }} />
            </div>
            <strong>{course.progress}%</strong>
          </div>
          <button type="button" className="additional-course-link" aria-label={`המשך בקורס ${course.title}`}>←</button>
        </article>
      ))}
    </div>
  );
}

function SmartLearningButton() {
  return <button className="additional-smart-button" type="button"><span aria-hidden="true">✦</span> מעבר ללמידה חכמה <span aria-hidden="true">←</span></button>;
}

function Harmony({ activeNavigation, onNavigate, concept }) {
  return (
    <section className="additional-design additional-design--harmony" data-design={concept.id} aria-label={`תצוגה מקדימה של ${concept.name}`}>
      <Header design={concept.id} activeNavigation={activeNavigation} onNavigate={onNavigate} />
      <div className="additional-content additional-content--harmony">
        <ConceptCaption concept={concept} />
        <section className="harmony-welcome">
          <div>
            <span className="additional-eyebrow"><i /> יום שלישי, 28 באוקטובר</span>
            <h1>בוקר טוב, נועה</h1>
            <p>כל יום הוא הזדמנות חדשה ללמוד משהו שמעניין אותך.</p>
            <SmartLearningButton />
          </div>
          <div className="harmony-sunrise" aria-hidden="true"><span>✦</span><i /><b /></div>
          <aside className="harmony-welcome-note"><span>המסע שלך</span><strong>72%</strong><small>מהיעד השבועי כבר מאחורייך</small></aside>
        </section>
        <div className="harmony-layout">
          <section className="additional-panel harmony-courses">
            <PanelHeading title="ממשיכים ללמוד" note="הקורסים הפעילים שלך" action="כל הקורסים" />
            <CourseCards variant="harmony" />
          </section>
          <aside className="additional-panel harmony-ai">
            <span className="additional-ai-mark" aria-hidden="true"><span>✳</span></span>
            <small>העוזרת החכמה שלך</small>
            <h2>רגע של בהירות</h2>
            <p>התחילי במשימה החשובה ביותר. 25 דקות של ריכוז יכולות לשנות את כל היום.</p>
            <button type="button" className="additional-text-button">הצעה מותאמת עבורך <span>←</span></button>
            <div className="harmony-ai-footer"><span>יעד שבועי</span><strong>4.5 <small>/ 6 שעות</small></strong></div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function PanelHeading({ title, note, action }) {
  return (
    <div className="additional-panel-heading">
      <div><h2>{title}</h2><p>{note}</p></div>
      {action && <button type="button" className="additional-text-button">{action} <span>←</span></button>}
    </div>
  );
}

function SoftTech({ activeNavigation, onNavigate, concept }) {
  return (
    <section className="additional-design additional-design--soft-tech" data-design={concept.id} aria-label={`תצוגה מקדימה של ${concept.name}`}>
      <div className="soft-tech-layout">
        <Header design={concept.id} activeNavigation={activeNavigation} onNavigate={onNavigate} sidebar />
        <div className="soft-tech-main">
          <header className="soft-tech-topline">
            <ConceptCaption concept={concept} />
            <span className="soft-tech-system"><i /> כל המערכות פעילות</span>
          </header>
          <section className="soft-tech-welcome">
            <div><span className="additional-eyebrow">יום שלישי, 28 באוקטובר</span><h1>בוקר טוב, נועה</h1><p>הנה תמונת מצב ברורה של ההתקדמות שלך.</p></div>
            <SmartLearningButton />
          </section>
          <section className="soft-tech-metrics" aria-label="נתוני למידה">
            <Metric label="התקדמות שבועית" value="72%" detail="+12% מהשבוע שעבר" />
            <Metric label="זמן למידה" value="4.5 שעות" detail="מתוך יעד של 6 שעות" />
            <Metric label="רצף למידה" value="5 ימים" detail="המשיכי כך" />
          </section>
          <div className="soft-tech-grid">
            <section className="additional-panel soft-tech-courses">
              <PanelHeading title="קורסים פעילים" note="המשיכי בדיוק מהמקום שבו עצרת" action="הצגת הכול" />
              <CourseCards variant="soft-tech" />
            </section>
            <aside className="additional-panel soft-tech-ai">
              <span className="soft-tech-ai-icon" aria-hidden="true">⌘</span>
              <small>FOCUSMIND AI · תובנה יומית</small>
              <h2>התקדמות עקבית מנצחת מרתון.</h2>
              <p>לפי הקצב שלך, חלוקה למקטעים של 25 דקות תשאיר מקום גם להפסקה טובה.</p>
              <button type="button" className="additional-text-button">תכנון מקטע למידה <span>←</span></button>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail }) {
  return <article className="soft-tech-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function SunriseMinimal({ activeNavigation, onNavigate, concept }) {
  return (
    <section className="additional-design additional-design--sunrise" data-design={concept.id} aria-label={`תצוגה מקדימה של ${concept.name}`}>
      <Header design={concept.id} activeNavigation={activeNavigation} onNavigate={onNavigate} />
      <div className="sunrise-content">
        <ConceptCaption concept={concept} />
        <div className="sunrise-intro">
          <span className="additional-eyebrow">יום שלישי · 28 באוקטובר</span>
          <h1>הידע שלך,<br /><em>בקצב שלך.</em></h1>
          <p>בוקר טוב, נועה. יש לך דרך יפה מאחורייך, ועוד הרבה סקרנות לפנייך.</p>
          <SmartLearningButton />
          <span className="sunrise-decoration" aria-hidden="true"><i /><b /></span>
        </div>
        <section className="sunrise-progress-panel">
          <div className="sunrise-progress-copy"><span>ההתקדמות השבועית</span><strong>72<small>%</small></strong><p>כמעט שם. עוד מפגש אחד קטן השבוע ויש לך את זה.</p></div>
          <div className="sunrise-progress-visual" role="progressbar" aria-label="ההתקדמות השבועית" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100">
            <div><span /></div><small>4.5 שעות מתוך 6</small>
          </div>
          <div className="sunrise-stat"><span>רצף למידה</span><strong>5 ימים</strong></div>
        </section>
        <section className="sunrise-courses">
          <PanelHeading title="הסקרנות שלך עכשיו" note="שלושה מסעות למידה שמחכים לך" action="לכל הקורסים" />
          <CourseCards variant="sunrise" />
        </section>
        <aside className="sunrise-ai"><span aria-hidden="true">✳</span><p><strong>הצעה קטנה מ-FocusMind AI</strong> התחילי בנושא שהכי מסקרן אותך היום. מומנטום נבנה מצעדים קטנים.</p><button type="button" className="additional-text-button">לרגע של מיקוד <span>←</span></button></aside>
      </div>
    </section>
  );
}

function ModernBloom({ activeNavigation, onNavigate, concept }) {
  return (
    <section className="additional-design additional-design--modern-bloom" data-design={concept.id} aria-label={`תצוגה מקדימה של ${concept.name}`}>
      <Header design={concept.id} activeNavigation={activeNavigation} onNavigate={onNavigate} />
      <div className="bloom-content">
        <ConceptCaption concept={concept} />
        <section className="bloom-hero">
          <div className="bloom-hero-copy">
            <span className="additional-eyebrow"><i /> המרחב שלך לצמוח</span>
            <h1>בוקר טוב,<br />נועה <span>✿</span></h1>
            <p>סקרנות קטנה היום יכולה להפוך לרעיון גדול מחר.</p>
            <SmartLearningButton />
            <div className="bloom-hero-stat"><strong>72%</strong><span>מהיעד השבועי הושלם</span><div role="progressbar" aria-label="התקדמות שבועית" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100"><span /></div></div>
          </div>
          <div className="bloom-art" aria-hidden="true"><span className="bloom-art-orbit bloom-art-orbit--one" /><span className="bloom-art-orbit bloom-art-orbit--two" /><span className="bloom-art-flower">✿</span><span className="bloom-art-node">✦</span><small>לומדים. צומחים.</small></div>
        </section>
        <div className="bloom-lower-grid">
          <section className="bloom-courses">
            <PanelHeading title="הקורסים שלך" note="כל התקדמות מתחילה בצעד אחד" action="עוד קורסים" />
            <CourseCards variant="bloom" />
          </section>
          <aside className="bloom-ai">
            <span className="bloom-ai-icon" aria-hidden="true">✳</span>
            <small>העוזרת החכמה שלך</small>
            <h2>זמן לפרוח ברעיון חדש?</h2>
            <p>יש לך אנרגיה טובה ללמידה. נסי לפתוח את השיעור הבא במדעי המוח.</p>
            <button type="button" className="additional-text-button">לפתוח מרחב למידה <span>←</span></button>
            <div className="bloom-ai-footer"><span>רצף למידה</span><strong>5 ימים</strong></div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function AdditionalDesigns({ concept }) {
  const [activeNavigation, setActiveNavigation] = useState('dashboard');
  const props = { activeNavigation, onNavigate: setActiveNavigation, concept };

  if (concept.id === 'harmony') return <Harmony {...props} />;
  if (concept.id === 'soft-tech') return <SoftTech {...props} />;
  if (concept.id === 'sunrise-minimal') return <SunriseMinimal {...props} />;
  return <ModernBloom {...props} />;
}
