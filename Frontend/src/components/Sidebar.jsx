import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { userRole, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const isActive = (path) => location.pathname.startsWith(path);

  const navItems = {
    applicant: [
      { label: 'Dashboard', path: '/applicant/dashboard' },
      { label: 'Apply for Loan', path: '/applicant/apply' },
      { label: 'My Applications', path: '/applicant/my-applications' },
    ],
    processor: [
      { label: 'Dashboard', path: '/processor/dashboard' },
      { label: 'Applications', path: '/processor/applications' },
      { label: 'Document Verification', path: '/processor/document-verification' },
    ],
    underwriter: [
      { label: 'Dashboard', path: '/underwriter/dashboard' },
      { label: 'Applications', path: '/underwriter/applications' },
      { label: 'Loan Decision', path: '/underwriter/loan-decision' },
    ],
    admin: [
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'Users', path: '/admin/users' },
      { label: 'Audit Logs', path: '/admin/audit-logs' },
    ],
  };

  const items = navItems[userRole] || [];

  return (
    <aside className="w-64 bg-gray-800 text-white h-full shadow-lg overflow-y-auto">
      <nav className="mt-8">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`block px-6 py-3 transition-all duration-200 cursor-pointer no-underline ${
              isActive(item.path)
                ? 'bg-orange-600 text-white border-l-4 border-yellow-300 pl-5 font-semibold'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;