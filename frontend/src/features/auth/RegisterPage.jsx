import { useState } from 'react';
import './RegisterPage.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/\/+$/, '');

const initialValues = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function validate(values) {
  const errors = {};
  const displayName = values.displayName.trim();
  const email = values.email.trim();

  if (!displayName) {
    errors.displayName = 'יש להזין שם מלא.';
  } else if (displayName.length < 2 || displayName.length > 30) {
    errors.displayName = 'השם צריך להכיל בין 2 ל־30 תווים.';
  }

  if (!email) {
    errors.email = 'יש להזין כתובת אימייל.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'כתובת האימייל אינה תקינה.';
  }

  if (!values.password) {
    errors.password = 'יש להזין סיסמה.';
  } else if (values.password.length < 8) {
    errors.password = 'הסיסמה צריכה להכיל לפחות 8 תווים.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'יש לאשר את הסיסמה.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'הסיסמאות אינן תואמות.';
  }

  return errors;
}

function serverFieldErrors(responseBody) {
  const errors = {};
  const details = Array.isArray(responseBody?.detail) ? responseBody.detail : [];

  for (const detail of details) {
    const field = detail?.loc?.at(-1);
    if (field === 'displayName') {
      errors.displayName = 'השם צריך להכיל בין 2 ל־30 תווים.';
    } else if (field === 'email') {
      errors.email = 'כתובת האימייל אינה תקינה.';
    } else if (field === 'password') {
      errors.password = 'הסיסמה צריכה להכיל לפחות 8 תווים.';
    } else if (field === 'confirmPassword') {
      errors.confirmPassword = 'יש לבדוק את אישור הסיסמה.';
    } else if (field === 'body') {
      errors.confirmPassword = 'הסיסמאות אינן תואמות.';
    }
  }

  return errors;
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.7 15.7 0 01-3 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7a10 10 0 003.2-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordField({
  id,
  label,
  value,
  error,
  visible,
  onChange,
  onToggle,
  autoComplete,
}) {
  const errorId = `${id}-error`;

  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={8}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
          aria-pressed={visible}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  );
}

export default function RegisterPage() {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    setFormError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: values.displayName.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });

      if (response.status === 201) {
        setSuccess(true);
      } else if (response.status === 409) {
        setFormError('כתובת האימייל הזו כבר רשומה. אפשר להתחבר לחשבון שלך.');
      } else if (response.status === 422) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
        setFieldErrors(serverFieldErrors(responseBody));
        setFormError('חלק מהפרטים אינם תקינים. בדקו את השדות ונסו שוב.');
      } else {
        setFormError('לא הצלחנו להשלים את ההרשמה כרגע. נסו שוב בעוד רגע.');
      }
    } catch {
      setFormError('לא ניתן להתחבר לשרת כרגע. בדקו את החיבור ונסו שוב.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl" lang="he">
      <section className="auth-card" aria-labelledby="register-title">
        <header className="auth-header">
          <a className="brand" href="/" aria-label="FocusMind AI - דף הבית">
            <span className="brand-mark" aria-hidden="true">F</span>
            <span>FocusMind<span className="brand-accent"> AI</span></span>
          </a>
          <span className="header-note">המרחב שלך לצמיחה</span>
        </header>

        {success ? (
          <div className="success-panel" role="status">
            <span className="success-icon" aria-hidden="true">✓</span>
            <h1 id="register-title">איזה כיף, נרשמת!</h1>
            <p>החשבון שלך נוצר בהצלחה. אפשר להמשיך ולהתחבר.</p>
            <a className="submit-button success-link" href="/login">מעבר להתחברות</a>
          </div>
        ) : (
          <>
            <div className="intro">
              <span className="eyebrow">צעד קטן, שינוי גדול</span>
              <h1 id="register-title">מתחילים להתמקד</h1>
              <p>יוצרים חשבון ומפנים מקום לדברים החשובים באמת.</p>
            </div>

            <form className="register-form" onSubmit={handleSubmit} noValidate>
              {formError && <p className="form-message" role="alert">{formError}</p>}

              <div className={`form-field${fieldErrors.displayName ? ' form-field--error' : ''}`}>
                <label htmlFor="displayName">שם מלא</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={values.displayName}
                  onChange={updateField}
                  autoComplete="name"
                  minLength={2}
                  maxLength={30}
                  required
                  aria-invalid={Boolean(fieldErrors.displayName)}
                  aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                  placeholder="איך קוראים לך?"
                />
                {fieldErrors.displayName && (
                  <span className="field-error" id="displayName-error">{fieldErrors.displayName}</span>
                )}
              </div>

              <div className={`form-field${fieldErrors.email ? ' form-field--error' : ''}`}>
                <label htmlFor="email">כתובת אימייל</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={updateField}
                  autoComplete="email"
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  placeholder="name@example.com"
                  dir="ltr"
                />
                {fieldErrors.email && (
                  <span className="field-error" id="email-error">{fieldErrors.email}</span>
                )}
              </div>

              <PasswordField
                id="password"
                label="סיסמה"
                value={values.password}
                error={fieldErrors.password}
                visible={passwordVisible}
                onChange={updateField}
                onToggle={() => setPasswordVisible((visible) => !visible)}
                autoComplete="new-password"
              />

              <PasswordField
                id="confirmPassword"
                label="אימות סיסמה"
                value={values.confirmPassword}
                error={fieldErrors.confirmPassword}
                visible={confirmVisible}
                onChange={updateField}
                onToggle={() => setConfirmVisible((visible) => !visible)}
                autoComplete="new-password"
              />

              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    יוצרים את החשבון...
                  </>
                ) : (
                  'יצירת חשבון'
                )}
              </button>
            </form>

            <p className="login-prompt">
              כבר יש לך חשבון? <a href="/login">מתחברים כאן</a>
            </p>
          </>
        )}

        <footer className="auth-footer">
          <span className="footer-dot" aria-hidden="true" />
          הצעדים שלך, בקצב שלך
        </footer>
      </section>

      <aside className="visual-panel" aria-label="השראה יומית">
        <div className="visual-glow visual-glow--one" />
        <div className="visual-glow visual-glow--two" />
        <div className="orbit orbit--outer" />
        <div className="orbit orbit--inner" />
        <div className="focus-orb" aria-hidden="true">
          <span className="orb-ring" />
          <span className="orb-core" />
        </div>
        <div className="visual-copy">
          <span className="visual-kicker">FOCUS · GROW · REPEAT</span>
          <p>כשהראש מתבהר,<br />הדרך נפתחת.</p>
          <span className="visual-caption">התחילו לבנות הרגלים שמרגישים שלכם.</span>
        </div>
        <span className="visual-decoration visual-decoration--top" aria-hidden="true">✳</span>
        <span className="visual-decoration visual-decoration--bottom" aria-hidden="true">✳</span>
      </aside>
    </main>
  );
}
