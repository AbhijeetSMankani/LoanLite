import axiosInstance from '../api/axiosInstance';

const documentService = {
  uploadDocument: async (applicationId, formData) => {
    const { data } = await axiosInstance.post(`/applications/${applicationId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data };
  },

  getRequiredDocuments: async () => {
    return {
      data: [
        { name: 'ID Proof', required: true },
        { name: 'Income Certificate', required: true },
        { name: 'Bank Statement', required: false },
        { name: 'Employment Letter', required: false },
      ],
    };
  },

  getUploadedDocuments: async (applicationId) => {
    const { data } = await axiosInstance.get(`/applications/${applicationId}/documents`);
    return { data: data.documents || [], missingRequiredDocuments: data.missingRequiredDocuments || [] };
  },

  deleteDocument: async (documentId) => {
    await axiosInstance.delete(`/documents/${documentId}`);
    return { data: { message: 'Document deleted successfully' } };
  },

  verifyDocument: async (documentId, verificationData) => {
    const { data } = await axiosInstance.patch(`/documents/${documentId}`, {
      verificationStatus: verificationData.verified ? 'VERIFIED' : 'REJECTED',
      remarks: verificationData.notes,
    });
    return { data };
  },
};

export default documentService;
