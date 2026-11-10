import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage.jsx';

function successfulResponse() {
  return {
    status: 201,
    json: async () => ({ message: 'Registration successful.' }),
  };
}

async function fillForm(user) {
  await user.type(screen.getByLabelText('שם מלא'), 'נועה ישראלי');
  await user.type(screen.getByLabelText('כתובת אימייל'), 'noa@example.com');
  await user.type(screen.getByLabelText('סיסמה'), 'Password123!');
  await user.type(screen.getByLabelText('אימות סיסמה'), 'Password123!');
}

describe('RegisterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the normalized registration details and shows success', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    await screen.findByRole('heading', { name: 'איזה כיף, נרשמת!' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'נועה ישראלי',
          email: 'noa@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      }),
    );
    expect(screen.getByRole('link', { name: 'מעבר להתחברות' })).toHaveAttribute('href', '/login');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows field validation and does not submit invalid input', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterPage />);

    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByText('יש להזין שם מלא.')).toBeInTheDocument();
    expect(screen.getByText('יש להזין כתובת אימייל.')).toBeInTheDocument();
    expect(screen.getByText('יש להזין סיסמה.')).toBeInTheDocument();
    expect(screen.getByText('יש לאשר את הסיסמה.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['שם מלא', 'A', 'השם צריך להכיל בין 2 ל־30 תווים.'],
    ['שם מלא', 'A'.repeat(31), 'השם צריך להכיל בין 2 ל־30 תווים.'],
    ['כתובת אימייל', 'invalid-email', 'כתובת האימייל אינה תקינה.'],
    ['סיסמה', 'short', 'הסיסמה צריכה להכיל לפחות 8 תווים.'],
    ['אימות סיסמה', 'a-different-password', 'הסיסמאות אינן תואמות.'],
  ])('validates %s', async (label, invalidValue, expectedError) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('שם מלא'), { target: { value: 'נועה ישראלי' } });
    fireEvent.change(screen.getByLabelText('כתובת אימייל'), { target: { value: 'noa@example.com' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText('אימות סיסמה'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(label), { target: { value: invalidValue } });
    fireEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByText(expectedError)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a friendly message for an already registered email', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 409 }));
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'כתובת האימייל הזו כבר רשומה',
    );
  });

  it('maps server validation errors to Hebrew feedback', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 422,
      json: async () => ({
        detail: [{ loc: ['body', 'email'], msg: 'invalid input', type: 'value_error' }],
      }),
    }));
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByText('חלק מהפרטים אינם תקינים. בדקו את השדות ונסו שוב.')).toBeInTheDocument();
    expect(screen.getByText('כתובת האימייל אינה תקינה.')).toBeInTheDocument();
  });

  it('explains password mismatch returned by the server', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 422,
      json: async () => ({
        detail: [{ loc: ['body'], msg: 'Passwords do not match.', type: 'value_error' }],
      }),
    }));
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByText('הסיסמאות אינן תואמות.')).toBeInTheDocument();
  });

  it('shows a friendly message for network failures and restores the submit button', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network details')));
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'לא ניתן להתחבר לשרת כרגע. בדקו את החיבור ונסו שוב.',
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'יצירת חשבון' })).toBeEnabled();
    });
    expect(screen.queryByText('private network details')).not.toBeInTheDocument();
  });

  it('disables submission while the request is pending', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    expect(screen.getByRole('button', { name: 'יוצרים את החשבון...' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveRequest(successfulResponse());
    await screen.findByRole('heading', { name: 'איזה כיף, נרשמת!' });
  });
});
