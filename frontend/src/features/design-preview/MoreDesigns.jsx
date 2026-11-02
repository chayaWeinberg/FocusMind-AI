import { useState } from 'react';
import './MoreDesigns.css';

const courses = [
  { title: 'מבוא למדעי המוח', topic: 'מדעי החיים', lesson: 'שיעור 8 מתוך 12', progress: 68, artwork: 'brain' },
  { title: 'חשיבה עיצובית', topic: 'יצירתיות', lesson: 'שיעור 5 מתוך 10', progress: 42, artwork: 'design' },
  { title: 'יסודות מדעי הנתונים', topic: 'טכנולוגיה', lesson: 'שיעור 10 מתוך 12', progress: 84, artwork: 'data' },
];

const descriptions = {
  serenity: 'מרחב למידה שליו, בהשראת טבע ואור בוקר.',
  inspire: 'מסע למידה מעורר השראה, צעד אחר צעד.',
  naturetech: 'טכנולוגיה חכמה צומחת יחד עם סקרנות טבעית.',
  flow: 'סביבת למידה זורמת שמפנה מקום לריכוז.',
  elegant: 'למידה מדויקת, אלגנטית ועל־זמנית.',
  'bloom-14': 'מרחב אביבי של רעיונות חדשים והתקדמות.',
};

const designNumbers = {
  serenity: '09',
  inspire: '10',
  naturetech: '11',
  flow: '12',
  elegant: '13',
  'bloom-14': '14',
};

const navigation = [
  { id: 'home', label: 'ראשי', symbol: '⌂' },
  { id: 'courses', label: 'הקורסים שלי', symbol: '▤' },
  { id: 'progress', label: 'ההתקדמות', symbol: '↗' },
  { id: 'smart', label: 'למידה חכמה', symbol: '✳' },
];

function Brand({ compact = false }) {
  return (
    <a className="more-brand" href="/design-preview" aria-label="FocusMind AI">
      <span className="more-brand-symbol" aria-hidden="true"><i /><b /></span>
      {!compact && <span><strong>FocusMind AI</strong><small>מרחב הלמידה שלך</small></span>}
    </a>
  );
}

function Navigation({ active, onChange, variant = '' }) {
  return (
    <nav className={`more-navigation${variant ? ` more-navigation--${variant}` : ''}`} aria-label="ניווט ראשי">
      {navigation.map((item) => (
        <button
          className={`more-navigation-link${active === item.id ? ' is-active' : ''}`}
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
          aria-label={item.label}
        >
          <span aria-hidden="true">{item.symbol}</span>
          {variant !== 'rail' && <small>{item.label}</small>}
        </button>
      ))}
    </nav>
  );
}

function Profile() {
  return (
    <button className="more-profile" type="button" aria-label="הפרופיל של נועה">
      <span>נ</span><strong>נועה ישראלי</strong><i aria-hidden="true">⌄</i>
    </button>
  );
}

function GalleryLabel({ concept }) {
  return (
    <div className="more-design-label">
      <span>כיוון עיצובי {designNumbers[concept.id]}</span>
      <strong>{concept.name}</strong>
      <p>{descriptions[concept.id]}</p>
    </div>
  );
}

function SmartAction({ label = 'מעבר ללמידה חכמה' }) {
  return (
    <button className="more-smart-action" type="button">
      <span aria-hidden="true">✦</span>{label}<b aria-hidden="true">←</b>
    </button>
  );
}

