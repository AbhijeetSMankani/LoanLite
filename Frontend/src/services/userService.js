import axiosInstance from '../api/axiosInstance';

// Mock users
const MOCK_USERS = [
  { id: '1', name: 'John Applicant', email: 'applicant@loanl.com', role: 'applicant', createdAt: '2026-07-01' },
  { id: '2', name: 'Jane Processor', email: 'processor@loanl.com', role: 'processor', createdAt: '2026-06-15' },
  { id: '3', name: 'Mike Underwriter', email: 'underwriter@loanl.com', role: 'underwriter', createdAt: '2026-06-15' },
  { id: '4', name: 'Admin User', email: 'admin@loanl.com', role: 'admin', createdAt: '2026-06-01' },
  { id: '5', name: 'Sarah Applicant', email: 'sarah@loanl.com', role: 'applicant', createdAt: '2026-08-05' },
];

// Mock audit logs
const MOCK_AUDIT_LOGS = [
  { id: '1', userId: '1', user: 'John Applicant', action: 'create_application', target: 'Application #123', timestamp: '2026-08-15 10:30', status: 'success' },
  { id: '2', userId: '2', user: 'Jane Processor', action: 'verify_document', target: 'Document #456', timestamp: '2026-08-15 11:15', status: 'success' },
  { id: '3', userId: '3', user: 'Mike Underwriter', action: 'make_decision', target: 'Application #123', timestamp: '2026-08-15 12:00', status: 'success' },
  { id: '4', userId: '4', user: 'Admin User', action: 'create_user', target: 'User #5', timestamp: '2026-08-14 09:00', status: 'success' },
  { id: '5', userId: '1', user: 'John Applicant', action: 'submit_application', target: 'Application #789', timestamp: '2026-08-14 15:45', status: 'success' },
  { id: '6', userId: '2', user: 'Jane Processor', action: 'reject_document', target: 'Document #101', timestamp: '2026-08-14 16:30', status: 'success' },
];

const userService = {
  // Get all users (admin only)
  getAllUsers: async (page = 1, limit = 10) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const paginated = MOCK_USERS.slice((page - 1) * limit, page * limit);
        resolve({ data: paginated });
      }, 300);
    });
  },

  // Get user by ID
  getUserById: async (userId) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.id === userId);
        if (user) {
          resolve({ data: user });
        } else {
          reject(new Error('User not found'));
        }
      }, 300);
    });
  },

  // Create new user (admin only)
  createUser: async (userData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser = {
          id: Date.now().toString(),
          ...userData,
          createdAt: new Date().toISOString().split('T')[0]
        };
        MOCK_USERS.push(newUser);
        resolve({ data: newUser });
      }, 300);
    });
  },

  // Update user
  updateUser: async (userId, userData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.id === userId);
        if (user) {
          Object.assign(user, userData);
        }
        resolve({ data: user });
      }, 300);
    });
  },

  // Delete user (admin only)
  deleteUser: async (userId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = MOCK_USERS.findIndex(u => u.id === userId);
        if (index > -1) {
          MOCK_USERS.splice(index, 1);
        }
        resolve({ data: { message: 'User deleted successfully' } });
      }, 300);
    });
  },

  // Get user by email
  getUserByEmail: async (email) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.email === email);
        if (user) {
          resolve({ data: user });
        } else {
          reject(new Error('User not found'));
        }
      }, 300);
    });
  },

  // Get audit logs (admin only)
  getAuditLogs: async (page = 1, limit = 10) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const paginated = MOCK_AUDIT_LOGS.slice((page - 1) * limit, page * limit);
        resolve({ data: paginated });
      }, 300);
    });
  },

  // Get dashboard stats (admin only)
  getDashboardStats: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: {
            totalUsers: MOCK_USERS.length,
            totalApplications: 47,
            approvedLoans: 28,
            rejectedLoans: 10,
            pendingApplications: 9
          }
        });
      }, 300);
    });
  },
};

export default userService;