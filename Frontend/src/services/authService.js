import axiosInstance from '../api/axiosInstance';

// Mock Users Database (for development/testing without backend)
const MOCK_USERS = {
  'applicant@loanl.com': {
    id: '1',
    name: 'John Applicant',
    email: 'applicant@loanl.com',
    role: 'applicant',
    password: 'password123'
  },
  'processor@loanl.com': {
    id: '2',
    name: 'Jane Processor',
    email: 'processor@loanl.com',
    role: 'processor',
    password: 'password123'
  },
  'underwriter@loanl.com': {
    id: '3',
    name: 'Mike Underwriter',
    email: 'underwriter@loanl.com',
    role: 'underwriter',
    password: 'password123'
  },
  'admin@loanl.com': {
    id: '4',
    name: 'Admin User',
    email: 'admin@loanl.com',
    role: 'admin',
    password: 'password123'
  },
  'user@example.com': {
    id: '1',
    name: 'John Applicant',
    email: 'user@example.com',
    role: 'applicant',
    password: 'password123'
  }
};

// Generate mock JWT token
const generateMockToken = (user) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  }));
  const signature = btoa('mock_signature');
  return `${header}.${payload}.${signature}`;
};

const authService = {
  login: async (email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_USERS[email];
        
        if (!user) {
          reject(new Error('User not found. Try: applicant@loanl.com, processor@loanl.com, underwriter@loanl.com, or admin@loanl.com'));
          return;
        }
        
        if (user.password !== password) {
          reject(new Error('Invalid password. Use: password123'));
          return;
        }
        
        const token = generateMockToken(user);
        const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
        
        resolve({
          token,
          user: userData
        });
      }, 500);
    });
  },

  signup: async (userData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const token = generateMockToken({ ...userData, id: Date.now().toString() });
        resolve({ token, user: userData });
      }, 500);
    });
  },

  logout: async () => {
    return Promise.resolve();
  },

  verifyToken: async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    return Promise.resolve({ valid: true });
  },

  getCurrentUser: async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('No user found');
    return Promise.resolve(JSON.parse(userStr));
  },
};

export default authService;