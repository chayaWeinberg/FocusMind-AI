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

  it.each(['/__experiments/webgazer', '/__experiments/attention-engine'])(
    'no longer exposes the removed experiment route %s',
    async (path) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
      window.history.pushState({}, '', path);

      render(<App />);

      expect(await screen.findByRole('heading', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
      expect(screen.queryByText(/WebGazer|ניסוי/)).not.toBeInTheDocument();
    },
  );

  it('keeps the existing registration page at /register and at the root', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/register');
    const { unmount } = render(<App />);
    expect(screen.getByRole('heading', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
    expect(screen.getByLabelText('שם מלא')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'עיפרון מצייר שביל מתפתל שהופך לספרים ורעיונות חדשים' })).toBeInTheDocument();
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
    expect(screen.getByRole('img', { name: 'ספרים מצוירים נערמים למדרגות המובילות לרעיון מואר' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'למידה חכמה' })).toHaveAttribute('href', '/learning');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
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

    expect(await screen.findByRole('heading', { name: 'למידה חכמה', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הפעלת מצלמה' })).toBeInTheDocument();
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
    let loggedOut = false;
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/courses/mine') return jsonResponse(200, []);
      if (url === '/api/auth/logout') {
        loggedOut = true;
        return jsonResponse(200, { message: 'Logged out successfully.' });
      }
      return loggedOut ? jsonResponse(401, {}) : jsonResponse(200, userInfo);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });
    await user.click(screen.getByRole('button', { name: 'התנתקות' }));

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
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
    expect(screen.getByRole('img', { name: 'שולחן עבודה שקט עם מחברת פתוחה, עיפרון, ספל וענף קטן' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
    await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'התחברות' }));

    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('sends an authenticated visitor from the registration page to the dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, userInfo)));
    window.history.pushState({}, '', '/register');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('navigates internal links without a full reload or a second session request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, userInfo));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });
    await user.click(screen.getByRole('link', { name: 'למידה חכמה' }));

    expect(await screen.findByRole('heading', { name: 'למידה חכמה', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/learning');
    // One session request only (the dashboard also loads the user's courses).
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(1);

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ })).toBeInTheDocument();
  });

  it('treats a trailing slash on a protected route like the route itself', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    window.history.pushState({}, '', '/dashboard/');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('shows the login page with an error state when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('does not expose the removed Design Gallery route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    window.history.pushState({}, '', '/design-preview');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'מתחילים להתמקד' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'בחירת כיוון עיצובי' })).not.toBeInTheDocument();
  });

  it('hides private pages immediately when the server reports the session ended (401)', async () => {
    let sessionValid = true;
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/courses/mine') return sessionValid ? jsonResponse(200, []) : jsonResponse(401, {});
      return sessionValid ? jsonResponse(200, userInfo) : jsonResponse(401, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });

    // Logged out in another tab / token revoked: the next API answer is 401.
    sessionValid = false;
    window.history.pushState({}, '', '/courses');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByText(/נועה ישראלי/)).not.toBeInTheDocument();
  });

  it('clears the signed-in screen even when the logout request fails', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/courses/mine') return jsonResponse(200, []);
      if (url === '/api/auth/logout') throw new TypeError('offline');
      return jsonResponse(200, userInfo);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });
    await user.click(screen.getByRole('button', { name: 'התנתקות' }));

    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(screen.queryByText(/נועה ישראלי/)).not.toBeInTheDocument();
  });

  it('after Back from the login page following logout, the protected page is not shown', async () => {
    let loggedOut = false;
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/courses/mine') return loggedOut ? jsonResponse(401, {}) : jsonResponse(200, []);
      if (url === '/api/auth/logout') {
        loggedOut = true;
        return jsonResponse(200, { message: 'Logged out successfully.' });
      }
      return loggedOut ? jsonResponse(401, {}) : jsonResponse(200, userInfo);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/dashboard');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /ברוך שובך, נועה ישראלי/ });
    await user.click(screen.getByRole('button', { name: 'התנתקות' }));
    await screen.findByRole('heading', { name: 'חוזרים לפוקוס' });

    // The browser goes back to /dashboard (history entry still exists).
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(screen.queryByRole('heading', { name: /ברוך שובך/ })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'חוזרים לפוקוס' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /ברוך שובך/ })).not.toBeInTheDocument();
  });
});
