import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatCard from '../../components/StatCard';
import loanService from '../../services/loanService';

const ProcessorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await loanService.getApplicationsForProcessor(1, 100);
        
        const applications = response.data || [];
        const newStats = {
          pending: applications.filter(a => a.status === 'submitted').length,
          inProgress: applications.filter(a => a.status === 'in-review').length,
          completed: applications.filter(a => a.status === 'verified').length,
        };
        
        setStats(newStats);
      } catch (err) {
        setError(err.message || 'Failed to load statistics');
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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Processor Dashboard</h1>
          <p className="text-gray-600">Review and verify loan applications</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard title="Pending" value={stats.pending} color="bg-yellow-500" />
          <StatCard title="In Progress" value={stats.inProgress} color="bg-blue-500" />
          <StatCard title="Completed" value={stats.completed} color="bg-green-500" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/processor/applications')}
          >
            <div className="flex items-center mb-4">
              <div className="bg-orange-500 rounded-lg p-3 mr-4">
                <span className="text-white text-2xl">📋</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Applications</h3>
            </div>
            <p className="text-gray-600 mb-4">Review applications waiting for your attention</p>
            <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
          </div>

          <div
            className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate('/processor/document-verification')}
          >
            <div className="flex items-center mb-4">
              <div className="bg-green-500 rounded-lg p-3 mr-4">
                <span className="text-white text-2xl">✓</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Verification</h3>
            </div>
            <p className="text-gray-600 mb-4">Verify documents and complete file preparation</p>
            <p className="text-3xl font-bold text-green-600">Check Status</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessorDashboard;