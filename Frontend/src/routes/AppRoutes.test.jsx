import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';

// This file tests routing/access-guard behavior only — every page is
// replaced with a one-line marker so a page's own data fetching/rendering
// (covered in its own test file) can't leak in as noise here.
let mockAuth = { isAuthenticated: false, userRole: null, loading: false };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../pages/Landing', () => ({ default: () => <div>Landing</div> }));
vi.mock('../pages/Unauthorized', () => ({ default: () => <div>Unauthorized</div> }));
vi.mock('../pages/auth/Login', () => ({ default: () => <div>Login</div> }));
vi.mock('../pages/auth/Signup', () => ({ default: () => <div>Signup</div> }));
vi.mock('../pages/applicant/Dashboard', () => ({ default: () => <div>Applicant Dashboard</div> }));
vi.mock('../pages/applicant/ApplyLoan', () => ({ default: () => <div>Apply</div> }));
vi.mock('../pages/applicant/MyApplications', () => ({ default: () => <div>My Applications</div> }));
vi.mock('../pages/applicant/ApplicationDetails', () => ({ default: () => <div>Application Details</div> }));
vi.mock('../pages/processor/Dashboard', () => ({ default: () => <div>Processor Dashboard</div> }));
vi.mock('../pages/processor/Applications', () => ({ default: () => <div>Processor Applications</div> }));
vi.mock('../pages/processor/DocumentVerification', () => ({ default: () => <div>Document Verification</div> }));
vi.mock('../pages/underwriter/Dashboard', () => ({ default: () => <div>Underwriter Dashboard</div> }));
vi.mock('../pages/underwriter/Applications', () => ({ default: () => <div>Underwriter Applications</div> }));
vi.mock('../pages/underwriter/LoanDecision', () => ({ default: () => <div>Loan Decision</div> }));
vi.mock('../pages/admin/Dashboard', () => ({ default: () => <div>Admin Dashboard</div> }));
vi.mock('../pages/admin/AuditLogs', () => ({ default: () => <div>Audit Logs</div> }));
vi.mock('../pages/admin/UserManagement', () => ({ default: () => <div>User Management</div> }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );

beforeEach(() => {
  mockAuth = { isAuthenticated: false, userRole: null, loading: false };
});

describe('AppRoutes — unauthenticated access is blocked', () => {
  it('redirects an unauthenticated visitor away from a protected applicant route to /login', () => {
    renderAt('/applicant/dashboard');
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor away from a protected admin route to /login', () => {
    renderAt('/admin/users');
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor away from a protected processor route to /login', () => {
    renderAt('/processor/document-verification');
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});

describe('AppRoutes — role restrictions', () => {
  it('redirects a processor trying to reach an admin-only route to /unauthorized', () => {
    mockAuth = { isAuthenticated: true, userRole: 'processor', loading: false };
    renderAt('/admin/users');
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('redirects an applicant trying to reach a processor-only route to /unauthorized', () => {
    mockAuth = { isAuthenticated: true, userRole: 'applicant', loading: false };
    renderAt('/processor/applications');
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('redirects an underwriter trying to reach an applicant-only route to /unauthorized', () => {
    mockAuth = { isAuthenticated: true, userRole: 'underwriter', loading: false };
    renderAt('/applicant/apply');
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('lets a user with the matching role reach their own route', () => {
    mockAuth = { isAuthenticated: true, userRole: 'admin', loading: false };
    renderAt('/admin/users');
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });

  it('lets an edit-mode applicant route through with an :id param', () => {
    mockAuth = { isAuthenticated: true, userRole: 'applicant', loading: false };
    renderAt('/applicant/apply/42');
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });
});

describe('AppRoutes — public routes redirect once authenticated', () => {
  it('redirects an already-authenticated applicant away from /login to their dashboard', () => {
    mockAuth = { isAuthenticated: true, userRole: 'applicant', loading: false };
    renderAt('/login');
    expect(screen.getByText('Applicant Dashboard')).toBeInTheDocument();
  });

  it('redirects an already-authenticated admin away from /signup to their dashboard', () => {
    mockAuth = { isAuthenticated: true, userRole: 'admin', loading: false };
    renderAt('/signup');
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});

describe('AppRoutes — loading state', () => {
  it('shows a loader instead of content while the session check is in flight', () => {
    mockAuth = { isAuthenticated: false, userRole: null, loading: true };
    renderAt('/applicant/dashboard');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('AppRoutes — unknown paths', () => {
  it('redirects an unknown path to the landing page for a guest', () => {
    renderAt('/this-route-does-not-exist');
    expect(screen.getByText('Landing')).toBeInTheDocument();
  });
});
