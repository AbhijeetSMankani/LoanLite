import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import authService from '../services/authService';

vi.mock('../services/authService', () => ({
  default: { getCurrentUser: vi.fn(), logout: vi.fn() },
}));

const Consumer = () => {
  const { user, loading, isAuthenticated, userRole, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="role">{userRole || 'none'}</span>
      <span data-testid="name">{user?.name || 'none'}</span>
      <button onClick={() => login({ id: 1, name: 'Logged In User', email: 'a@b.com', role: 'applicant' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthProvider — session rehydration on mount', () => {
  it('starts in a loading state, then hydrates from /auth/me on success', async () => {
    authService.getCurrentUser.mockResolvedValueOnce({ id: 2, name: 'Ada Lovelace', email: 'ada@b.com', role: 'processor' });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('role')).toHaveTextContent('processor');
    expect(JSON.parse(localStorage.getItem('user')).name).toBe('Ada Lovelace');
  });

  it('quietly treats a failed /auth/me (no session / expired token) as logged-out, without throwing', async () => {
    authService.getCurrentUser.mockRejectedValueOnce({ response: { status: 401 } });
    localStorage.setItem('user', JSON.stringify({ id: 99 })); // stale leftover from a prior session

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('AuthProvider — login/logout', () => {
  it('login() sets the user, marks authenticated, and persists to localStorage', async () => {
    authService.getCurrentUser.mockRejectedValueOnce({ response: { status: 401 } });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('name')).toHaveTextContent('Logged In User');
    expect(JSON.parse(localStorage.getItem('user')).email).toBe('a@b.com');
  });

  it('logout() calls the backend no-op, clears user state and localStorage', async () => {
    authService.getCurrentUser.mockResolvedValueOnce({ id: 2, name: 'Ada', email: 'ada@b.com', role: 'applicant' });
    authService.logout.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('logout() still clears local session even if the backend call fails (network failure)', async () => {
    authService.getCurrentUser.mockResolvedValueOnce({ id: 2, name: 'Ada', email: 'ada@b.com', role: 'applicant' });
    authService.logout.mockRejectedValueOnce(new Error('Network Error'));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });
});

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    const BadConsumer = () => {
      useAuth();
      return null;
    };
    // Suppress the expected React error-boundary console noise for this one case.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow('useAuth must be used within AuthProvider');
  });
});
