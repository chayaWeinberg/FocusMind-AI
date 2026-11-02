const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/\/+$/, '');

async function request(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
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
  };
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
