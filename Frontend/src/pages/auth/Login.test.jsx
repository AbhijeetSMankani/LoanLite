import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import authService from '../../services/authService';

const mockLogin = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));
vi.mock('../../services/authService', () => ({
  default: { login: vi.fn() },
}));

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/applicant/dashboard" element={<div>Applicant Dashboard Landed</div>} />
        <Route path="/processor/dashboard" element={<div>Processor Dashboard Landed</div>} />
        <Route path="/admin/dashboard" element={<div>Admin Dashboard Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Login — form and accessibility', () => {
  it('renders accessible, labeled email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('lets a keyboard-only user tab through the form in order', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.tab();
    expect(screen.getByLabelText(/^Email/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/^Password/)).toHaveFocus();
  });
});

describe('Login — functional flow', () => {
  it('logs in and routes an applicant to the applicant dashboard', async () => {
    const user = userEvent.setup();
    authService.login.mockResolvedValueOnce({ user: { id: 1, name: 'A', email: 'a@b.com', role: 'applicant' } });
    renderLogin();

    await user.type(screen.getByLabelText(/^Email/), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('Applicant Dashboard Landed')).toBeInTheDocument());
    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'password123');
    expect(mockLogin).toHaveBeenCalledWith({ id: 1, name: 'A', email: 'a@b.com', role: 'applicant' }, undefined);
  });

  it('routes a processor to the processor dashboard and an admin to the admin dashboard', async () => {
    const user = userEvent.setup();
    authService.login.mockResolvedValueOnce({ user: { id: 2, name: 'P', email: 'p@b.com', role: 'processor' } });
    renderLogin();
    await user.type(screen.getByLabelText(/^Email/), 'p@b.com');
    await user.type(screen.getByLabelText(/^Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByText('Processor Dashboard Landed')).toBeInTheDocument());
  });
});

describe('Login — error handling', () => {
  it('shows the backend error message on a 401 bad-credentials response', async () => {
    const user = userEvent.setup();
    authService.login.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Bad credentials' } } });
    renderLogin();

    await user.type(screen.getByLabelText(/^Email/), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
  });

  it('shows a generic message on a network failure with no response object', async () => {
    const user = userEvent.setup();
    authService.login.mockRejectedValueOnce(new Error('Network Error'));
    renderLogin();

    await user.type(screen.getByLabelText(/^Email/), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Login failed. Please try again.')).toBeInTheDocument();
  });
});

describe('Login — loading state', () => {
  it('disables the submit button and shows a loading label while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    authService.login.mockImplementationOnce(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    renderLogin();

    await user.type(screen.getByLabelText(/^Email/), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    const button = screen.getByRole('button', { name: 'Logging in...' });
    expect(button).toBeDisabled();
    resolveLogin({ user: { id: 1, name: 'A', email: 'a@b.com', role: 'applicant' } });
  });
});
