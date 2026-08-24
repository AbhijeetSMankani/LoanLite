import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';
import { getDisplayStatus } from '../../utils/applicationStatus';
import { ArrowLeft, FileUp, FileCheck2, AlertTriangle, Send, Ban, Trash2 } from 'lucide-react';

const DOCUMENT_TYPE_LABELS = {
  PAN_CARD: 'PAN Card',
  SALARY_SLIP: 'Salary Slip',
  ADDRESS_PROOF: 'Address Proof',
  OTHER: 'Other',
};

const documentTypeLabel = (type) => DOCUMENT_TYPE_LABELS[type?.toUpperCase()] || type || 'Other';

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [documentType, setDocumentType] = useState('OTHER');
  const [remarks, setRemarks] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const appResponse = await loanService.getApplicationById(id);
      setApplication(appResponse.data);

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

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', documentType);
      if (remarks) formData.append('remarks', remarks);

      await documentService.uploadDocument(id, formData);
      setUploadFile(null);
      setDocumentType('OTHER');
      setRemarks('');
      setShowUploadModal(false);
      await fetchApplicationDetails();
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  // Applicants have no endpoint to edit a document's file/metadata in place —
  // the only supported path is deleting it (while still PENDING) and
  // uploading a replacement, so that's what "editing" a document means here.
  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Remove "${doc.fileName}"? You can upload a replacement afterward.`)) {
      return;
    }
    try {
      setActionLoading(true);
      await documentService.deleteDocument(doc.id);
      await fetchApplicationDetails();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    try {
      setActionLoading(true);
      setError('');
      await loanService.submitApplication(id);
      setSuccess('Application submitted successfully.');
      await fetchApplicationDetails();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setActionLoading(true);
      setError('');
      await loanService.withdrawApplication(id);
      setShowWithdrawModal(false);
      setSuccess('Application withdrawn.');
      await fetchApplicationDetails();
    } catch (err) {
      setShowWithdrawModal(false);
      setError(err.response?.data?.message || 'Failed to withdraw application');
    } finally {
      setActionLoading(false);
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

  const displayStatus = getDisplayStatus(application);
  const isDraft = application.status === 'Draft';
  const isWithdrawn = application.status === 'Withdrawn';
  const isWaitingForDocuments = displayStatus === 'Waiting for Documents';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="secondary" size="sm" onClick={() => navigate('/applicant/my-applications')} className="mb-4">
            <ArrowLeft size={14} /> Back
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Application #{application.id}</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Status Card */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Application Status</p>
              <StatusBadge status={displayStatus} />
            </div>
            <div className="sm:text-right">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Loan Amount</p>
              <p className="text-3xl font-bold text-primary-600">₹{application.loanAmount?.toLocaleString()}</p>
            </div>
          </div>

          {isWaitingForDocuments && application.decisionComments && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span className="font-semibold">Processor note:</span> {application.decisionComments}
            </div>
          )}

          {(isDraft || !isWithdrawn) && (
            <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap gap-3">
              {isDraft && (
                <Button variant="success" size="sm" loading={actionLoading} onClick={handleSubmitApplication}>
                  <Send size={14} /> Submit Application
                </Button>
              )}
              {!isWithdrawn && (
                <Button variant="danger" size="sm" onClick={() => setShowWithdrawModal(true)} disabled={actionLoading}>
                  <Ban size={14} /> Withdraw Application
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Application Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <h3 className="text-base font-bold text-gray-800 mb-4">Loan Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Loan Amount</p>
                <p className="text-base font-semibold text-gray-800">₹{application.loanAmount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Loan Term</p>
                <p className="text-base font-semibold text-gray-800">{application.tenureMonths} months</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-bold text-gray-800 mb-4">Income Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Monthly Income</p>
                <p className="text-base font-semibold text-gray-800">₹{application.declaredIncome?.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Documents Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-800">Documents</h3>
            <Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>
              <FileUp size={14} /> Upload
            </Button>
          </div>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No documents uploaded yet</p>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={doc.verificationStatus} />
                    {doc.verificationStatus?.toUpperCase() === 'PENDING' && (
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        disabled={actionLoading}
                        title="Remove this document so you can upload a replacement"
                        className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upload Modal */}
        <Modal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setUploadFile(null);
            setDocumentType('OTHER');
            setRemarks('');
          }}
          title="Upload Document"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setDocumentType('OTHER');
                  setRemarks('');
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleFileUpload} disabled={!uploadFile} loading={loading}>
                Upload
              </Button>
            </>
          }
        >
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files[0])}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold mb-4"
          />

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-1.5 text-sm">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all"
            >
              <option value="OTHER">Other</option>
              <option value="PAN_CARD">PAN Card</option>
              <option value="SALARY_SLIP">Salary Slip</option>
              <option value="ADDRESS_PROOF">Address Proof</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5 text-sm">Remarks (optional)</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add a note about this document"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all"
            />
          </div>
        </Modal>

        {/* Withdraw Confirmation Modal */}
        <Modal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          title="Withdraw Application"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowWithdrawModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={actionLoading} onClick={handleWithdraw}>
                Withdraw
              </Button>
            </>
          }
        >
          <p className="text-gray-700 text-sm">
            Are you sure you want to withdraw application #{application.id}? This cannot be undone, and the
            application will move to the <span className="font-semibold">Withdrawn</span> state.
          </p>
        </Modal>
      </div>
    </div>
  );
};

export default ApplicationDetails;
