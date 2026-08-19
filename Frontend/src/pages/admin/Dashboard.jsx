import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatCard from '../../components/StatCard';
import userService from '../../services/userService';

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
        // Set default stats
        setStats({
          totalUsers: 12,
          totalApplications: 48,
          approvedLoans: 35,
          rejectedLoans: 13,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">System management and oversight</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard title="Total Users" value={stats.totalUsers} color="bg-blue-500" />
          <StatCard title="Total Applications" value={stats.totalApplications} color="bg-purple-500" />
          <StatCard title="Approved" value={stats.approvedLoans} color="bg-green-500" />
          <StatCard title="Rejected" value={stats.rejectedLoans} color="bg-red-500" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/admin/users')}
          >
            <div className="flex items-center mb-4">
              <div className="bg-blue-500 rounded-lg p-3 mr-4">
                <span className="text-white text-2xl">👥</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">User Management</h3>
            </div>
            <p className="text-gray-600">Create, edit, and manage system users</p>
          </div>

          <div
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/admin/audit-logs')}
          >
            <div className="flex items-center mb-4">
              <div className="bg-orange-500 rounded-lg p-3 mr-4">
                <span className="text-white text-2xl">📋</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Audit Logs</h3>
            </div>
            <p className="text-gray-600">View system activity and user actions</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="bg-green-500 rounded-lg p-3 mr-4">
                <span className="text-white text-2xl">⚙️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Settings</h3>
            </div>
            <p className="text-gray-600">Configure system settings and rules</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;