import axiosInstance from '../api/axiosInstance';

const loanService = {
  // Create a new loan application
  createApplication: async (applicationData) => {
    try {
      const response = await axiosInstance.post('/loans/applications', applicationData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get all applications for the current user
  getMyApplications: async (page = 1, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/loans/applications?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get single application details
  getApplicationById: async (applicationId) => {
    try {
      const response = await axiosInstance.get(`/loans/applications/${applicationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update application (save draft)
  updateApplication: async (applicationId, data) => {
    try {
      const response = await axiosInstance.put(`/loans/applications/${applicationId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Submit application
  submitApplication: async (applicationId) => {
    try {
      const response = await axiosInstance.post(`/loans/applications/${applicationId}/submit`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get applications for processor
  getApplicationsForProcessor: async (page = 1, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/loans/processor/applications?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get applications for underwriter
  getApplicationsForUnderwriter: async (page = 1, limit = 10) => {
    try {
      const response = await axiosInstance.get(`/loans/underwriter/applications?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Submit verification by processor
  submitVerification: async (applicationId, verificationData) => {
    try {
      const response = await axiosInstance.post(`/loans/applications/${applicationId}/verify`, verificationData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Make final decision by underwriter
  makeDecision: async (applicationId, decisionData) => {
    try {
      const response = await axiosInstance.post(`/loans/applications/${applicationId}/decision`, decisionData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get loan rules/suggestions
  getLoanRules: async (applicationId) => {
    try {
      const response = await axiosInstance.get(`/loans/applications/${applicationId}/rules`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export default loanService;