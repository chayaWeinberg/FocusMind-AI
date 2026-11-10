import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthProvider from './AuthContext.jsx';
import LoginPage from './LoginPage.jsx';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

function renderLogin(onAuthenticated = vi.fn()) {
  return render(
    <AuthProvider>
      <LoginPage onAuthenticated={onAuthenticated} />
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders accessible email and password fields and a registration link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    renderLogin();

    expect(screen.getByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(screen.getByLabelText('כתובת אימייל')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'הצגת סיסמה' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'יוצרים חשבון חדש' })).toHaveAttribute('href', '/register');
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
  });

  it('validates required and malformed input without submitting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    expect(await screen.findByText('יש להזין כתובת אימייל.')).toBeInTheDocument();
    expect(screen.getByText('יש להזין סיסמה.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    );

    await user.type(screen.getByLabelText('כתובת אימייל'), 'bad-email');
    await user.type(screen.getByLabelText('סיסמה'), 'password');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));
    expect(await screen.findByText('כתובת האימייל אינה תקינה.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('submits normalized credentials with cookies and handles successful login', async () => {
    const userInfo = {
      id: 'user-1',
      displayName: 'נועה',
      email: 'noa@example.com',
      hashed_password: 'must-not-be-kept',
      token: 'must-not-be-kept',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, userInfo));
    vi.stubGlobal('fetch', fetchMock);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    renderLogin(onAuthenticated);

    await user.type(screen.getByLabelText('כתובת אימייל'), ' NOA@EXAMPLE.COM ');
    await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(await screen.findByRole('button', { name: 'התחברות' })).toBeEnabled();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'noa@example.com', password: 'Password123!' }),
      }),
    );
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows a generic message for incorrect credentials', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Incorrect email or password.' })));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'כתובת האימייל או הסיסמה אינם נכונים.',
    );
  });

  it('shows a loading state and prevents duplicate submissions', async () => {
    let resolveLogin;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLogin = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(screen.getByRole('button', { name: 'מתחברים...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'מתחברים...' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveLogin(jsonResponse(401, {}));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('shows a friendly message for network failures without exposing details', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockRejectedValueOnce(new Error('private network detail')));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן להתחבר לשרת כרגע.');
    expect(screen.queryByText('private network detail')).not.toBeInTheDocument();
  });

  it('toggles password visibility accessibly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'הצגת סיסמה' }));
    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'הסתרת סיסמה' })).toHaveAttribute('aria-pressed', 'true');
  });
});
