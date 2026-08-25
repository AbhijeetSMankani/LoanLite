import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import authService from '../../services/authService';
import { Landmark } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError('All fields are required');
      return;
    }

    // Backend enforces password length >= 8 (RegisterRequest's @Size(min = 8)) —
    // keep this in sync so the frontend doesn't accept something the server rejects.
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      });

      login(response.user, response.token);

      // Signup always creates an applicant — only an Admin can promote
      // someone to processor/underwriter/admin afterwards.
      navigate('/applicant/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-primary-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 w-full max-w-md border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white mb-4">
            <Landmark size={28} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">LoanLite</h1>
          <p className="text-gray-500 text-sm">Create your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input
              label="First Name"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First name"
              required
              disabled={loading}
            />

            <Input
              label="Last Name"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last name"
              required
              disabled={loading}
            />
          </div>

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
            placeholder="Enter password (min 8 characters)"
            required
            disabled={loading}
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm your password"
            required
            disabled={loading}
          />

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700 no-underline">
              Login here
            </Link>
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-800">
          <p className="font-semibold mb-1">New accounts sign up as Applicants</p>
          <p>An Admin assigns Processor, Underwriter, or Admin access afterwards.</p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
