import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import userService from '../../services/userService';
import { Users, ClipboardList, Settings } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApplications: 0,
    approvedLoans: 0,
    rejectedLoans: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await userService.getDashboardStats();
        setStats(response.data || stats);
      } catch (err) {
        setError(err.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
          <p className="text-gray-500">System management and oversight</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard title="Total Users" value={stats.totalUsers} variant="users" />
          <StatCard title="Total Applications" value={stats.totalApplications} variant="primary" />
          <StatCard title="Approved" value={stats.approvedLoans} variant="success" />
          <StatCard title="Rejected" value={stats.rejectedLoans} variant="danger" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Card
            onClick={() => navigate('/admin/audit-logs')}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-50 text-primary-600 rounded-lg p-3 mr-4">
                <ClipboardList size={22} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Audit Logs</h3>
            </div>
            <p className="text-gray-500 text-sm">View system activity and user actions</p>
          </Card>

          <Card className="opacity-70 cursor-not-allowed relative">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              Coming soon
            </span>
            <div className="flex items-center mb-4">
              <div className="bg-green-50 text-green-600 rounded-lg p-3 mr-4">
                <Settings size={22} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Settings</h3>
            </div>
            <p className="text-gray-500 text-sm">Configure system settings and rules</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