function Illustration({ type }) {
  if (type === 'serenity') {
    return (
      <svg className="more-illustration more-illustration--serenity" viewBox="0 0 640 300" role="img" aria-label="נוף של גבעות רכות, עצים ואור בוקר">
        <defs>
          <linearGradient id="serenity-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F7E5D2" /><stop offset="1" stopColor="#E5F2EA" /></linearGradient>
          <linearGradient id="serenity-hill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#94C9B7" /><stop offset="1" stopColor="#4A9A90" /></linearGradient>
        </defs>
        <rect width="640" height="300" rx="24" fill="url(#serenity-sky)" />
        <circle cx="470" cy="82" r="39" fill="#F2BD91" opacity=".92" />
        <path d="M0 140c72-38 123-27 188-1 67 27 121 20 191-11 71-32 157-30 261 7v165H0Z" fill="#C5E1D2" />
        <path d="M0 190c97-55 179-41 260-2 86 43 171 38 244-1 58-31 99-32 136-21v134H0Z" fill="#91C7B5" />
        <path d="M0 236c111-36 176-25 268 6 91 31 182 8 255-20 45-17 81-18 117-8v86H0Z" fill="url(#serenity-hill)" />
        <path d="M57 212v-40m-12 8c0-20 25-26 25-6 15-3 19 18 2 22H48c-12-2-9-17-3-16Zm70 30v-55m-14 14c-1-21 25-28 28-7 14 0 18 19 1 24h-27c-12-3-10-17-2-17Z" fill="none" stroke="#347C72" strokeWidth="5" strokeLinecap="round" />
        <path d="M361 62c13-13 30-12 41 0-14 8-28 8-41 0Zm56 23c11-10 23-10 34-1-11 6-22 7-34 1Z" fill="#FFF" opacity=".68" />
        <path d="M454 202c-20-10-24-25-14-36 14 4 22 17 20 36Zm0 0c-1-19 8-31 23-34 8 13 0 28-23 34Zm-1 0c-8-16-5-30 8-38 13 9 12 23-8 38Z" fill="#3C897C" />
        <path d="M453 203v24" stroke="#537E6B" strokeWidth="3" strokeLinecap="round" />
        <path d="M532 220c-15-8-17-19-9-27 11 4 15 13 13 27Zm0 0c1-13 8-20 19-21 5 10 0 19-19 21Z" fill="#E5F0DC" />
        <path d="M531 221v16" stroke="#537E6B" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="310" cy="221" r="3" fill="#F8E8C6" /><circle cx="329" cy="211" r="2" fill="#FFF" />
      </svg>
    );
  }
  if (type === 'inspire') {
    return (
      <svg className="more-illustration more-illustration--inspire" viewBox="0 0 680 330" role="img" aria-label="זריחה מעל שכבות הרים בגווני אפרסק, כחול ולבנדר">
        <defs>
          <linearGradient id="inspire-sky" x1=".1" y1="0" x2=".8" y2="1"><stop stopColor="#D8E7F1" /><stop offset=".7" stopColor="#F8E7DA" /></linearGradient>
          <linearGradient id="inspire-sun" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F5C09A" /><stop offset="1" stopColor="#E99D88" /></linearGradient>
        </defs>
        <rect width="680" height="330" rx="26" fill="url(#inspire-sky)" />
        <circle cx="491" cy="128" r="61" fill="url(#inspire-sun)" />
        <path d="M0 218 123 94l109 112 106-128 171 162 89-92 82 72v110H0Z" fill="#B5BDD9" opacity=".77" />
        <path d="m93 125 30-31 31 32-31-11Zm213-21 32-26 34 31-35-12Zm269 59 23-24 23 25-24-9Z" fill="#F7F5F1" opacity=".84" />
        <path d="M0 248c93-83 178-61 258-8 66 44 131 26 201-15 76-45 152-29 221 24v81H0Z" fill="#87B3C2" />
        <path d="M0 284c91-65 173-53 258-7 89 47 171 32 239-8 78-46 127-30 183 3v58H0Z" fill="#668F9E" />
        <path d="M139 245v-31m-15-5c0-16 20-20 24-4 12 2 12 17 0 20h-21c-11-3-10-15-3-16Zm363 26v-42m-16-3c1-18 22-23 28-5 12 3 12 20-2 23h-24c-12-3-10-17-2-18Z" fill="none" stroke="#447E83" strokeWidth="4" strokeLinecap="round" />
        <path d="M52 73c10-9 22-8 31 1-10 6-21 6-31-1Zm49 17c8-7 18-7 26 1-9 5-18 5-26-1Z" fill="#FFF" opacity=".8" />
        <path d="M435 233c14-10 30-8 38 5-12 6-26 5-38-5Z" fill="#F7E3D0" opacity=".72" />
      </svg>
    );
  }
  if (type === 'naturetech') {
    return (
      <svg className="more-illustration more-illustration--naturetech" viewBox="0 0 520 420" role="img" aria-label="איור מופשט של מוח, עלים וקשרי ידע דיגיטליים">
        <defs>
          <radialGradient id="nature-orb"><stop stopColor="#F6FAF4" /><stop offset="1" stopColor="#DDEDE5" /></radialGradient>
        </defs>
        <circle cx="260" cy="210" r="178" fill="url(#nature-orb)" />
        <path d="M255 310c-45 0-75-31-75-73 0-23 10-41 27-54-10-35 15-67 49-64 26-35 77-22 83 19 37 15 45 64 16 91-1 44-31 81-76 81h-24Z" fill="#F7FBF6" stroke="#438F83" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M253 124v183m-1-145c-25-4-38 4-46 21m47 8c24-14 43-12 57 4m-56 22c-21-2-34 9-37 25m39-1c25-11 42-5 51 12m-53 15c-17 0-26 9-28 23m29-4c19-7 33-1 39 15" fill="none" stroke="#95C8B2" strokeWidth="4" strokeLinecap="round" />
        <path d="M116 149c-34-4-54-27-50-61 32 2 51 22 50 61Zm0 0c-1-35 19-56 52-59 3 34-16 55-52 59Zm173-68c-29-24-30-55-3-80 27 19 30 49 3 80Zm1 0c14-31 42-42 71-27-13 30-39 42-71 27Z" transform="translate(0 56)" fill="#81B59E" />
        <path d="M116 205c22 12 37 31 47 57m127-66c24-30 49-43 78-46" fill="none" stroke="#4E927D" strokeWidth="3" strokeLinecap="round" />
        <path d="M91 263c25 15 43 14 59-2m192-64c24 17 46 16 64-2" fill="none" stroke="#C1DCCD" strokeWidth="4" strokeLinecap="round" />
        <g fill="#F1B88F" stroke="#fff" strokeWidth="4"><circle cx="151" cy="124" r="9" /><circle cx="361" cy="147" r="8" /><circle cx="334" cy="325" r="8" /></g>
        <g stroke="#78AFA3" strokeWidth="2" strokeDasharray="4 7"><path d="m151 124 48 29m162-6-44 27m17 151-44-31" /></g>
        <circle cx="151" cy="124" r="18" fill="none" stroke="#B6D7C8" strokeWidth="2" /><circle cx="361" cy="147" r="16" fill="none" stroke="#B6D7C8" strokeWidth="2" />
      </svg>
    );
  }
  if (type === 'flow') {
    return (
      <svg className="more-illustration more-illustration--flow" viewBox="0 0 760 300" role="img" aria-label="ספרים פתוחים, צמח וזרימת גלים בגווני טורקיז">
        <defs>
          <linearGradient id="flow-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E7F6F5" /><stop offset="1" stopColor="#D8ECF2" /></linearGradient>
        </defs>
        <rect width="760" height="300" rx="28" fill="url(#flow-bg)" />
        <path d="M0 90c127 57 220 65 348 22 117-39 239-48 412 3v185H0Z" fill="#C7E9E8" />
        <path d="M0 154c126 30 227 24 343-14 133-44 263-17 417 40v120H0Z" fill="#8CCBCB" opacity=".76" />
        <path d="M0 225c145-35 244-14 353 18 119 35 246 16 407-20v77H0Z" fill="#70B9BE" opacity=".58" />
        <path d="M241 203c43-34 84-37 128-7 42-28 83-23 123 11l-9 37c-36-25-72-27-112-2-42-25-80-21-119 6Z" fill="#FBF8EE" stroke="#4F9297" strokeWidth="3" strokeLinejoin="round" />
        <path d="M365 197v46m0-45c-36-27-70-29-105-5m105 5c36-24 72-22 109 1" fill="none" stroke="#A8D4CF" strokeWidth="2" />
        <path d="M141 212c-26-15-31-36-16-52 21 5 31 21 25 48 4-28 21-42 42-40 5 22-9 39-44 48Zm18 7v27" fill="#5A9B87" />
        <path d="M500 73c14-12 30-11 42 2-14 8-28 7-42-2Zm45 22c9-8 21-8 30 2-11 6-21 5-30-2Z" fill="#FFF" opacity=".85" />
        <circle cx="620" cy="79" r="30" fill="#F3C39D" opacity=".85" />
        <path d="M65 67c12-10 26-10 37 0-12 7-24 7-37 0Z" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
    );
  }
  if (type === 'elegant') {
    return (
      <svg className="more-illustration more-illustration--elegant" viewBox="0 0 620 300" role="img" aria-label="נוף מינימליסטי של זריחה, גבעות וענף בוטני">
        <rect width="620" height="300" rx="8" fill="#F3EFE3" />
        <circle cx="405" cy="112" r="52" fill="#D7BFA0" />
        <path d="M0 178c92-70 171-82 258-31 68 39 141 32 216-4 59-28 108-26 146-7v164H0Z" fill="#D7DED0" />
        <path d="M0 218c81-35 156-37 236 2 92 44 175 43 260 0 49-25 89-35 124-30v110H0Z" fill="#AABDAD" />
        <path d="M0 262c105-31 183-16 266 12 83 28 171 20 248-12 39-16 75-20 106-12v50H0Z" fill="#748E7B" />
        <path d="M523 247c-1-35-7-65-22-92m21 64c-20-7-31-20-32-39 19 3 30 15 32 39Zm-1-23c2-20 12-32 31-34 2 19-9 31-31 34Zm-4-24c-15-10-20-24-14-40 16 7 22 20 14 40Z" fill="none" stroke="#557661" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M75 64h51M100 39v50M91 46l18 37m0-37L91 83" stroke="#C69C75" strokeWidth="1.5" opacity=".7" />
        <path d="M180 64c13-9 26-8 38 2-12 7-25 6-38-2Z" fill="#fff" opacity=".8" />
      </svg>
    );
  }
  return (
    <svg className="more-illustration more-illustration--bloom" viewBox="0 0 680 330" role="img" aria-label="נוף אביבי עם עץ פורח, גבעות ופרחי בר">
      <defs>
        <linearGradient id="bloom-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F9E8E4" /><stop offset="1" stopColor="#F6F3E9" /></linearGradient>
      </defs>
      <rect width="680" height="330" rx="28" fill="url(#bloom-sky)" />
      <circle cx="505" cy="89" r="42" fill="#E9B8A7" opacity=".8" />
      <path d="M0 195c104-72 197-67 289-7 84 54 154 52 241 6 54-28 101-26 150-3v139H0Z" fill="#D9E7D7" />
      <path d="M0 237c106-42 183-30 273 12 86 41 178 31 267-9 54-25 95-28 140-13v103H0Z" fill="#9FC4A8" />
      <path d="M0 280c114-27 194-18 286 9 99 30 180 13 252-10 60-19 104-17 142-4v55H0Z" fill="#729D83" />
      <path d="M146 239V91m-1 57c-36-13-49-39-35-65 27 6 40 27 35 65Zm1-29c10-37 34-53 67-44 0 31-22 49-67 49Zm-2-46c-25-20-30-45-13-69 27 13 34 36 13 69Z" fill="#548B72" />
      <path d="M144 95c-29-9-37-29-22-52 22 4 31 21 22 52Zm3-6c8-28 27-38 52-27-3 24-20 35-52 27Z" fill="#79A887" />
      <g fill="#F7D8D1" stroke="#FFF9F5" strokeWidth="2">
        <circle cx="111" cy="87" r="8" /><circle cx="179" cy="112" r="7" /><circle cx="135" cy="48" r="7" />
        <circle cx="177" cy="67" r="8" /><circle cx="103" cy="122" r="6" /><circle cx="203" cy="96" r="6" />
      </g>
      <g fill="#F3D28E">
        <circle cx="316" cy="260" r="4" /><circle cx="344" cy="280" r="3" /><circle cx="392" cy="257" r="4" />
        <circle cx="425" cy="284" r="3" /><circle cx="574" cy="258" r="4" /><circle cx="605" cy="276" r="3" />
      </g>
      <path d="M313 270v12m-5-8 5-4 5 4m26 17v11m-5-7 5-4 5 4m46-29v13m-5-8 5-4 5 4m155 5v12m-5-8 5-4 5 4" fill="none" stroke="#F8F2E3" strokeWidth="2" strokeLinecap="round" />
      <path d="M394 65c10-9 22-9 32 0-10 6-21 6-32 0Z" fill="#FFF" opacity=".86" />
    </svg>
  );
}

