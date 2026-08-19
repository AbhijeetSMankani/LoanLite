import axiosInstance from '../api/axiosInstance';

const documentService = {
  // Upload document for an application
  uploadDocument: async (applicationId, formData) => {
    try {
      const response = await axiosInstance.post(
        `/documents/applications/${applicationId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get required documents for an application
  getRequiredDocuments: async (applicationId) => {
    try {
      const response = await axiosInstance.get(`/documents/applications/${applicationId}/required`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get uploaded documents
  getUploadedDocuments: async (applicationId) => {
    try {
      const response = await axiosInstance.get(`/documents/applications/${applicationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete document
  deleteDocument: async (documentId) => {
    try {
      const response = await axiosInstance.delete(`/documents/${documentId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Verify document
  verifyDocument: async (documentId, verificationData) => {
    try {
      const response = await axiosInstance.post(`/documents/${documentId}/verify`, verificationData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Download document
  downloadDocument: async (documentId) => {
    try {
      const response = await axiosInstance.get(`/documents/${documentId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export default documentService;