import axiosInstance from '../api/axiosInstance';

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))?.id;
  } catch {
    return undefined;
  }
};

const paginate = (list, page, limit) => list.slice((page - 1) * limit, page * limit);

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

  // The pool of unclaimed applications waiting for an underwriter — GET
  // /underwriter/work-list is hardcoded server-side to status "Verified".
  getUnderwriterWorkList: async () => {
    const { data } = await axiosInstance.get('/underwriter/work-list');
    return { data };
  },

  // Applications this underwriter has already claimed. Same auto-scoping as
  // getClaimedApplicationsForProcessor below, but forced to underwriterId.
  getClaimedApplicationsForUnderwriter: async () => {
    const { data } = await axiosInstance.get('/loan-applications');
    return { data };
  },

  // POST /underwriter/claim/{id} assigns the caller as underwriter and sets
  // status to "Under Review" directly — no rename hack needed here since we
  // control this endpoint's exact status strings.
  claimApplicationAsUnderwriter: async (applicationId) => {
    const { data } = await axiosInstance.post(`/underwriter/claim/${applicationId}`);
    return { data };
  },

  // decision is 'ACCEPT' or 'REJECT'; the backend sets status to "Accepted"
  // or "Rejected" accordingly and rejects the call if the caller isn't the
  // assigned underwriter or the application isn't Under Review.
  decideApplication: async (applicationId, decision, comments) => {
    const { data } = await axiosInstance.post(`/underwriter/applications/${applicationId}/decision`, {
      decision,
      comments,
    });
    return { data };
  },

  // The pool of unclaimed applications waiting for a processor — GET
  // /processor/work-list is hardcoded server-side to status "Submitted".
  getProcessorWorkList: async () => {
    const { data } = await axiosInstance.get('/processor/work-list');
    return { data };
  },

  // Applications this processor has already claimed. The backend forces
  // processorId to the caller's own id for anyone with the PROCESSOR role,
  // so this is automatically scoped to "my" applications regardless of
  // what (if anything) we pass here.
  getClaimedApplicationsForProcessor: async () => {
    const { data } = await axiosInstance.get('/loan-applications');
    return { data };
  },

  // POST /processor/claim/{id} is the only endpoint that can move an
  // application off the Submitted pool — it sets status to "In Review" and
  // assigns the caller as processor. There's no way to make it use our
  // exact status vocabulary, so we immediately rename the status via the
  // generic update endpoint (which the now-assigned processor has access
  // to) to keep "Under Verification" as the source of truth everywhere else
  // in the app.
  claimApplication: async (applicationId) => {
    await axiosInstance.post(`/processor/claim/${applicationId}`);
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, {
      status: 'Under Verification',
    });
    return { data };
  },

  // POST /processor/applications/{id}/verify is the backend's "mark
  // reviewed" action — it always resolves to "Ready for Underwriter"
  // internally regardless of outcome, so we rename it to "Verified"
  // afterwards for the same reason as claimApplication above.
  verifyApplication: async (applicationId) => {
    await axiosInstance.post(`/processor/applications/${applicationId}/verify`);
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, {
      status: 'Verified',
    });
    return { data };
  },

  submitVerification: async (applicationId, verificationData) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, verificationData);
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
