import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';
import { fullName } from '../../utils/role';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileCheck2 } from 'lucide-react';

const DOCUMENT_TYPE_LABELS = {
  PAN_CARD: 'PAN Card',
  SALARY_SLIP: 'Salary Slip',
  ADDRESS_PROOF: 'Address Proof',
  OTHER: 'Other',
};

const documentTypeLabel = (type) => DOCUMENT_TYPE_LABELS[type?.toUpperCase()] || type || 'Other';

const LoanDecision = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [application, setApplication] = useState(null);
  const [rules, setRules] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [decision, setDecision] = useState('ACCEPT');
  const [comments, setComments] = useState('');

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const appResponse = await loanService.getApplicationById(id);
      setApplication(appResponse.data);

      const rulesResponse = await loanService.getLoanRules(id);
      setRules(rulesResponse.data);

      const docsResponse = await documentService.getUploadedDocuments(id);
      setDocuments(docsResponse.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmitDecision = async () => {
    try {
      setLoading(true);
      await loanService.decideApplication(id, decision, comments);
      setSuccess(`Application ${decision === 'ACCEPT' ? 'accepted' : 'rejected'} successfully.`);
      setTimeout(() => navigate('/underwriter/applications'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit decision');
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  if (!application) {
    return (
      <div className="p-8">
        <EmptyState icon={AlertTriangle} variant="error" title="Application not found" />
      </div>
    );
  }

  const decisionOptions = [
    { value: 'ACCEPT', label: 'Accept', icon: CheckCircle2, color: 'text-green-600' },
    { value: 'REJECT', label: 'Reject', icon: XCircle, color: 'text-red-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="secondary" size="sm" onClick={() => navigate('/underwriter/applications')} className="mb-4">
            <ArrowLeft size={14} /> Back
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Loan Decision</h1>
          <p className="text-gray-500 mt-1">Application #{application.id}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}

        {/* Application Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <h3 className="text-base font-bold text-gray-800 mb-4">Application Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Applicant</p>
                <p className="text-base font-semibold text-gray-800">{fullName(application.applicant)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Loan Amount</p>
                <p className="text-base font-semibold text-primary-600">₹{application.loanAmount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Loan Term</p>
                <p className="text-base font-semibold text-gray-800">{application.tenureMonths} months</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Monthly Income</p>
                <p className="text-base font-semibold text-gray-800">₹{application.declaredIncome?.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-bold text-gray-800 mb-4">System Suggestions</h3>
            {rules ? (
              <div className="space-y-3">
                <div>
                  <p className="text-gray-500 text-xs">Credit Score</p>
                  <p className="text-base font-semibold text-gray-800">{rules.creditScore || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Income Verification</p>
                  <p
                    className={`text-base font-semibold flex items-center gap-1 ${
                      rules.incomeVerification === 'verified' ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    <CheckCircle2 size={15} /> {rules.incomeVerification === 'verified' ? 'Verified' : 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Debt to Income Ratio</p>
                  <p className="text-base font-semibold text-gray-800">{rules.debtToIncomeRatio || 'N/A'}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Recommendation</p>
                  <StatusBadge status={rules.recommendation || 'pending-decision'} />
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No suggestions available</p>
            )}
          </Card>
        </div>

        {/* Documents Section (read-only — underwriter reviews, doesn't edit) */}
        <Card className="mb-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">Documents</h3>
          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
                  <div className="min-w-0">
                    <span className="text-gray-800 text-sm truncate flex items-center gap-2">
                      <FileCheck2 size={14} className="text-gray-400 shrink-0" /> {doc.fileName}
                    </span>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {documentTypeLabel(doc.documentType)}
                    </span>
                  </div>
                  <StatusBadge status={doc.verificationStatus} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Decision Section */}
        <Card className="mb-6">
          <h3 className="text-base font-bold text-gray-800 mb-5">Make Your Decision</h3>

          <div className="mb-6">
            <p className="text-gray-700 font-semibold mb-3 text-sm">
              Decision <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {decisionOptions.map(({ value, label, icon: Icon, color }) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    decision === value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={value}
                    checked={decision === value}
                    onChange={(e) => setDecision(e.target.value)}
                    className="sr-only"
                  />
                  <Icon size={16} className={color} />
                  <span className={`font-semibold text-sm ${color}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5 text-sm">
              Comments <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Provide detailed comments about your decision"
              rows="4"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Button variant="secondary" onClick={() => navigate('/underwriter/applications')}>
            Cancel
          </Button>
          <Button
            variant={decision === 'ACCEPT' ? 'success' : 'danger'}
            onClick={handleSubmitDecision}
            loading={loading}
            disabled={!comments}
          >
            {decision === 'ACCEPT' ? 'Accept' : 'Reject'} Application
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoanDecision;
