import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';

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
    <main className="signature-production" dir="rtl" lang="he">
      <section className="signature-page signature-auth-page signature-auth-page--login" aria-labelledby="login-title">
        <div className="signature-auth-card">
          <aside className="signature-auth-art" aria-label="איור של שולחן לימוד">
            <FocusIllustration type="login" />
            <div className="signature-auth-art-note">
              <span aria-hidden="true">✧</span>
              <strong>כל התחלה טובה<br />מתחילה ברגע של שקט.</strong>
            </div>
          </aside>
          <section className="signature-auth-form">
            <SignatureBrand href="/" />
            <div className="signature-page-title">
              <small>טוב שחזרת</small>
              <h1 id="login-title">חוזרים לפוקוס</h1>
              <p>התחברו כדי להמשיך להתקדם, צעד אחד בכל פעם.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {formError && <p role="alert">{formError}</p>}
              <div className="form-field">
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
                  <span className="signature-form-error" id="login-email-error">{fieldErrors.email}</span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="login-password">סיסמה</label>
                <span className="signature-password-wrap">
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
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
                    aria-pressed={passwordVisible}
                  >
                    {passwordVisible ? 'הסתרה' : 'הצגה'}
                  </button>
                </span>
                {fieldErrors.password && (
                  <span className="signature-form-error" id="login-password-error">{fieldErrors.password}</span>
                )}
              </div>

              <div className="signature-form-hint">יש להזין כתובת אימייל וסיסמה כדי להמשיך.</div>
              <button className="signature-primary-button signature-auth-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="signature-loading-spinner" aria-hidden="true" />
                    מתחברים...
                  </>
                ) : 'התחברות'}
              </button>
            </form>

            <p className="signature-auth-switch">
              עדיין אין לך חשבון? <a href="/register">יוצרים חשבון חדש</a>
            </p>
            <p className="signature-auth-footnote">המחשבות שלך. המרחב שלך. הדרך שלך.</p>
          </section>
        </div>
      </section>
    </main>
  );
}
