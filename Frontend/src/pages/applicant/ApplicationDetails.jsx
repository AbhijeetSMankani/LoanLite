import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    fetchApplicationDetails();
  }, [id]);

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
            onClick={() => navigate('/applicant/my-applications')}
            className="mb-4"
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Application #{application.id}</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">Application Status</p>
              <StatusBadge status={application.status} />
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-sm font-semibold mb-2">Loan Amount</p>
              <p className="text-3xl font-bold text-orange-600">₹{application.loanAmount?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Application Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Loan Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Loan Amount</p>
                <p className="text-lg font-semibold text-gray-800">₹{application.loanAmount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Loan Term</p>
                <p className="text-lg font-semibold text-gray-800">{application.loanTerm} months</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Purpose</p>
                <p className="text-lg font-semibold text-gray-800">{application.purpose}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Personal Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Monthly Income</p>
                <p className="text-lg font-semibold text-gray-800">₹{application.income?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Employment</p>
                <p className="text-lg font-semibold text-gray-800">{application.employment}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Duration</p>
                <p className="text-lg font-semibold text-gray-800">{application.employmentDuration} years</p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Documents</h3>
            <Button
              variant="primary"
              onClick={() => setShowUploadModal(true)}
              className="text-sm px-3 py-1"
            >
              + Upload Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <p className="text-gray-600">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-800">{doc.fileName}</span>
                  <span className="text-xs font-semibold text-green-600">✓ Uploaded</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
              <Button
                variant="primary"
                onClick={handleFileUpload}
                disabled={!uploadFile}
              >
                Upload
              </Button>
            </>
          }
        >
          <div>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ApplicationDetails;