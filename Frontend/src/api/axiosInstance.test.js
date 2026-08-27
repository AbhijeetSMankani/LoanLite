import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import axiosInstance from './axiosInstance';

// axiosInstance.js calls axios.create(...) once at module load and registers
// its request/response interceptors on the returned instance — mocking
// axios.create lets us grab those interceptor functions directly and drive
// them with hand-built config/error objects instead of firing real requests.
vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return { default: { create: vi.fn(() => instance) } };
});

const requestFulfilled = axios.create.mock.results[0].value.interceptors.request.use.mock.calls[0][0];
const [responseFulfilled, responseRejected] = axios.create.mock.results[0].value.interceptors.response.use.mock.calls[0];

describe('axiosInstance module', () => {
  it('is the exact instance returned by axios.create (confirms the mock wiring above)', () => {
    expect(axiosInstance).toBe(axios.create.mock.results[0].value);
  });
});

describe('axiosInstance request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches a Bearer Authorization header when a token is stored', () => {
    localStorage.setItem('token', 'abc123');
    const config = requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
  });

  it('leaves headers untouched when there is no stored token', () => {
    const config = requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('axiosInstance response interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    localStorage.setItem('token', 'abc123');
    delete window.location;
    window.location = { href: '/applicant/dashboard' };
  });

  it('passes successful responses through unchanged', () => {
    const response = { status: 200, data: { ok: true } };
    expect(responseFulfilled(response)).toBe(response);
  });

  it('clears the session and redirects to /login on a 401 outside of /auth/me', async () => {
    const error = { config: { url: '/api/applications' }, response: { status: 401 } };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('does not redirect on a 401 from /auth/me (used for the quiet initial "am I logged in" check)', async () => {
    const error = { config: { url: '/auth/me' }, response: { status: 401 } };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(window.location.href).toBe('/applicant/dashboard');
  });

  it.each([403, 404, 500])('leaves the session alone on a %s (only 401 triggers logout)', async (status) => {
    const error = { config: { url: '/api/applications/1' }, response: { status } };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(window.location.href).toBe('/applicant/dashboard');
  });

  it('rejects with the original error when there is no response at all (network failure)', async () => {
    const error = { config: { url: '/api/applications' }, message: 'Network Error' };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem('user')).not.toBeNull();
  });
});
