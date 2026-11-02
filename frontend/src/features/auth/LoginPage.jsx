import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import './LoginPage.css';

function validate(values) {
  const errors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'יש להזין כתובת אימייל.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'כתובת האימייל אינה תקינה.';
  }

  if (!values.password) {
    errors.password = 'יש להזין סיסמה.';
  }

  return errors;
}

function FocusLogo() {
  return (
    <svg className="login-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 13 21 21M35 13 27 21M13 35l8-8m14 8-8-8" />
      <circle cx="24" cy="24" r="4.25" />
    </svg>
  );
}

export default function LoginPage({ onAuthenticated }) {
  const { login } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    const errors = validate(values);
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const result = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (result.status === 200 && result.user) {
        onAuthenticated();
      } else if (result.status === 401) {
        setFormError('כתובת האימייל או הסיסמה אינם נכונים. נסו שוב.');
      } else if (result.status === 422) {
        setFormError('פרטי ההתחברות אינם תקינים. בדקו את השדות ונסו שוב.');
      } else {
        setFormError('לא הצלחנו להתחבר כרגע. נסו שוב בעוד רגע.');
      }
    } catch {
      setFormError('לא ניתן להתחבר לשרת כרגע. בדקו את החיבור ונסו שוב.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page" dir="rtl" lang="he">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-header">
          <a className="login-brand" href="/" aria-label="FocusMind AI - דף הבית">
            <FocusLogo />
            <span>FocusMind<span> AI</span></span>
          </a>
          <span className="login-header-note">המרחב שלך לצמיחה</span>
        </header>

        <div className="login-intro">
          <span className="login-eyebrow">טוב שחזרת</span>
          <h1 id="login-title">חוזרים לפוקוס</h1>
          <p>התחברו כדי להמשיך להתקדם, צעד אחד בכל פעם.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {formError && <p className="login-form-error" role="alert">{formError}</p>}

          <div className={`login-field${fieldErrors.email ? ' login-field--error' : ''}`}>
            <label htmlFor="login-email">כתובת אימייל</label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={values.email}
              onChange={updateField}
              autoComplete="email"
              autoCapitalize="none"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              placeholder="name@example.com"
              dir="ltr"
            />
            {fieldErrors.email && (
              <span className="login-field-error" id="login-email-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className={`login-field${fieldErrors.password ? ' login-field--error' : ''}`}>
            <label htmlFor="login-password">סיסמה</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                value={values.password}
                onChange={updateField}
                autoComplete="current-password"
                required
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? 'הסתרה' : 'הצגה'}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="login-field-error" id="login-password-error">{fieldErrors.password}</span>
            )}
          </div>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                מתחברים...
              </>
            ) : 'התחברות'}
          </button>
        </form>

        <p className="login-register-prompt">
          עדיין אין לך חשבון? <a href="/register">יוצרים חשבון חדש</a>
        </p>

        <footer className="login-footer">
          <span aria-hidden="true" />
          המחשבות שלך. המרחב שלך. הדרך שלך.
        </footer>
      </section>

      <aside className="login-visual" aria-label="השראה יומית">
        <div className="login-visual-orbit login-visual-orbit--outer" />
        <div className="login-visual-orbit login-visual-orbit--inner" />
        <div className="login-focus-orb" aria-hidden="true"><span /></div>
        <div className="login-visual-copy">
          <span>YOUR MIND. YOUR SPACE. YOUR WAY.</span>
          <p>ראש שקט.<br />מטרות גדולות.</p>
          <small>כל התחלה טובה מתחילה ברגע של פוקוס.</small>
        </div>
        <span className="login-decoration login-decoration--one" aria-hidden="true">✦</span>
        <span className="login-decoration login-decoration--two" aria-hidden="true">✧</span>
      </aside>
    </main>
  );
}
