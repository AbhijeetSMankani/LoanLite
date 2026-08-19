import axiosInstance from '../api/axiosInstance';

const userService = {
  // Get all users (admin only)
  getAllUsers: async (page = 1, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/users?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const response = await axiosInstance.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create new user (admin only)
  createUser: async (userData) => {
    try {
      const response = await axiosInstance.post('/users', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update user
  updateUser: async (userId, userData) => {
    try {
      const response = await axiosInstance.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete user (admin only)
  deleteUser: async (userId) => {
    try {
      const response = await axiosInstance.delete(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get user by email
  getUserByEmail: async (email) => {
    try {
      const response = await axiosInstance.get(`/users/email/${email}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get audit logs (admin only)
  getAuditLogs: async (page = 1, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/users/audit-logs?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get dashboard stats (admin only)
  getDashboardStats: async () => {
    try {
      const response = await axiosInstance.get('/users/admin/dashboard-stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export default userService;