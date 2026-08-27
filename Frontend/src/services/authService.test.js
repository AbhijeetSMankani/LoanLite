import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axiosInstance';
import authService from './authService';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('authService.login', () => {
  it('stores the returned JWT then fetches /auth/me and returns a normalized user', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { tokenType: 'Bearer', token: 'jwt-token' } });
    axiosInstance.get.mockResolvedValueOnce({
      data: { id: 5, email: 'a@b.com', firstName: 'Ada', lastName: 'Lovelace', role: 'ROLE_USER' },
    });

    const result = await authService.login('a@b.com', 'secret');

    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'secret' });
    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(axiosInstance.get).toHaveBeenCalledWith('/auth/me');
    expect(result.user).toEqual({ id: 5, name: 'Ada Lovelace', email: 'a@b.com', role: 'applicant' });
  });

  it('propagates a bad-credentials failure without storing a token', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Bad credentials' } },
    });

    await expect(authService.login('a@b.com', 'wrong')).rejects.toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('authService.signup', () => {
  it('registers with firstName/lastName (not a split "name" field) then logs in', async () => {
    axiosInstance.post
      .mockResolvedValueOnce({ data: { id: 9 } }) // register response body is unused by signup()
      .mockResolvedValueOnce({ data: { token: 'jwt-token' } }); // login
    axiosInstance.get.mockResolvedValueOnce({
      data: { id: 9, email: 'new@b.com', firstName: 'New', lastName: 'User', role: 'ROLE_USER' },
    });

    const result = await authService.signup({
      firstName: 'New',
      lastName: 'User',
      email: 'new@b.com',
      password: 'password1',
    });

    expect(axiosInstance.post).toHaveBeenNthCalledWith(1, '/auth/register', {
      email: 'new@b.com',
      password: 'password1',
      firstName: 'New',
      lastName: 'User',
    });
    expect(result.user.role).toBe('applicant');
  });

  it('propagates a duplicate-email failure from register without attempting login', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'email already in use' } },
    });

    await expect(
      authService.signup({ firstName: 'A', lastName: 'B', email: 'dupe@b.com', password: 'password1' })
    ).rejects.toBeTruthy();
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });
});

describe('authService.logout', () => {
  it('removes the local token before calling the no-op logout endpoint', async () => {
    localStorage.setItem('token', 'jwt-token');
    axiosInstance.post.mockResolvedValueOnce({});

    await authService.logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/logout');
  });
});

describe('authService.getCurrentUser', () => {
  it('normalizes role and derives a display name from /auth/me', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: { id: 3, email: 'p@b.com', firstName: 'Pat', lastName: 'Processor', role: 'ROLE_PROCESSOR' },
    });

    const me = await authService.getCurrentUser();

    expect(me).toEqual({ id: 3, name: 'Pat Processor', email: 'p@b.com', role: 'processor' });
  });

  it('propagates a 401 when there is no valid session (used by AuthContext to decide "not logged in")', async () => {
    axiosInstance.get.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(authService.getCurrentUser()).rejects.toBeTruthy();
  });
});
