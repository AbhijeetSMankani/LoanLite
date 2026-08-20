import axiosInstance from '../api/axiosInstance';

const documentService = {
  uploadDocument: async (applicationId, formData) => {
    formData.append('applicationId', applicationId);
    const { data } = await axiosInstance.post('/documents/upload', formData, {
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
    const { data } = await axiosInstance.get('/documents', { params: { applicationId } });
    return { data };
  },

  deleteDocument: async (documentId) => {
    await axiosInstance.delete(`/documents/${documentId}`);
    return { data: { message: 'Document deleted successfully' } };
  },

  verifyDocument: async (documentId, verificationData) => {
    const { data } = await axiosInstance.put(`/documents/${documentId}`, {
      verificationStatus: verificationData.verified ? 'approved' : 'rejected',
      remarks: verificationData.notes,
    });
    return { data };
  },

  downloadDocument: async (documentId) => {
    const { data } = await axiosInstance.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return data;
  },
};

export default documentService;
