import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import loanService from '../../services/loanService';
import { ClipboardList, ShieldCheck, ArrowRight } from 'lucide-react';

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
        setStats({
          pending: applications.filter((a) => a.status === 'submitted').length,
          inProgress: applications.filter((a) => a.status === 'in-review').length,
          completed: applications.filter((a) => a.status === 'verified').length,
        });
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Processor Dashboard</h1>
          <p className="text-gray-500">Review and verify loan applications</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard title="Pending" value={stats.pending} variant="warning" />
          <StatCard title="In Progress" value={stats.inProgress} variant="info" />
          <StatCard title="Completed" value={stats.completed} variant="success" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card
            onClick={() => navigate('/processor/applications')}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-50 text-primary-600 rounded-lg p-3 mr-4">
                <ClipboardList size={22} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-1">
                Applications <ArrowRight size={16} className="text-gray-300" />
              </h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">Review applications waiting for your attention</p>
            <p className="text-3xl font-bold text-primary-600">{stats.pending}</p>
          </Card>

          <Card
            onClick={() => navigate('/processor/document-verification')}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center mb-4">
              <div className="bg-green-50 text-green-600 rounded-lg p-3 mr-4">
                <ShieldCheck size={22} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-1">
                Verification <ArrowRight size={16} className="text-gray-300" />
              </h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">Verify documents and complete file preparation</p>
            <p className="text-lg font-bold text-green-600">Check Status</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessorDashboard;