function CourseCard({ course, variant = '' }) {
  return (
    <article className={`more-course more-course--${course.artwork}${variant ? ` more-course--${variant}` : ''}`}>
      <div className="more-course-art" aria-hidden="true">
        {course.artwork === 'brain' ? <span>◉</span> : course.artwork === 'design' ? <span>✳</span> : <span>⌘</span>}
        <i />
      </div>
      <div className="more-course-copy">
        <small>{course.topic}</small>
        <h3>{course.title}</h3>
        <p>{course.lesson}</p>
      </div>
      <div className="more-course-progress">
        <div role="progressbar" aria-label={`התקדמות בקורס ${course.title}`} aria-valuenow={course.progress} aria-valuemin="0" aria-valuemax="100">
          <span style={{ width: `${course.progress}%` }} />
        </div>
        <strong>{course.progress}%</strong>
      </div>
      <button type="button" className="more-course-continue">המשך ללמוד <span aria-hidden="true">←</span></button>
    </article>
  );
}

function CourseList({ variant = '' }) {
  return <div className={`more-course-list${variant ? ` more-course-list--${variant}` : ''}`}>{courses.map((course) => <CourseCard key={course.title} course={course} variant={variant} />)}</div>;
}

function ProgressWidget({ variant = '' }) {
  return (
    <section className={`more-progress-widget${variant ? ` more-progress-widget--${variant}` : ''}`} aria-label="התקדמות שבועית">
      <div><small>ההתקדמות השבועית</small><strong>72<em>%</em></strong><span>+12% מהשבוע שעבר</span></div>
      <div className="more-progress-ring" role="progressbar" aria-label="יעד שבועי שהושלם" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100"><span>72<small>%</small></span></div>
    </section>
  );
}

