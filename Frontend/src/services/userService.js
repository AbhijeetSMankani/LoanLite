import axiosInstance from '../api/axiosInstance';
import { fullName } from '../utils/role';

const userService = {
  // GET /application-history now returns Spring's Page<T> envelope, and the
  // entry's parent application is exposed as `applicationId` (`application`
  // itself is stripped from every response to avoid a Jackson back-reference
  // cycle) — read that instead of the never-populated `application` field.
  getAuditLogs: async (page = 1, limit = 20) => {
    const { data } = await axiosInstance.get('/application-history', {
      params: { page: page - 1, size: limit, sort: 'createdAt,desc' },
    });
    const logs = (data.content || []).map((h) => ({
      id: h.id,
      user: h.user ? fullName(h.user) : 'System',
      action: h.action,
      target: h.applicationId ? `Application #${h.applicationId}` : h.details || '—',
      timestamp: h.createdAt,
      status: 'success',
    }));
    return { data: logs, totalPages: data.totalPages, totalElements: data.totalElements };
  },

  // GET /admin/stats gives grouped counts straight from the DB (COUNT/GROUP
  // BY, not fetch-and-count) — totalUsers still needs a separate call since
  // that endpoint only covers applications.
  getDashboardStats: async () => {
    const [usersRes, statsRes] = await Promise.all([
      axiosInstance.get('/users', { params: { size: 1 } }),
      axiosInstance.get('/admin/stats'),
    ]);
    const byStatus = statsRes.data.byStatus || {};
    return {
      data: {
        totalUsers: usersRes.data.totalElements ?? 0,
        totalApplications: statsRes.data.totalApplications ?? 0,
        approvedLoans: byStatus.Accepted ?? 0,
        rejectedLoans: byStatus.Rejected ?? 0,
      },
    };
  },

  // GET /users (ROLE_ADMIN only) — Page<User> envelope, unwrap to a plain
  // array of { id, email, firstName, lastName, role, ... } (role is the raw
  // "ROLE_X" backend value here, not the stripped/lowercased one AuthContext
  // uses for the logged-in user).
  getAllUsers: async (page = 1, limit = 20) => {
    const { data } = await axiosInstance.get('/users', {
      params: { page: page - 1, size: limit, sort: 'id,asc' },
    });
    return { data: data.content || [], totalPages: data.totalPages, totalElements: data.totalElements };
  },

  // PATCH /admin/users/{id}/role — the dedicated, minimal role-assignment
  // action. Backend rejects an admin changing their own role (400).
  updateUserRole: async (userId, role) => {
    const { data } = await axiosInstance.patch(`/admin/users/${userId}/role`, { role });
    return { data };
  },
};

export default userService;
