import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

// Pages
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import ApplicantDashboard from '../pages/applicant/Dashboard';
import ApplyLoan from '../pages/applicant/ApplyLoan';
import MyApplications from '../pages/applicant/MyApplications';
import ApplicationDetails from '../pages/applicant/ApplicationDetails';
import ProcessorDashboard from '../pages/processor/Dashboard';
import ProcessorApplications from '../pages/processor/Applications';
import DocumentVerification from '../pages/processor/DocumentVerification';
import UnderwriterDashboard from '../pages/underwriter/Dashboard';
import UnderwriterApplications from '../pages/underwriter/Applications';
import LoanDecision from '../pages/underwriter/LoanDecision';
import AdminDashboard from '../pages/admin/Dashboard';
import Users from '../pages/admin/Users';
import AuditLogs from '../pages/admin/AuditLogs';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, userRole, loading } = useAuth();

  if (loading) return <Loader fullScreen message="Loading..." />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Applicant Routes */}
      <Route
        path="/applicant/dashboard"
        element={
          <ProtectedRoute requiredRole="applicant">
            <ApplicantDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant/apply"
        element={
          <ProtectedRoute requiredRole="applicant">
            <ApplyLoan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant/my-applications"
        element={
          <ProtectedRoute requiredRole="applicant">
            <MyApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant/application/:id"
        element={
          <ProtectedRoute requiredRole="applicant">
            <ApplicationDetails />
          </ProtectedRoute>
        }
      />

      {/* Processor Routes */}
      <Route
        path="/processor/dashboard"
        element={
          <ProtectedRoute requiredRole="processor">
            <ProcessorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/processor/applications"
        element={
          <ProtectedRoute requiredRole="processor">
            <ProcessorApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/processor/document-verification"
        element={
          <ProtectedRoute requiredRole="processor">
            <DocumentVerification />
          </ProtectedRoute>
        }
      />

      {/* Underwriter Routes */}
      <Route
        path="/underwriter/dashboard"
        element={
          <ProtectedRoute requiredRole="underwriter">
            <UnderwriterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/underwriter/applications"
        element={
          <ProtectedRoute requiredRole="underwriter">
            <UnderwriterApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/underwriter/loan-decision/:id"
        element={
          <ProtectedRoute requiredRole="underwriter">
            <LoanDecision />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredRole="admin">
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="admin">
            <AuditLogs />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;