import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Signup from './Signup';
import authService from '../../services/authService';

const mockLogin = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));
vi.mock('../../services/authService', () => ({
  default: { signup: vi.fn() },
}));

const renderSignup = () =>
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/applicant/dashboard" element={<div>Applicant Dashboard Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

const fillValidForm = async (user, overrides = {}) => {
  const values = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    ...overrides,
  };
  if (values.firstName) await user.type(screen.getByLabelText(/^First Name/), values.firstName);
  if (values.lastName) await user.type(screen.getByLabelText(/^Last Name/), values.lastName);
  if (values.email) await user.type(screen.getByLabelText(/^Email/), values.email);
  if (values.password) await user.type(screen.getByLabelText(/^Password/), values.password);
  if (values.confirmPassword) await user.type(screen.getByLabelText(/^Confirm Password/), values.confirmPassword);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Signup — form fields', () => {
  it('renders separate, labeled First Name and Last Name fields', () => {
    renderSignup();
    expect(screen.getByLabelText(/^First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Last Name/)).toBeInTheDocument();
  });
});

describe('Signup — validation', () => {
  it('rejects submission when any required field is missing', async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('All fields are required')).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters (matches backend @Size(min = 8))', async () => {
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user, { password: 'short1', confirmPassword: 'short1' });

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('accepts an 8-character password', async () => {
    const user = userEvent.setup();
    authService.signup.mockResolvedValueOnce({ user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'applicant' } });
    renderSignup();
    await fillValidForm(user, { password: '12345678', confirmPassword: '12345678' });

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(authService.signup).toHaveBeenCalled());
  });

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user, { confirmPassword: 'different123' });

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });
});

describe('Signup — functional flow', () => {
  it('signs up with firstName/lastName, logs in, and always routes to the applicant dashboard', async () => {
    const user = userEvent.setup();
    authService.signup.mockResolvedValueOnce({
      user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'applicant' },
    });
    renderSignup();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(authService.signup).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'password123',
    });
    await waitFor(() => expect(screen.getByText('Applicant Dashboard Landed')).toBeInTheDocument());
  });

  it('shows the backend duplicate-email error', async () => {
    const user = userEvent.setup();
    authService.signup.mockRejectedValueOnce({ response: { status: 400, data: { message: 'email already in use' } } });
    renderSignup();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('email already in use')).toBeInTheDocument();
  });
});
