import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import Input from '../../components/Input';
import StatusBadge from '../../components/StatusBadge';
import loanService from '../../services/loanService';

const LoanDecision = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [application, setApplication] = useState(null);
  const [rules, setRules] = useState(null);
  const [decision, setDecision] = useState('approve');
  const [comments, setComments] = useState('');

  useEffect(() => {
    fetchApplicationDetails();
  }, [id]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const appResponse = await loanService.getApplicationById(id);
      setApplication(appResponse.data);

      const rulesResponse = await loanService.getLoanRules(id);
      setRules(rulesResponse.data);
    } catch (err) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    try {
      setLoading(true);
      await loanService.makeDecision(id, {
        decision,
        comments,
      });
      alert(`Loan ${decision === 'approve' ? 'Approved' : 'Rejected'} successfully!`);
      navigate('/underwriter/applications');
    } catch (err) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  if (!application) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg">Application not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="secondary"
            onClick={() => navigate('/underwriter/applications')}
            className="mb-4"
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Loan Decision</h1>
          <p className="text-gray-600">Application #{application.id}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Application Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Application Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Applicant</p>
                <p className="text-lg font-semibold text-gray-800">{application.applicantName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Loan Amount</p>
                <p className="text-lg font-semibold text-orange-600">₹{application.loanAmount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Loan Term</p>
                <p className="text-lg font-semibold text-gray-800">{application.loanTerm} months</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Monthly Income</p>
                <p className="text-lg font-semibold text-gray-800">₹{application.income?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Rules/Suggestions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">System Suggestions</h3>
            {rules ? (
              <div className="space-y-3">
                <div>
                  <p className="text-gray-600 text-sm">Credit Score</p>
                  <p className="text-lg font-semibold text-gray-800">{rules.creditScore || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Income Verification</p>
                  <p className="text-lg font-semibold text-green-600">✓ Verified</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Debt to Income Ratio</p>
                  <p className="text-lg font-semibold text-gray-800">{rules.debtToIncomeRatio || 'N/A'}%</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Recommendation</p>
                  <StatusBadge status={rules.recommendation || 'pending-decision'} />
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No suggestions available</p>
            )}
          </div>
        </div>

        {/* Decision Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Make Your Decision</h3>

          {/* Decision Options */}
          <div className="mb-6">
            <p className="text-gray-700 font-semibold mb-3">Decision *</p>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="approve"
                  checked={decision === 'approve'}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-green-600 font-semibold">✓ Approve</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="reject"
                  checked={decision === 'reject'}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-red-600 font-semibold">✕ Reject</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="refer"
                  checked={decision === 'refer'}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-orange-600 font-semibold">→ Refer Back</span>
              </label>
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Comments
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Provide detailed comments about your decision"
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate('/underwriter/applications')}
          >
            Cancel
          </Button>
          <Button
            variant={decision === 'approve' ? 'success' : decision === 'reject' ? 'danger' : 'warning'}
            onClick={handleSubmitDecision}
            disabled={loading || !comments}
          >
            {loading ? 'Processing...' : `${decision.charAt(0).toUpperCase() + decision.slice(1)} Application`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoanDecision;