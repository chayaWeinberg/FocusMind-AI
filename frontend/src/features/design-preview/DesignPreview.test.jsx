import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DesignPreview from './DesignPreview.jsx';

const themeStorageKey = 'focusmind-design-preview-theme';

describe('DesignPreview', () => {
  beforeEach(() => {
    window.localStorage.removeItem(themeStorageKey);
  });

  afterEach(() => {
    window.localStorage.removeItem(themeStorageKey);
  });

  it('shows all fifteen concepts and starts with Focus Flow', () => {
    render(<DesignPreview />);

    expect(screen.getByRole('heading', { name: 'חמש עשרה דרכים למצוא את הפוקוס שלך' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FOCUS FLOW 2.0/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /MINDSPARK/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NEURO SPACE/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^04 BLOOM/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FOCUSMIND HARMONY/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SOFT TECH/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SUNRISE MINIMAL/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MODERN BLOOM/ })).toBeInTheDocument();
    for (const [number, name] of [
      ['09', 'FOCUSMIND SERENITY'],
      ['10', 'FOCUSMIND INSPIRE'],
      ['11', 'FOCUSMIND NATURETECH'],
      ['12', 'FOCUSMIND FLOW'],
      ['13', 'FOCUSMIND ELEGANT'],
      ['14', 'FOCUSMIND BLOOM'],
      ['15', 'FOCUSMIND SIGNATURE'],
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`${number} ${name}`) })).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'בחירת כיוון עיצובי' }).querySelectorAll('button'))
      .toHaveLength(15);
  });

  it.each([
    ['MINDSPARK', 'mindspark'],
    ['NEURO SPACE', 'neuro-space'],
    ['04 BLOOM', 'bloom'],
  ])('switches to %s without changing dashboard content or structure', (name, conceptId) => {
    render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

    expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(
      conceptId === 'bloom' ? /^תצוגה מקדימה של BLOOM$/ : new RegExp(name),
    )).toHaveAttribute('data-concept', conceptId);
    expect(screen.getByText('Your Mind. Your Space. Your Way.')).toBeInTheDocument();
    expect(screen.getAllByText('המחשבות שלך. המרחב שלך. הדרך שלך.')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: /בוקר טוב, נועה/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'המשימות של היום' })).toBeInTheDocument();
    expect(screen.getByText('ההתקדמות השבועית')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'רגע של בהירות' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'הזמן שלך לעצמך' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' }).querySelectorAll('button'))
      .toHaveLength(4);
    expect(screen.getByRole('list').querySelectorAll('li')).toHaveLength(4);
  });

  it('renders all required dashboard sections in Hebrew and RTL', () => {
    render(<DesignPreview />);

    const page = screen.getByRole('main');
    expect(page).toHaveAttribute('dir', 'rtl');
    expect(page).toHaveAttribute('lang', 'he');
    expect(screen.getByText('FocusMind AI')).toBeInTheDocument();
    expect(screen.getByText('המשימות של היום')).toBeInTheDocument();
    expect(screen.getByText('ההתקדמות השבועית')).toBeInTheDocument();
    expect(screen.getByText('רגע של בהירות')).toBeInTheDocument();
    expect(screen.getByText('הזמן שלך לעצמך')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'ההתקדמות השבועית' })).toHaveAttribute('aria-valuenow', '72');
  });

  it('allows tasks and the focus timer to be interacted with', () => {
    render(<DesignPreview />);

    const task = screen.getByRole('button', { name: 'סימון כהושלמה: הפסקה קצרה לנשימה' });
    fireEvent.click(task);
    expect(screen.getByRole('button', { name: 'סימון כלא הושלמה: הפסקה קצרה לנשימה' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'מתחילים להתמקד' }));
    expect(screen.getByRole('button', { name: 'השהיית הטיימר' })).toBeInTheDocument();
    expect(screen.getByText('את במצב מיקוד')).toBeInTheDocument();
  });

  it('preserves task and timer state while switching visual themes', () => {
    render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'סימון כהושלמה: הפסקה קצרה לנשימה' }));
    fireEvent.click(screen.getByRole('button', { name: 'מתחילים להתמקד' }));
    fireEvent.click(screen.getByRole('button', { name: /MINDSPARK/ }));

    expect(screen.getByText('3 משימות הושלמו')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השהיית הטיימר' })).toBeInTheDocument();
    expect(screen.getByText('את במצב מיקוד')).toBeInTheDocument();
  });

  it('uses the same inline logo shape for all themes', () => {
    const { container } = render(<DesignPreview />);
    const initialLogo = container.querySelector('.concept-logo-mark').innerHTML;

    for (const [name, id] of [['MINDSPARK', 'mindspark'], ['NEURO SPACE', 'neuro-space'], ['04 BLOOM', 'bloom']]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
      expect(container.querySelector('.concept-preview')).toHaveAttribute('data-concept', id);
      expect(container.querySelector('.concept-logo-mark').innerHTML).toBe(initialLogo);
    }
  });

  it('persists the selected theme for the preview across refreshes', () => {
    const { unmount } = render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: /^04 BLOOM/ }));
    expect(window.localStorage.getItem(themeStorageKey)).toBe('bloom');

    unmount();
    render(<DesignPreview />);

    expect(screen.getByRole('button', { name: /^04 BLOOM/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/^תצוגה מקדימה של BLOOM$/)).toHaveAttribute('data-concept', 'bloom');
  });

  it('falls back to Focus Flow when saved preview theme is unknown', () => {
    window.localStorage.setItem(themeStorageKey, 'unknown-theme');
    render(<DesignPreview />);

    expect(screen.getByRole('button', { name: /FOCUS FLOW 2.0/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['FOCUSMIND HARMONY', 'harmony', 'חום מעורר השראה פוגש טכנולוגיה נקייה ומאוזנת.', 'additional-design--harmony'],
    ['SOFT TECH', 'soft-tech', 'סביבת למידה מדויקת ומאורגנת, עם טכנולוגיה בגובה העיניים.', 'additional-design--soft-tech'],
    ['SUNRISE MINIMAL', 'sunrise-minimal', 'מרחב עריכתי ושקט שמפנה מקום להתקדמות שלך.', 'additional-design--sunrise'],
    ['MODERN BLOOM', 'modern-bloom', 'למידה יצירתית ואורגנית, עם מבנה ברור ותנועה עדינה.', 'additional-design--modern-bloom'],
  ])('renders %s with the shared dashboard content and its distinct layout', (name, id, description, className) => {
    const { container } = render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

    expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(`תצוגה מקדימה של ${name}`)).toHaveAttribute('data-design', id);
    expect(container.querySelector(`.${className}`)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(container.querySelector('.additional-design').textContent).toContain('נועה');
    expect(screen.getByRole('heading', {
      name: {
        harmony: 'ממשיכים ללמוד',
        'soft-tech': 'קורסים פעילים',
        'sunrise-minimal': 'הסקרנות שלך עכשיו',
        'modern-bloom': 'הקורסים שלך',
      }[id],
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'מבוא למדעי המוח' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'חשיבה עיצובית' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'יסודות מדעי הנתונים' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מעבר ללמידה חכמה/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' }).querySelectorAll('button'))
      .toHaveLength(4);
    expect(screen.getByRole('progressbar', { name: 'התקדמות בקורס מבוא למדעי המוח' }))
      .toHaveAttribute('aria-valuenow', '68');
    fireEvent.click(screen.getByRole('button', { name: 'הקורסים שלי' }));
    expect(screen.getByRole('button', { name: 'הקורסים שלי' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['FOCUSMIND SERENITY', 'serenity', 'מרחב למידה שליו, בהשראת טבע ואור בוקר.', '09', 'נוף של גבעות רכות, עצים ואור בוקר'],
    ['FOCUSMIND INSPIRE', 'inspire', 'מסע למידה מעורר השראה, צעד אחר צעד.', '10', 'זריחה מעל שכבות הרים בגווני אפרסק, כחול ולבנדר'],
    ['FOCUSMIND NATURETECH', 'naturetech', 'טכנולוגיה חכמה צומחת יחד עם סקרנות טבעית.', '11', 'איור מופשט של מוח, עלים וקשרי ידע דיגיטליים'],
    ['FOCUSMIND FLOW', 'flow', 'סביבת למידה זורמת שמפנה מקום לריכוז.', '12', 'ספרים פתוחים, צמח וזרימת גלים בגווני טורקיז'],
    ['FOCUSMIND ELEGANT', 'elegant', 'למידה מדויקת, אלגנטית ועל־זמנית.', '13', 'נוף מינימליסטי של זריחה, גבעות וענף בוטני'],
    ['FOCUSMIND BLOOM', 'bloom-14', 'מרחב אביבי של רעיונות חדשים והתקדמות.', '14', 'נוף אביבי עם עץ פורח, גבעות ופרחי בר'],
  ])('renders design %s with its own artwork and shared dashboard content', (name, id, description, number, artworkDescription) => {
    const { container } = render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${number} ${name}`) }));

    const preview = screen.getByLabelText(`תצוגה מקדימה של ${name}`);
    expect(preview).toHaveAttribute('data-design', id);
    expect(preview).toHaveClass(`more-design--${id}`);
    expect(screen.getByText(`כיוון עיצובי ${number}`)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: artworkDescription })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'בוקר טוב, נועה' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'מבוא למדעי המוח' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'חשיבה עיצובית' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'יסודות מדעי הנתונים' })).toBeInTheDocument();
    expect(preview).toHaveTextContent('72%');
    expect(preview.querySelector('.more-smart-action')).toBeInTheDocument();
    expect(screen.getByText('FOCUSMIND AI · הצעה אישית')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' }).querySelectorAll('button'))
      .toHaveLength(4);
    expect(preview.querySelectorAll('[role="progressbar"]')).toHaveLength(id === 'elegant' ? 3 : 4);
    expect(container.querySelector('.concept-preview')).not.toBeInTheDocument();
  });

  it('switches between the new concepts and preserves the preview route and existing option selection', () => {
    render(<DesignPreview />);

    fireEvent.click(screen.getByRole('button', { name: /SOFT TECH/ }));
    expect(screen.getByLabelText('תצוגה מקדימה של SOFT TECH')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /10 FOCUSMIND INSPIRE/ }));
    expect(screen.getByLabelText('תצוגה מקדימה של FOCUSMIND INSPIRE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /14 FOCUSMIND BLOOM/ }));
    expect(screen.getByLabelText('תצוגה מקדימה של FOCUSMIND BLOOM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^04 BLOOM/ }));

    expect(screen.getByLabelText(/^תצוגה מקדימה של BLOOM$/)).toHaveAttribute('data-concept', 'bloom');
    expect(screen.getByRole('heading', { name: 'רגע של בהירות' })).toBeInTheDocument();
  });

  it('switches Design 15 between five independent Hebrew RTL page previews', () => {
    const { container } = render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: /15 FOCUSMIND SIGNATURE/ }));

    const design = container.querySelector('.signature-design');
    expect(design).toHaveAttribute('data-design', 'signature');
    expect(design).toHaveAttribute('data-page', 'landing');
    expect(design).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('navigation', { name: 'דפי Design 15' }).querySelectorAll('button'))
      .toHaveLength(5);

    const pageCases = [
      ['דף נחיתה', 'landing', 'מחברת פתוחה הופכת לעולם של ספרים ורעיונות מצוירים בעיפרון'],
      ['התחברות', 'login', 'שולחן עבודה שקט עם מחברת פתוחה, עיפרון, ספל וענף קטן'],
      ['הרשמה', 'register', 'עיפרון מצייר שביל מתפתל שהופך לספרים ורעיונות חדשים'],
      ['דף הבית', 'dashboard', 'ספרים מצוירים נערמים למדרגות המובילות לרעיון מואר'],
      ['למידה חכמה', 'smart', 'מחברת למידה בעיפרון מוקפת בשעון, נורה, עיפרון וקשרי רעיונות'],
    ];

    const pageSelector = within(screen.getByRole('navigation', { name: 'דפי Design 15' }));
    for (const [label, pageId, illustration] of pageCases) {
      fireEvent.click(pageSelector.getByRole('button', { name: new RegExp(`${label}$`) }));
      expect(design).toHaveAttribute('data-page', pageId);
      const scene = screen.getByRole('img', { name: illustration });
      expect(scene).toBeInTheDocument();
      expect(scene.querySelectorAll('path').length).toBeGreaterThan(15);
      expect(scene.querySelector('pattern[id$="-paper"]')).toBeInTheDocument();
      expect(scene.querySelector('pattern[id$="-hatch"]')).toBeInTheDocument();
      expect(screen.getByText(label, { selector: '.signature-page-heading strong' })).toBeInTheDocument();
    }

    expect(container.querySelector('.concept-preview')).not.toBeInTheDocument();
  });

  it('shows registration and login forms only on their own Design 15 previews', () => {
    const { container } = render(<DesignPreview />);
    fireEvent.click(screen.getByRole('button', { name: /15 FOCUSMIND SIGNATURE/ }));
    const pageSelector = within(screen.getByRole('navigation', { name: 'דפי Design 15' }));

    fireEvent.click(pageSelector.getByRole('button', { name: /התחברות$/ }));
    expect(screen.getByLabelText('כתובת אימייל')).toHaveAttribute('type', 'email');
    expect(container.querySelector('input[name="password"]')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'הצגת סיסמה' }));
    expect(container.querySelector('input[name="password"]')).toHaveAttribute('type', 'text');

    fireEvent.click(pageSelector.getByRole('button', { name: /הרשמה$/ }));
    expect(screen.getByLabelText('שם מלא')).toBeInTheDocument();
    expect(screen.getByLabelText('כתובת אימייל')).toHaveAttribute('type', 'email');
    expect(container.querySelector('input[name="password"]')).toHaveAttribute('type', 'password');
    expect(container.querySelector('input[name="confirm-password"]')).toHaveAttribute('type', 'password');

    fireEvent.click(pageSelector.getByRole('button', { name: /למידה חכמה$/ }));
    expect(screen.getByRole('region', { name: 'תצוגה מקדימה של אזור הווידאו' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השהיית המפגש' })).toBeInTheDocument();
    expect(screen.getByText('תכונות מצלמה ומיקוד יוצגו כאן')).toBeInTheDocument();
  });
});
