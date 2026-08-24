import axiosInstance from '../api/axiosInstance';

const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))?.id;
  } catch {
    return undefined;
  }
};

// Work-list/claimed-queue views have no pagination UI of their own — ask the
// server for a page big enough to act as "everything" instead of the 20-row
// default the backend now applies when no `size` param is given.
const UNPAGINATED_SIZE = 200;

const loanService = {
  createApplication: async (applicationData) => {
    const { data } = await axiosInstance.post('/loan-applications', {
      applicant: { id: currentUserId() },
      loanAmount: Number(applicationData.loanAmount) || null,
      tenureMonths: Number(applicationData.loanTerm) || null,
      declaredIncome: Number(applicationData.income) || null,
      status: applicationData.status || 'draft',
    });
    return { data };
  },

  // GET /loan-applications now returns Spring's Page<T> envelope
  // ({ content, totalElements, ... }) instead of a bare array — unwrap it
  // here and forward page/size to the server instead of re-paginating
  // client-side over whatever the default page happened to contain.
  getMyApplications: async (page = 1, limit = 10) => {
    const { data } = await axiosInstance.get('/loan-applications', {
      params: { page: page - 1, size: limit },
    });
    return { data: data.content || [], totalPages: data.totalPages, totalElements: data.totalElements };
  },

  getApplicationById: async (applicationId) => {
    const { data } = await axiosInstance.get(`/loan-applications/${applicationId}`);
    return { data };
  },

  updateApplication: async (applicationId, updateData) => {
    const { data } = await axiosInstance.put(`/loan-applications/${applicationId}`, updateData);
    return { data };
  },

  // The generic PUT endpoint force-nulls any `status` an owning applicant
  // sends (they can only move off Draft via the dedicated submit action), so
  // this has to hit PATCH /applications/submit/{id} directly.
  submitApplication: async (applicationId) => {
    const { data } = await axiosInstance.patch(`/loan-applications/submit/${applicationId}`);
    return { data };
  },

  // Owning applicant only, no status precondition backend-side — can be
  // called at any stage the application hasn't already been withdrawn.
  withdrawApplication: async (applicationId) => {
    const { data } = await axiosInstance.patch(`/loan-applications/withdraw/${applicationId}`);
    return { data };
  },

  // The pool of unclaimed applications waiting for an underwriter — GET
  // /underwriter/work-list is hardcoded server-side to status "Verified".
  getUnderwriterWorkList: async () => {
    const { data } = await axiosInstance.get('/underwriter/work-list', {
      params: { size: UNPAGINATED_SIZE },
    });
    return { data: data.content || [] };
  },

  // Applications this underwriter has already claimed. Same auto-scoping as
  // getClaimedApplicationsForProcessor below, but forced to underwriterId.
  getClaimedApplicationsForUnderwriter: async () => {
    const { data } = await axiosInstance.get('/loan-applications', {
      params: { size: UNPAGINATED_SIZE },
    });
    return { data: data.content || [] };
  },

  // POST /underwriter/claim/{id} assigns the caller as underwriter and sets
  // status to "Under Review" directly.
  claimApplicationAsUnderwriter: async (applicationId) => {
    const { data } = await axiosInstance.post(`/underwriter/claim/${applicationId}`);
    return { data };
  },

  // decision must be exactly "ACCEPTED"/"REJECTED" server-side; the UI works
  // with the shorter "ACCEPT"/"REJECT" values, so map them here.
  decideApplication: async (applicationId, decision, comments) => {
    const decisionMap = { ACCEPT: 'ACCEPTED', REJECT: 'REJECTED' };
    const { data } = await axiosInstance.post(`/underwriter/applications/${applicationId}/decision`, {
      decision: decisionMap[decision] || decision,
      comments,
    });
    return { data };
  },

  // The pool of unclaimed applications waiting for a processor — GET
  // /processor/work-list is hardcoded server-side to status "Submitted".
  getProcessorWorkList: async () => {
    const { data } = await axiosInstance.get('/processor/work-list', {
      params: { size: UNPAGINATED_SIZE },
    });
    return { data: data.content || [] };
  },

  // Applications this processor has already claimed. The backend forces
  // processorId to the caller's own id for anyone with the PROCESSOR role,
  // so this is automatically scoped to "my" applications regardless of
  // what (if anything) we pass here.
  getClaimedApplicationsForProcessor: async () => {
    const { data } = await axiosInstance.get('/loan-applications', {
      params: { size: UNPAGINATED_SIZE },
    });
    return { data: data.content || [] };
  },

  // POST /processor/claim/{id} already sets status to "Under Verification"
  // and assigns the caller as processor — no follow-up rename needed.
  claimApplication: async (applicationId) => {
    const { data } = await axiosInstance.post(`/processor/claim/${applicationId}`);
    return { data };
  },

  // POST /processor/applications/{id}/verify already resolves status to
  // "Verified" on success (and 400s, leaving status untouched, if required
  // documents aren't all individually VERIFIED) — no follow-up rename needed.
  verifyApplication: async (applicationId) => {
    const { data } = await axiosInstance.post(`/processor/applications/${applicationId}/verify`);
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
