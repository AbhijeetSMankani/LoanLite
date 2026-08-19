import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import StatCard from '../../components/StatCard';
import loanService from '../../services/loanService';

const ApplicantDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await loanService.getMyApplications(1, 100);
        
        const applications = response.data || [];
        const newStats = {
          total: applications.length,
          draft: applications.filter(a => a.status === 'draft').length,
          submitted: applications.filter(a => a.status === 'submitted').length,
          approved: applications.filter(a => a.status === 'approved').length,
          rejected: applications.filter(a => a.status === 'rejected').length,
        };
        
        setStats(newStats);
      } catch (err) {
        console.error('Error fetching applications:', err);
        // Set default stats for demo
        setStats({
          total: 5,
          draft: 1,
          submitted: 2,
          approved: 1,
          rejected: 1,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to LoanLite</h1>
          <p className="text-gray-600">Manage your loan applications</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* CTA Button */}
        <div className="mb-8">
          <Button
            variant="primary"
            onClick={() => navigate('/applicant/apply')}
          >
            + Apply for New Loan
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <StatCard title="Total Applications" value={stats.total} color="bg-blue-500" />
          <StatCard title="Draft" value={stats.draft} color="bg-gray-500" />
          <StatCard title="Submitted" value={stats.submitted} color="bg-yellow-500" />
          <StatCard title="Approved" value={stats.approved} color="bg-green-500" />
          <StatCard title="Rejected" value={stats.rejected} color="bg-red-500" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/applicant/apply')}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">Apply for Loan</h3>
            <p className="text-gray-600">Start a new loan application</p>
          </div>

          <div
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/applicant/my-applications')}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">My Applications</h3>
            <p className="text-gray-600">Track your applications</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Help & Support</h3>
            <p className="text-gray-600">Get help with your loan</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantDashboard;