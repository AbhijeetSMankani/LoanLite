import axiosInstance from '../api/axiosInstance';

// Mock documents
const MOCK_DOCUMENTS = {};

const documentService = {
  // Upload document for an application
  uploadDocument: async (applicationId, formData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const docId = Date.now().toString();
        const file = formData.get('file');
        
        const doc = {
          id: docId,
          applicationId,
          name: file?.name || 'document.pdf',
          type: 'pdf',
          status: 'pending',
          uploadedAt: new Date().toISOString()
        };

        if (!MOCK_DOCUMENTS[applicationId]) {
          MOCK_DOCUMENTS[applicationId] = [];
        }
        MOCK_DOCUMENTS[applicationId].push(doc);

        resolve({ data: doc });
      }, 300);
    });
  },

  // Get required documents for an application
  getRequiredDocuments: async (applicationId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: [
            { name: 'ID Proof', required: true },
            { name: 'Income Certificate', required: true },
            { name: 'Bank Statement', required: false },
            { name: 'Employment Letter', required: false }
          ]
        });
      }, 300);
    });
  },

  // Get uploaded documents
  getUploadedDocuments: async (applicationId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const docs = MOCK_DOCUMENTS[applicationId] || [
          {
            id: '1',
            applicationId,
            name: 'ID Proof.pdf',
            type: 'pdf',
            status: 'verified',
            uploadedAt: '2026-08-10'
          },
          {
            id: '2',
            applicationId,
            name: 'Income Certificate.pdf',
            type: 'pdf',
            status: 'verified',
            uploadedAt: '2026-08-10'
          }
        ];
        resolve({ data: docs });
      }, 300);
    });
  },

  // Delete document
  deleteDocument: async (documentId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ data: { message: 'Document deleted successfully' } });
      }, 300);
    });
  },

  // Verify document
  verifyDocument: async (documentId, verificationData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: {
            id: documentId,
            status: verificationData.verified ? 'verified' : 'rejected',
            notes: verificationData.notes
          }
        });
      }, 300);
    });
  },

  // Download document
  downloadDocument: async (documentId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const blob = new Blob(['Mock document content'], { type: 'application/pdf' });
        resolve(blob);
      }, 300);
    });
  },
};

export default documentService;