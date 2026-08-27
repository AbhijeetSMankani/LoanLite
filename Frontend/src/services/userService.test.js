import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axiosInstance';
import userService from './userService';
import { mockPage } from '../test/test-utils';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuditLogs', () => {
  it('maps applicationId (not the stripped "application" field) into the target column', async () => {
    const history = [
      { id: 1, user: { firstName: 'A', lastName: 'B' }, action: 'SUBMITTED', applicationId: 7, createdAt: '2026-08-01T00:00:00' },
      { id: 2, user: null, action: 'PROCESSOR_CLAIMED', applicationId: null, details: 'system note', createdAt: '2026-08-02T00:00:00' },
    ];
    axiosInstance.get.mockResolvedValueOnce({ data: mockPage(history, { totalPages: 2 }) });

    const result = await userService.getAuditLogs(1, 20);

    expect(axiosInstance.get).toHaveBeenCalledWith('/application-history', {
      params: { page: 0, size: 20, sort: 'createdAt,desc' },
    });
    expect(result.data[0]).toMatchObject({ user: 'A B', target: 'Application #7' });
    expect(result.data[1]).toMatchObject({ user: 'System', target: 'system note' });
    expect(result.totalPages).toBe(2);
  });

  it('falls back to an em dash when neither applicationId nor details is present', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: mockPage([{ id: 1, action: 'X', applicationId: null, details: null, createdAt: '2026-01-01T00:00:00' }]),
    });

    const result = await userService.getAuditLogs();

    expect(result.data[0].target).toBe('—');
  });
});

describe('getDashboardStats', () => {
  it('combines /users totalElements with /admin/stats byStatus counts', async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: { totalElements: 42 } });
      if (url === '/admin/stats') {
        return Promise.resolve({
          data: { totalApplications: 100, byStatus: { Accepted: 30, Rejected: 10, Draft: 5 } },
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const { data } = await userService.getDashboardStats();

    expect(data).toEqual({ totalUsers: 42, totalApplications: 100, approvedLoans: 30, rejectedLoans: 10 });
  });

  it('defaults counts to 0 when byStatus is missing entries', async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { totalApplications: 0, byStatus: {} } });
    });

    const { data } = await userService.getDashboardStats();

    expect(data).toEqual({ totalUsers: 0, totalApplications: 0, approvedLoans: 0, rejectedLoans: 0 });
  });
});

describe('getAllUsers', () => {
  it('unwraps the Page<User> envelope', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: mockPage([{ id: 1, role: 'ROLE_USER' }], { totalPages: 5 }),
    });

    const result = await userService.getAllUsers(2, 20);

    expect(axiosInstance.get).toHaveBeenCalledWith('/users', { params: { page: 1, size: 20, sort: 'id,asc' } });
    expect(result.data).toEqual([{ id: 1, role: 'ROLE_USER' }]);
    expect(result.totalPages).toBe(5);
  });
});

describe('updateUserRole', () => {
  it('PATCHes the dedicated admin role-assignment endpoint', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 3, role: 'ROLE_PROCESSOR' } });

    const { data } = await userService.updateUserRole(3, 'ROLE_PROCESSOR');

    expect(axiosInstance.patch).toHaveBeenCalledWith('/admin/users/3/role', { role: 'ROLE_PROCESSOR' });
    expect(data.role).toBe('ROLE_PROCESSOR');
  });

  it('propagates a 400 when the admin tries to change their own role', async () => {
    axiosInstance.patch.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'You cannot change your own role' } },
    });

    await expect(userService.updateUserRole(1, 'ROLE_ADMIN')).rejects.toBeTruthy();
  });
});
