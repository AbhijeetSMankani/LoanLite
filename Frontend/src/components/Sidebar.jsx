import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  ClipboardList,
  ShieldCheck,
  Gavel,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  Dashboard: LayoutDashboard,
  'Apply for Loan': FilePlus2,
  'My Applications': FileText,
  Applications: ClipboardList,
  'Document Verification': ShieldCheck,
  'Loan Decision': Gavel,
  'Audit Logs': History,
};

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
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
      { label: 'Audit Logs', path: '/admin/audit-logs' },
    ],
  };

  const items = navItems[userRole] || [];

  const navContent = (
    <nav className="mt-6 flex-1 overflow-y-auto px-3">
      {items.map((item) => {
        const Icon = ICONS[item.label] || LayoutDashboard;
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg text-sm font-medium transition-all duration-150 no-underline ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
            }`}
          >
            <Icon size={18} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gray-900 text-white h-full">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[80vw] bg-gray-900 text-white flex flex-col transform transition-transform duration-200 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-4 text-lg font-bold border-b border-gray-800">
          LoanLite
        </div>
        {navContent}
      </aside>
    </>
  );
};

export default Sidebar;