function AiPanel({ variant = '' }) {
  return (
    <aside className={`more-ai-panel${variant ? ` more-ai-panel--${variant}` : ''}`}>
      <span className="more-ai-icon" aria-hidden="true">✳</span>
      <div><small>FOCUSMIND AI · הצעה אישית</small><h2>צעד קטן, למידה משמעותית.</h2><p>הקצב שלך יציב. נסי לפתוח את השיעור הבא במדעי המוח במקטע מיקוד של 25 דקות.</p></div>
      <button type="button">לתכנון מפגש למידה <span aria-hidden="true">←</span></button>
    </aside>
  );
}

function Welcome({ concept, children, variant = '' }) {
  return (
    <section className={`more-welcome more-welcome--${concept.id}${variant ? ` ${variant}` : ''}`}>
      <div className="more-welcome-copy">
        <span className="more-welcome-date">יום שלישי · 28 באוקטובר</span>
        <h1>בוקר טוב, נועה</h1>
        <p>היום הוא הזדמנות להתקדם, בסקרנות ובקצב שלך.</p>
        <SmartAction />
      </div>
      {children}
    </section>
  );
}

function DesignFrame({ concept, active, onNavigate, children, header = 'top' }) {
  return (
    <section className={`more-design more-design--${concept.id}`} data-design={concept.id} aria-label={`תצוגה מקדימה של ${concept.name}`}>
      {header === 'sidebar' ? (
        <div className="more-sidebar-layout">
          <aside className="more-sidebar">
            <Brand />
            <Navigation active={active} onChange={onNavigate} variant="side" />
            <Profile />
          </aside>
          <div className="more-sidebar-main">
            <header className="more-sidebar-top"><span>יום שלישי · 28 באוקטובר</span></header>
            <div className="more-design-inner">
              <GalleryLabel concept={concept} />
              {children}
            </div>
          </div>
        </div>
      ) : header === 'rail' ? (
        <div className="more-rail-layout">
          <aside className="more-rail">
            <Brand compact />
            <Navigation active={active} onChange={onNavigate} variant="rail" />
          </aside>
          <div className="more-rail-main">
            <header className="more-header more-header--rail">
              <span>יום שלישי · 28 באוקטובר</span>
              <Profile />
            </header>
            <GalleryLabel concept={concept} />
            {children}
          </div>
        </div>
      ) : (
        <>
          <Header concept={concept} active={active} onNavigate={onNavigate} />
          <div className="more-design-inner">
            <GalleryLabel concept={concept} />
            {children}
          </div>
        </>
      )}
    </section>
  );
}

