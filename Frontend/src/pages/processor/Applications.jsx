import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import loanService from '../../services/loanService';

const ProcessorApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('submitted');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchApplications();
  }, [page]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await loanService.getApplicationsForProcessor(page, 10);
      setApplications(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = filter === 'all'
    ? applications
    : applications.filter(app => app.status === filter);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Applications for Verification</h1>
          <p className="text-gray-600 mt-2">Review and verify loan applications</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          {['all', 'submitted', 'in-review', 'verified'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-semibold capitalize transition-colors ${
                filter === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Applications Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {filteredApplications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 text-lg">No applications to process</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Application ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Applicant</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Loan Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(application => (
                  <tr key={application.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">#{application.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{application.applicantName || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                      ₹{application.loanAmount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={application.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(application.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Button
                        variant="primary"
                        onClick={() => navigate(`/processor/document-verification`)}
                        className="text-xs px-3 py-1"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredApplications.length > 0 && (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-800 font-semibold">Page {page}</span>
            <Button
              variant="secondary"
              onClick={() => setPage(page + 1)}
              disabled={filteredApplications.length < 10}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessorApplications;