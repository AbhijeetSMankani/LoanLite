import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import { FilePlus2, Inbox } from 'lucide-react';

const FILTERS = [
  'all',
  'draft',
  'submitted',
  'under verification',
  'verified',
  'under review',
  'accepted',
  'rejected',
  'withdrawn',
];

const MyApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await loanService.getMyApplications(page, 10);
      setApplications(response.data || []);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredApplications =
    filter === 'all' ? applications : applications.filter((app) => app.status?.toLowerCase() === filter);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Applications</h1>
            <p className="text-gray-500 mt-1">Track the status of your loan applications</p>
          </div>
          <Button variant="primary" onClick={() => navigate('/applicant/apply')}>
            <FilePlus2 size={16} /> New Application
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors whitespace-nowrap ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Applications Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredApplications.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No applications found"
              message="You haven't submitted any applications matching this filter yet."
              action={
                <Button variant="primary" onClick={() => navigate('/applicant/apply')}>
                  Start Your First Application
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loan Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => (
                    <tr key={application.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-800">#{application.id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        ₹{application.loanAmount?.toLocaleString() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(application.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/applicant/application/${application.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredApplications.length > 0 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-700 font-semibold text-sm">Page {page}</span>
            <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyApplications;
