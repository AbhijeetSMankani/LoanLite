import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// The backend hands back a JWT in the login response body and expects it on
// every subsequent request as an Authorization header — there's no cookie
// involved, so we attach it ourselves from localStorage.
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 from /auth/me just means "not logged in yet" — AuthContext already
// handles that quietly on mount. Only force a redirect when a call made
// *after* the user was authenticated comes back 401, i.e. their session
// expired mid-use.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSessionCheck = error.config?.url?.includes('/auth/me');
    if (error.response?.status === 401 && !isSessionCheck) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;