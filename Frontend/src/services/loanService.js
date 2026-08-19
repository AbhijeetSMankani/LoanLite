import axiosInstance from '../api/axiosInstance';

// Mock loan applications data
const MOCK_APPLICATIONS = [
  {
    id: '1',
    applicantId: '1',
    loanAmount: 50000,
    loanTerm: 24,
    purpose: 'Home Renovation',
    income: 75000,
    employmentStatus: 'Employed',
    status: 'approved',
    createdAt: '2026-08-01',
    documents: [
      { id: '1', name: 'ID Proof', type: 'pdf', status: 'verified' },
      { id: '2', name: 'Income Certificate', type: 'pdf', status: 'verified' }
    ]
  },
  {
    id: '2',
    applicantId: '1',
    loanAmount: 30000,
    loanTerm: 18,
    purpose: 'Car Purchase',
    income: 75000,
    employmentStatus: 'Employed',
    status: 'submitted',
    createdAt: '2026-08-05',
    documents: [
      { id: '3', name: 'ID Proof', type: 'pdf', status: 'pending' }
    ]
  },
  {
    id: '3',
    applicantId: '1',
    loanAmount: 15000,
    loanTerm: 12,
    purpose: 'Personal Expenses',
    income: 75000,
    employmentStatus: 'Employed',
    status: 'draft',
    createdAt: '2026-08-10',
    documents: []
  },
  {
    id: '4',
    applicantId: '1',
    loanAmount: 100000,
    loanTerm: 36,
    purpose: 'Business Investment',
    income: 75000,
    employmentStatus: 'Employed',
    status: 'rejected',
    createdAt: '2026-07-20',
    documents: [
      { id: '5', name: 'Business Plan', type: 'pdf', status: 'rejected' }
    ]
  },
  {
    id: '5',
    applicantId: '2',
    loanAmount: 75000,
    loanTerm: 24,
    purpose: 'Education',
    income: 85000,
    employmentStatus: 'Employed',
    status: 'in-review',
    createdAt: '2026-08-08',
    documents: [
      { id: '6', name: 'College Admission', type: 'pdf', status: 'verified' }
    ]
  },
  {
    id: '6',
    applicantId: '3',
    loanAmount: 120000,
    loanTerm: 48,
    purpose: 'Property Purchase',
    income: 120000,
    employmentStatus: 'Employed',
    status: 'pending-decision',
    createdAt: '2026-08-03',
    documents: [
      { id: '7', name: 'Property Deed', type: 'pdf', status: 'verified' },
      { id: '8', name: 'Bank Statement', type: 'pdf', status: 'verified' }
    ]
  }
];

const loanService = {
  // Create a new loan application
  createApplication: async (applicationData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newApp = {
          id: Date.now().toString(),
          applicantId: '1',
          ...applicationData,
          status: applicationData.status || 'draft',
          createdAt: new Date().toISOString().split('T')[0],
          documents: []
        };
        MOCK_APPLICATIONS.push(newApp);
        resolve({ data: newApp });
      }, 300);
    });
  },

  // Get all applications for the current user
  getMyApplications: async (page = 1, limit = 10) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const userApps = MOCK_APPLICATIONS.filter(app => app.applicantId === '1');
        const paginated = userApps.slice((page - 1) * limit, page * limit);
        resolve({ data: paginated });
      }, 300);
    });
  },

  // Get single application details
  getApplicationById: async (applicationId) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const app = MOCK_APPLICATIONS.find(a => a.id === applicationId);
        if (app) {
          resolve({ data: app });
        } else {
          reject(new Error('Application not found'));
        }
      }, 300);
    });
  },

  // Update application (save draft)
  updateApplication: async (applicationId, data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = MOCK_APPLICATIONS.find(a => a.id === applicationId);
        if (app) {
          Object.assign(app, data);
        }
        resolve({ data: app });
      }, 300);
    });
  },

  // Submit application
  submitApplication: async (applicationId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = MOCK_APPLICATIONS.find(a => a.id === applicationId);
        if (app) {
          app.status = 'submitted';
        }
        resolve({ data: app });
      }, 300);
    });
  },

  // Get applications for processor
  getApplicationsForProcessor: async (page = 1, limit = 10) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const processorApps = MOCK_APPLICATIONS.filter(app => 
          ['submitted', 'in-review'].includes(app.status)
        );
        const paginated = processorApps.slice((page - 1) * limit, page * limit);
        resolve({ data: paginated });
      }, 300);
    });
  },

  // Get applications for underwriter
  getApplicationsForUnderwriter: async (page = 1, limit = 10) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const underwriterApps = MOCK_APPLICATIONS.filter(app =>
          ['in-review', 'pending-decision'].includes(app.status)
        );
        const paginated = underwriterApps.slice((page - 1) * limit, page * limit);
        resolve({ data: paginated });
      }, 300);
    });
  },

  // Submit verification by processor
  submitVerification: async (applicationId, verificationData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = MOCK_APPLICATIONS.find(a => a.id === applicationId);
        if (app) {
          app.status = 'in-review';
        }
        resolve({ data: app });
      }, 300);
    });
  },

  // Make final decision by underwriter
  makeDecision: async (applicationId, decisionData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = MOCK_APPLICATIONS.find(a => a.id === applicationId);
        if (app) {
          app.status = decisionData.decision;
        }
        resolve({ data: app });
      }, 300);
    });
  },

  // Get loan rules/suggestions
  getLoanRules: async (applicationId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: {
            creditScore: 750,
            incomeVerification: 'verified',
            debtToIncomeRatio: 0.35,
            recommendation: 'APPROVE'
          }
        });
      }, 300);
    });
  },
};

export default loanService;