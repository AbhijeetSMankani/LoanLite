import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Loader from '../../components/Loader';
import authService from '../../services/authService';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.login(formData.email, formData.password);
      login(response.user, response.token);
      
      // Redirect based on role
      const roleRoutes = {
        applicant: '/applicant/dashboard',
        processor: '/processor/dashboard',
        underwriter: '/underwriter/dashboard',
        admin: '/admin/dashboard',
      };
      
      navigate(roleRoutes[response.user.role] || '/login');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen message="Logging in..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-600 mb-2">LoanLite</h1>
          <p className="text-gray-600">Personal Loan Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-6">
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              disabled={loading}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full mt-6"
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p className="mb-4">Demo Credentials:</p>
          <p className="text-gray-500 text-xs mb-4">
            Email: user@example.com<br />
            Password: password123
          </p>
          
          <div className="border-t pt-4">
            <p>
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-orange-600 font-semibold hover:text-orange-700 no-underline"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;