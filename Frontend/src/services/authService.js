import axiosInstance from '../api/axiosInstance';
import { fullName } from '../utils/role';

const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
};

const authService = {
  login: async (email, password) => {
    const { data } = await axiosInstance.post('/auth/login', { email, password });
    const u = data.user;
    return {
      token: data.token,
      user: u
        ? { id: u.id, name: fullName(u), email: u.email, role: u.role }
        : { email, role: 'applicant' },
    };
  },

  signup: async (userData) => {
    const { firstName, lastName } = splitName(userData.name);
    const { data } = await axiosInstance.post('/auth/register', {
      email: userData.email,
      password: userData.password,
      firstName,
      lastName,
      role: userData.role,
    });

    // register() returns the created user, not a token — log the new user in
    // immediately via /auth/login so the app has a session right away.
    const loginResult = await authService.login(userData.email, userData.password);
    return loginResult;
  },

  logout: async () => {
    return Promise.resolve();
  },

  verifyToken: async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    return { valid: true };
  },

  getCurrentUser: async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('No user found');
    return JSON.parse(userStr);
  },
};

export default authService;
