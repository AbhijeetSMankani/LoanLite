import axiosInstance from '../api/axiosInstance';

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))?.id;
  } catch {
    return undefined;
  }
};

const paginate = (list, page, limit) => list.slice((page - 1) * limit, page * limit);

const decisionStatusMap = { approve: 'approved', reject: 'rejected', refer: 'referred' };

const loanService = {
  createApplication: async (applicationData) => {
    const { data } = await axiosInstance.post('/loan-applications', {
      applicant: { id: currentUserId() },
      loanAmount: Number(applicationData.loanAmount) || null,
      tenureMonths: Number(applicationData.loanTerm) || null,
      purpose: applicationData.purpose,
      declaredIncome: Number(applicationData.income) || null,
      employment: applicationData.employment,
      employmentDuration: Number(applicationData.employmentDuration) || null,
      status: applicationData.status || 'draft',
    });
    return { data };
  },

  getMyApplications: async (page = 1, limit = 10) => {
    const { data } = await axiosInstance.get('/loan-applications', {
      params: { applicantId: currentUserId() },
    });
    return { data: paginate(data, page, limit) };
  },

  getApplicationById: async (applicationId) => {
    const { data } = await axiosInstance.get(`/loan-applications/${applicationId}`);
    return { data };
  },

  updateApplication: async (applicationId, updateData) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, updateData);
    return { data };
  },

  submitApplication: async (applicationId) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, {
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    });
    return { data };
  },

  getApplicationsForProcessor: async (page = 1, limit = 10) => {
    const { data } = await axiosInstance.get('/loan-applications');
    return { data: paginate(data, page, limit) };
  },

  getApplicationsForUnderwriter: async (page = 1, limit = 10) => {
    const { data } = await axiosInstance.get('/loan-applications');
    return { data: paginate(data, page, limit) };
  },

  submitVerification: async (applicationId, verificationData) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, verificationData);
    return { data };
  },

  makeDecision: async (applicationId, decisionData) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, {
      decision: decisionData.decision,
      decisionComments: decisionData.comments,
      status: decisionStatusMap[decisionData.decision] || decisionData.decision,
    });
    return { data };
  },

  getLoanRules: async (applicationId) => {
    const { data: app } = await axiosInstance.get(`/loan-applications/${applicationId}`);
    const debtToIncomeRatio =
      app.emi && app.declaredIncome ? Math.round((app.emi / app.declaredIncome) * 10000) / 100 : null;
    return {
      data: {
        creditScore: app.creditScore ?? null,
        incomeVerification: app.verifiedIncome ? 'verified' : 'pending',
        debtToIncomeRatio,
        recommendation: app.recommendation || 'pending-decision',
      },
    };
  },
};

export default loanService;
