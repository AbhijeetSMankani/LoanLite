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
import { ArrowLeft, FileUp, FileCheck2, AlertTriangle } from 'lucide-react';

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

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

  const downloadDocument = async (doc) => {
    try {
      const blob = await documentService.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download document');
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', 'general');

      await documentService.uploadDocument(id, formData);
      setUploadFile(null);
      setShowUploadModal(false);
      await fetchApplicationDetails();
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
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

        {/* Status Card */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Application Status</p>
              <StatusBadge status={application.status} />
            </div>
            <div className="sm:text-right">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Loan Amount</p>
              <p className="text-3xl font-bold text-primary-600">₹{application.loanAmount?.toLocaleString()}</p>
            </div>
          </div>
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
              <div>
                <p className="text-gray-500 text-xs">Purpose</p>
                <p className="text-base font-semibold text-gray-800">{application.purpose}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-bold text-gray-800 mb-4">Personal Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Monthly Income</p>
                <p className="text-base font-semibold text-gray-800">₹{application.declaredIncome?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Employment</p>
                <p className="text-base font-semibold text-gray-800">{application.employment}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Duration</p>
                <p className="text-base font-semibold text-gray-800">{application.employmentDuration} years</p>
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
                  <span className="text-gray-800 text-sm truncate flex items-center gap-2">
                    <FileCheck2 size={14} className="text-gray-400 shrink-0" /> {doc.fileName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={doc.verificationStatus} />
                    <button
                      onClick={() => downloadDocument(doc)}
                      className="text-primary-600 hover:text-primary-700 text-xs font-semibold"
                    >
                      Download
                    </button>
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
          }}
          title="Upload Document"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold"
          />
        </Modal>
      </div>
    </div>
  );
};

export default ApplicationDetails;
