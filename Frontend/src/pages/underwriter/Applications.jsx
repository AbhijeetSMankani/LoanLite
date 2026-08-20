import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import { fullName } from '../../utils/role';
import { Inbox } from 'lucide-react';

const FILTERS = ['all', 'pending-decision', 'approved', 'rejected'];

const UnderwriterApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('pending-decision');
  const [page, setPage] = useState(1);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await loanService.getApplicationsForUnderwriter(page, 10);
      setApplications(response.data || []);
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
    filter === 'all' ? applications : applications.filter((app) => app.status === filter);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Applications for Decision</h1>
          <p className="text-gray-500 mt-1">Review verified applications and make final decisions</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors whitespace-nowrap ${
                filter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'pending-decision' ? 'Pending' : status}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredApplications.length === 0 ? (
            <EmptyState icon={Inbox} title="No applications to process" message="Nothing matches this filter right now." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Application ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Applicant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loan Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Income</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => (
                    <tr key={application.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">#{application.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{fullName(application.applicant)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-primary-600">
                        ₹{application.loanAmount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">₹{application.declaredIncome?.toLocaleString()}/mo</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {application.status === 'pending-decision' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/underwriter/loan-decision/${application.id}`)}
                          >
                            Decide
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" disabled>
                            Decided
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredApplications.length > 0 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-700 font-semibold text-sm">Page {page}</span>
            <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={filteredApplications.length < 10}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnderwriterApplications;
