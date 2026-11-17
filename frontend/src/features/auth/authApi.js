// All authentication requests go through this module.
//
// By default requests are same-origin (`/api/...`): Vite proxies them to the
// backend in development (see vite.config.js), so the session cookie stays
// first-party. VITE_API_URL can still point at a separate API origin.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const REQUEST_TIMEOUT_MS = 15000;
// Dispatched on window when any API call answers 401: the server no longer
// accepts this session (logged out elsewhere, expired or revoked).
export const SESSION_ENDED_EVENT = 'focusmind:session-ended';

export class ApiNetworkError extends Error {
  constructor(message = 'The server could not be reached.') {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    // Network failure, CORS rejection or timeout — callers show a generic message.
    throw new ApiNetworkError();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toSafeUser(value) {
  if (
    !value
    || typeof value.id !== 'string'
    || typeof value.displayName !== 'string'
    || typeof value.email !== 'string'
  ) {
    throw new Error('Invalid user response.');
  }

  return {
    id: value.id,
    displayName: value.displayName,
    email: value.email,
    // Only the server grants this role (from the command line); it only shows
    // the catalog tools, the API enforces the permission itself.
    role: value.role === 'content_manager' ? 'content_manager' : 'learner',
  };
}

export async function registerRequest(registration) {
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(registration),
  });

  if (response.status === 201) {
    const body = await readJson(response);
    return { status: response.status, user: body?.user ? toSafeUser(body.user) : null };
  }
  if (response.status === 422) {
    return { status: response.status, body: await readJson(response) };
  }
  return { status: response.status };
}

export async function loginRequest(credentials) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    return { status: response.status };
  }

  return { status: response.status, user: toSafeUser(await response.json()) };
}

export async function currentUserRequest() {
  const response = await request('/api/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Unable to restore the current session.');
  return toSafeUser(await response.json());
}

export async function logoutRequest() {
  const response = await request('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('Unable to end the current session.');
}
