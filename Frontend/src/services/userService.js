import axiosInstance from '../api/axiosInstance';
import { stripRolePrefix, fullName } from '../utils/role';

const mapUser = (u) => ({
  id: u.id,
  name: fullName(u),
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  role: stripRolePrefix(u.role),
  createdAt: u.createdAt,
});

const paginate = (list, page, limit) => list.slice((page - 1) * limit, page * limit);

const userService = {
  getAllUsers: async (page = 1, limit = 10) => {
    const { data } = await axiosInstance.get('/users');
    return { data: paginate(data.map(mapUser), page, limit) };
  },

  getUserById: async (userId) => {
    const { data } = await axiosInstance.get(`/users/${userId}`);
    return { data: mapUser(data) };
  },

  createUser: async (userData) => {
    const { firstName, lastName } = splitName(userData.name);
    const { data } = await axiosInstance.post('/users', {
      email: userData.email,
      passwordHash: userData.password,
      firstName,
      lastName,
      role: `ROLE_${(userData.role || 'applicant').toUpperCase()}`,
    });
    return { data: mapUser(data) };
  },

  updateUser: async (userId, userData) => {
    const body = {};
    if (userData.email) body.email = userData.email;
    if (userData.password) body.passwordHash = userData.password;
    if (userData.role) body.role = `ROLE_${userData.role.toUpperCase()}`;
    if (userData.name) Object.assign(body, splitName(userData.name));
    const { data } = await axiosInstance.put(`/users/${userId}`, body);
    return { data: mapUser(data) };
  },

  deleteUser: async (userId) => {
    await axiosInstance.delete(`/users/${userId}`);
    return { data: { message: 'User deleted successfully' } };
  },

  getUserByEmail: async (email) => {
    const { data } = await axiosInstance.get('/users');
    const user = data.find((u) => u.email === email);
    if (!user) throw new Error('User not found');
    return { data: mapUser(user) };
  },

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
        approvedLoans: apps.filter((a) => a.status === 'approved').length,
        rejectedLoans: apps.filter((a) => a.status === 'rejected').length,
      },
    };
  },
};

function splitName(name = '') {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

export default userService;
