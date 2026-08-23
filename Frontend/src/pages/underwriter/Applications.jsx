import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import { fullName } from '../../utils/role';
import { Inbox } from 'lucide-react';

const TABS = [
  { key: 'available', label: 'Available' },
  { key: 'mine', label: 'My Queue' },
];

const UnderwriterApplications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [available, setAvailable] = useState([]);
  const [claimed, setClaimed] = useState([]);
  const [tab, setTab] = useState('available');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const [workListRes, claimedRes] = await Promise.all([
        loanService.getUnderwriterWorkList(),
        loanService.getClaimedApplicationsForUnderwriter(),
      ]);
      setAvailable(workListRes.data || []);
      setClaimed(claimedRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleClaim = async (applicationId) => {
    try {
      setClaimingId(applicationId);
      await loanService.claimApplicationAsUnderwriter(applicationId);
      await fetchApplications();
      setTab('mine');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to claim application — it may already be claimed.');
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) return <Loader fullScreen />;

  const rows = tab === 'available' ? available : claimed;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500 mt-1">Claim verified applications and decide their outcome</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label} ({t.key === 'available' ? available.length : claimed.length})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={tab === 'available' ? 'No applications waiting' : 'You have no claimed applications'}
              message={
                tab === 'available'
                  ? 'Nothing has been verified and handed off to underwriting yet.'
                  : 'Claim an application from the Available tab to start reviewing it.'
              }
            />
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
                  {rows.map((application) => (
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
                        {tab === 'available' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={claimingId === application.id}
                            onClick={() => handleClaim(application.id)}
                          >
                            Claim
                          </Button>
                        ) : application.status?.toLowerCase() === 'under review' ? (
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
      </div>
    </div>
  );
};

export default UnderwriterApplications;
