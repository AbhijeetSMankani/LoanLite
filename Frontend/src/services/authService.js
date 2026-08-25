import axiosInstance from '../api/axiosInstance';
import { fullName, stripRolePrefix } from '../utils/role';

const authService = {
  login: async (email, password) => {
    // /auth/login returns the JWT in the response body — store it so the
    // axiosInstance request interceptor can attach it as a Bearer header
    // on the /auth/me call right after (and everything else afterward).
    const { data } = await axiosInstance.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);

    const { data: me } = await axiosInstance.get('/auth/me');

    return {
      user: { id: me.id, name: fullName(me), email: me.email, role: stripRolePrefix(me.role) },
    };
  },

  signup: async (userData) => {
    await axiosInstance.post('/auth/register', {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
    });

    // register() only creates the account — log the new user in immediately
    // so the app has a session right away.
    return authService.login(userData.email, userData.password);
  },

  logout: async () => {
    localStorage.removeItem('token');
    await axiosInstance.post('/auth/logout');
  },

  verifyToken: async () => {
    await axiosInstance.get('/auth/me');
    return { valid: true };
  },

  getCurrentUser: async () => {
    const { data: me } = await axiosInstance.get('/auth/me');
    return { id: me.id, name: fullName(me), email: me.email, role: stripRolePrefix(me.role) };
  },
};

export default authService;
