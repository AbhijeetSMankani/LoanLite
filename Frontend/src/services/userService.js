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

  // Read counts off Page<T>'s totalElements instead of fetching every row —
  // a status-filtered query with size:1 gets the count without pulling
  // unbounded data (there's no server-side max page size).
  getDashboardStats: async () => {
    const [usersRes, totalRes, approvedRes, rejectedRes] = await Promise.all([
      axiosInstance.get('/users', { params: { size: 1 } }),
      axiosInstance.get('/loan-applications', { params: { size: 1 } }),
      axiosInstance.get('/loan-applications', { params: { status: 'Accepted', size: 1 } }),
      axiosInstance.get('/loan-applications', { params: { status: 'Rejected', size: 1 } }),
    ]);
    return {
      data: {
        totalUsers: usersRes.data.totalElements ?? 0,
        totalApplications: totalRes.data.totalElements ?? 0,
        approvedLoans: approvedRes.data.totalElements ?? 0,
        rejectedLoans: rejectedRes.data.totalElements ?? 0,
      },
    };
  },
};

export default userService;
