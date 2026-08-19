import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';

const DocumentVerification = () => {
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    if (applicationId) {
      fetchApplicationDetails();
    }
  }, [applicationId]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const appResponse = await loanService.getApplicationById(applicationId);
      setApplication(appResponse.data);

      const docsResponse = await documentService.getUploadedDocuments(applicationId);
      setDocuments(docsResponse.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDocument = async (isApproved) => {
    if (!selectedDoc) return;

    try {
      setLoading(true);
      await documentService.verifyDocument(selectedDoc.id, {
        verified: isApproved,
        notes: verificationNotes,
      });
      
      setShowVerifyModal(false);
      setSelectedDoc(null);
      setVerificationNotes('');
      await fetchApplicationDetails();
    } catch (err) {
      setError(err.message || 'Failed to verify document');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  if (!application) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">No application selected for verification</p>
          <p className="text-gray-500">Please select an application from the list</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Document Verification</h1>
          <p className="text-gray-600 mt-2">Application #{application.id}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Application Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-600 text-sm">Applicant</p>
              <p className="text-lg font-semibold text-gray-800">{application.applicantName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Loan Amount</p>
              <p className="text-lg font-semibold text-orange-600">₹{application.loanAmount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Income</p>
              <p className="text-lg font-semibold text-gray-800">₹{application.income?.toLocaleString()}/month</p>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Documents to Verify</h3>

          {documents.length === 0 ? (
            <p className="text-gray-600">No documents uploaded yet</p>
          ) : (
            <div className="space-y-4">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{doc.fileName}</p>
                    <p className="text-sm text-gray-600">
                      Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!doc.verified ? (
                      <>
                        <Button
                          variant="success"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowVerifyModal(true);
                          }}
                          className="text-sm px-4 py-2"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowVerifyModal(true);
                          }}
                          className="text-sm px-4 py-2"
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-green-600 font-semibold">✓ Verified</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Modal */}
        <Modal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedDoc(null);
            setVerificationNotes('');
          }}
          title="Verify Document"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowVerifyModal(false);
                  setSelectedDoc(null);
                  setVerificationNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleVerifyDocument(false)}
              >
                Reject
              </Button>
              <Button
                variant="success"
                onClick={() => handleVerifyDocument(true)}
              >
                Approve
              </Button>
            </>
          }
        >
          <div>
            <p className="text-gray-800 font-semibold mb-4">{selectedDoc?.fileName}</p>
            <Input
              label="Verification Notes"
              name="notes"
              type="textarea"
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder="Add any notes about the document"
            />
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default DocumentVerification;