function Header({ concept, active, onNavigate }) {
  return (
    <header className={`more-header more-header--${concept.id}`}>
      <Brand />
      <Navigation active={active} onChange={onNavigate} />
      <Profile />
    </header>
  );
}

function Serenity({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} header="sidebar" {...state}>
      <Welcome concept={concept} variant="more-welcome--landscape">
        <div className="more-landscape-art"><Illustration type="serenity" /><span>לומדים בנחת, צומחים יחד</span></div>
      </Welcome>
      <div className="more-serenity-stats"><ProgressWidget variant="serenity" /><div className="more-serenity-quote"><span>✧</span><strong>רגע לנשום, ואז להמשיך.</strong><small>העוזרת החכמה שלך מזכירה: למידה טובה מתחילה בקצב שנעים לך.</small></div></div>
      <section className="more-courses-section"><SectionHeading title="הקורסים שלך" subtitle="ממשיכים מהמקום שבו עצרת" /><CourseList variant="serenity" /></section>
      <AiPanel variant="serenity" />
    </DesignFrame>
  );
}

function Inspire({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} header="rail" {...state}>
      <Welcome concept={concept} variant="more-welcome--cinematic">
        <div className="more-inspire-art"><Illustration type="inspire" /><span>כל פסגה מתחילה בצעד</span></div>
      </Welcome>
      <div className="more-inspire-overview"><ProgressWidget variant="inspire" /><div className="more-inspire-streak"><span>רצף הלמידה שלך</span><strong>5 ימים</strong><small>המשכיות נהדרת</small></div><div className="more-inspire-hours"><span>זמן למידה השבוע</span><strong>4.5 <small>מתוך 6 שעות</small></strong><i><b /></i></div></div>
      <section className="more-courses-section"><SectionHeading title="המסע שלך ממשיך" subtitle="שלושה קורסים, והתקדמות יפה בכל אחד" /><CourseList variant="inspire" /></section>
      <AiPanel variant="inspire" />
    </DesignFrame>
  );
}

