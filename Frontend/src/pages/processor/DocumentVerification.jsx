import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';
import StatusBadge from '../../components/StatusBadge';
import { fullName } from '../../utils/role';
import { FileSearch } from 'lucide-react';

const DocumentVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const applicationId = searchParams.get('applicationId');

  const [loading, setLoading] = useState(Boolean(applicationId));
  const [error, setError] = useState('');
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');

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

  useEffect(() => {
    if (applicationId) {
      fetchApplicationDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

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
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <EmptyState
            icon={FileSearch}
            title="No application selected"
            message="Pick an application from the list to review its documents."
            action={
              <Button variant="primary" onClick={() => navigate('/processor/applications')}>
                Go to Applications
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Document Verification</h1>
          <p className="text-gray-500 mt-1">Application #{application.id}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Application Summary */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Applicant</p>
              <p className="text-base font-semibold text-gray-800 mt-1">{fullName(application.applicant)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Loan Amount</p>
              <p className="text-base font-semibold text-primary-600 mt-1">
                ₹{application.loanAmount?.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Income</p>
              <p className="text-base font-semibold text-gray-800 mt-1">
                ₹{application.declaredIncome?.toLocaleString()}/month
              </p>
            </div>
          </div>
        </Card>

        {/* Documents Section */}
        <Card>
          <h3 className="text-lg font-bold text-gray-800 mb-6">Documents to Verify</h3>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{doc.fileName}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {doc.verificationStatus === 'pending' || !doc.verificationStatus ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowVerifyModal(true);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowVerifyModal(true);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <StatusBadge status={doc.verificationStatus} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

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
              <Button variant="danger" onClick={() => handleVerifyDocument(false)}>
                Reject
              </Button>
              <Button variant="success" onClick={() => handleVerifyDocument(true)}>
                Approve
              </Button>
            </>
          }
        >
          <p className="text-gray-800 font-semibold mb-4">{selectedDoc?.fileName}</p>
          <Input
            label="Verification Notes"
            name="notes"
            type="textarea"
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            placeholder="Add any notes about the document"
          />
        </Modal>
      </div>
    </div>
  );
};

export default DocumentVerification;
