import axiosInstance from '../api/axiosInstance';
import { fullName } from '../utils/role';

const paginate = (list, page, limit) => list.slice((page - 1) * limit, page * limit);

const userService = {
  getAuditLogs: async (page = 1, limit = 20) => {
    const { data } = await axiosInstance.get('/application-history');
    const logs = data
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((h) => ({
        id: h.id,
        user: h.user ? fullName(h.user) : 'System',
        action: h.action,
        target: h.application ? `Application #${h.application.id}` : (h.details || '—'),
        timestamp: h.createdAt,
        status: 'success',
      }));
    return { data: paginate(logs, page, limit) };
  },

  getDashboardStats: async () => {
    const [usersRes, appsRes] = await Promise.all([
      axiosInstance.get('/users'),
      axiosInstance.get('/loan-applications'),
    ]);
    const apps = appsRes.data;
    return {
      data: {
        totalUsers: usersRes.data.length,
        totalApplications: apps.length,
        approvedLoans: apps.filter((a) => a.status?.toLowerCase() === 'accepted').length,
        rejectedLoans: apps.filter((a) => a.status?.toLowerCase() === 'rejected').length,
      },
    };
  },
};

export default userService;
