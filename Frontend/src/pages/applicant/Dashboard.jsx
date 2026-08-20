import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import loanService from '../../services/loanService';
import { FilePlus2, FileText, LifeBuoy, ArrowRight } from 'lucide-react';

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
        setStats({
          total: applications.length,
          draft: applications.filter((a) => a.status === 'draft').length,
          submitted: applications.filter((a) => a.status === 'submitted').length,
          approved: applications.filter((a) => a.status === 'approved').length,
          rejected: applications.filter((a) => a.status === 'rejected').length,
        });
      } catch (err) {
        console.error('Error fetching applications:', err);
        setError(err.message || 'Failed to load your applications');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  if (loading) return <Loader fullScreen />;

  const quickActions = [
    {
      title: 'Apply for Loan',
      description: 'Start a new loan application',
      icon: FilePlus2,
      onClick: () => navigate('/applicant/apply'),
    },
    {
      title: 'My Applications',
      description: 'Track your applications',
      icon: FileText,
      onClick: () => navigate('/applicant/my-applications'),
    },
    {
      title: 'Help & Support',
      description: 'Get help with your loan',
      icon: LifeBuoy,
      onClick: null,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Welcome to LoanLite</h1>
          <p className="text-gray-500">Manage your loan applications</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mb-8">
          <Button variant="primary" size="lg" onClick={() => navigate('/applicant/apply')}>
            <FilePlus2 size={18} /> Apply for New Loan
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <StatCard title="Total Applications" value={stats.total} variant="total" />
          <StatCard title="Draft" value={stats.draft} variant="neutral" />
          <StatCard title="Submitted" value={stats.submitted} variant="warning" />
          <StatCard title="Approved" value={stats.approved} variant="success" />
          <StatCard title="Rejected" value={stats.rejected} variant="danger" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {quickActions.map(({ title, description, icon: Icon, onClick }) => (
            <Card
              key={title}
              onClick={onClick || undefined}
              className={`transition-shadow ${onClick ? 'hover:shadow-md cursor-pointer' : ''}`}
            >
              <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-1">
                {title}
                {onClick && <ArrowRight size={16} className="text-gray-300" />}
              </h3>
              <p className="text-gray-500 text-sm">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApplicantDashboard;
