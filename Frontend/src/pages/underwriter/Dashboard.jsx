import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import loanService from '../../services/loanService';
import { ClipboardList, BarChart3, ArrowRight } from 'lucide-react';

const UnderwriterDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [workListRes, claimedRes] = await Promise.all([
          loanService.getUnderwriterWorkList(),
          loanService.getClaimedApplicationsForUnderwriter(),
        ]);

        const claimed = claimedRes.data || [];
        setStats({
          pending: (workListRes.data || []).length,
          approved: claimed.filter((a) => a.status?.toLowerCase() === 'accepted').length,
          rejected: claimed.filter((a) => a.status?.toLowerCase() === 'rejected').length,
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Underwriter Dashboard</h1>
          <p className="text-gray-500">Make final decisions on loan applications</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard title="Pending Decision" value={stats.pending} variant="warning" />
          <StatCard title="Accepted" value={stats.approved} variant="success" />
          <StatCard title="Rejected" value={stats.rejected} variant="danger" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card
            onClick={() => navigate('/underwriter/applications')}
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
            <p className="text-gray-500 text-sm mb-4">Review verified applications ready for decision</p>
            <p className="text-3xl font-bold text-primary-600">{stats.pending}</p>
          </Card>

          <Card className="opacity-70 cursor-not-allowed relative">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              Coming soon
            </span>
            <div className="flex items-center mb-4">
              <div className="bg-purple-50 text-purple-600 rounded-lg p-3 mr-4">
                <BarChart3 size={22} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Reports</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">View approval/rejection statistics and trends</p>
            <p className="text-lg font-bold text-purple-400">Analysis</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UnderwriterDashboard;
