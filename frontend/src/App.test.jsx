import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const userInfo = {
  id: 'user-123',
  displayName: 'נועה ישראלי',
  email: 'noa@example.com',
};

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe('App routes and authentication', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('keeps the existing registration page at /register and at the root', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/register');
    const { unmount } = render(<App />);
    expect(screen.getByRole('heading', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
    expect(screen.getByLabelText('שם מלא')).toBeInTheDocument();
    await waitFor(async () => {
      expect(await fetchMock.mock.results[0].value).toMatchObject({ status: 401 });
    });

    unmount();
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await fetchMock.mock.results[1].value).toMatchObject({ status: 401 });
    });
  });

  it('restores a session through /me and shows the personalized dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, userInfo));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'למידה חכמה' })).toHaveAttribute('href', '/learning');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('redirects an unauthenticated dashboard visitor to /login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('protects /learning and redirects unauthenticated visitors to /login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    window.history.pushState({}, '', '/learning');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.queryByRole('heading', { name: 'למידה חכמה' })).not.toBeInTheDocument();
  });

  it('shows Smart Learning for authenticated visitors and provides dashboard navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, userInfo)));
    window.history.pushState({}, '', '/learning');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'למידה חכמה' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'חזרה ללוח הבקרה' })).toHaveAttribute('href', '/dashboard');
  });

  it('redirects an authenticated visitor from /login to /dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, userInfo)));
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('logs out and clears the authenticated route', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, userInfo))
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Logged out successfully.' }))
      .mockResolvedValueOnce(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });
    await user.click(screen.getByRole('button', { name: 'התנתקות' }));

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('redirects to dashboard after successful login', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, userInfo))
      .mockResolvedValueOnce(jsonResponse(200, userInfo));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/login');
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: 'חוזרים לפוקוס' });
    await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });
});