function NatureTech({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} {...state}>
      <div className="more-nature-intro">
        <div><span className="more-welcome-date">מרחב הלמידה האישי שלך</span><h1>בוקר טוב, נועה</h1><p>הסקרנות שלך והכלים הנכונים יכולים להצמיח רעיונות גדולים.</p><SmartAction label="לפתוח למידה חכמה" /></div>
        <div className="more-nature-brain"><Illustration type="naturetech" /><span>חשיבה · צמיחה · חיבור</span></div>
      </div>
      <div className="more-nature-overview"><ProgressWidget variant="naturetech" /><div className="more-nature-highlight"><span>תובנת AI להיום</span><strong>למידה בקשרים עוזרת לזכור לאורך זמן.</strong><small>נסי לחבר רעיון חדש לנושא שכבר למדת.</small></div></div>
      <section className="more-courses-section"><SectionHeading title="הקורסים הפעילים" subtitle="למידה מחוברת, צעד אחר צעד" /><CourseList variant="naturetech" /></section>
      <AiPanel variant="naturetech" />
    </DesignFrame>
  );
}

function Flow({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} header="rail" {...state}>
      <Welcome concept={concept} variant="more-welcome--flow">
        <div className="more-flow-art"><Illustration type="flow" /><span>למצוא את הקצב שלך</span></div>
      </Welcome>
      <div className="more-flow-progress"><ProgressWidget variant="flow" /><div className="more-flow-chart" aria-label="דקות למידה לאורך השבוע">{[42, 68, 54, 83, 61, 72, 35].map((value, index) => <div key={index}><i style={{ height: `${value}%` }} /><small>{['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][index]}</small></div>)}</div></div>
      <section className="more-courses-section"><SectionHeading title="ממשיכים לזרום" subtitle="השיעור הבא כבר מחכה לך" /><CourseList variant="flow" /></section>
      <AiPanel variant="flow" />
    </DesignFrame>
  );
}

function Elegant({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} {...state}>
      <Welcome concept={concept} variant="more-welcome--editorial">
        <div className="more-elegant-art"><Illustration type="elegant" /><span>«ללמוד פירושו לפתוח חלון»</span></div>
      </Welcome>
      <div className="more-elegant-rule"><span>המסע השבועי שלך</span><i /><strong>72%</strong><small>יעד שבועי</small></div>
      <section className="more-courses-section more-courses-section--elegant"><SectionHeading title="לימוד נוכחי" subtitle="התקדמות שקטה ובטוחה" /><CourseList variant="elegant" /></section>
      <AiPanel variant="elegant" />
    </DesignFrame>
  );
}

function Bloom({ concept, ...state }) {
  return (
    <DesignFrame concept={concept} {...state}>
      <Welcome concept={concept} variant="more-welcome--spring">
        <div className="more-bloom-art"><Illustration type="bloom" /><span>רעיונות חדשים מתחילים כאן</span></div>
      </Welcome>
      <div className="more-bloom-metrics"><ProgressWidget variant="bloom-14" /><div><span>רצף למידה</span><strong>5 ימים</strong><small>איזה יופי של התמדה!</small></div><div><span>זמן השבוע</span><strong>4.5 שעות</strong><small>מתוך יעד של 6 שעות</small></div></div>
      <section className="more-courses-section"><SectionHeading title="מה נלמד היום?" subtitle="הקורסים שמפריחים רעיונות חדשים" /><CourseList variant="bloom-14" /></section>
      <AiPanel variant="bloom-14" />
    </DesignFrame>
  );
}

function SectionHeading({ title, subtitle }) {
  return <div className="more-section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button">לכל הקורסים <span aria-hidden="true">←</span></button></div>;
}

export default function MoreDesigns({ concept }) {
  const [active, setActive] = useState('home');
  const shared = { concept, active, onNavigate: setActive };
  if (concept.id === 'serenity') return <Serenity {...shared} />;
  if (concept.id === 'inspire') return <Inspire {...shared} />;
  if (concept.id === 'naturetech') return <NatureTech {...shared} />;
  if (concept.id === 'flow') return <Flow {...shared} />;
  if (concept.id === 'elegant') return <Elegant {...shared} />;
  return <Bloom {...shared} />;
}
