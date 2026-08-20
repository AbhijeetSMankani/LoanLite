import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, User as UserIcon, Landmark } from 'lucide-react';

const Navbar = ({ onMenuClick = () => {} }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="bg-primary-600 text-white shadow-md px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden -ml-1 p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 text-xl font-bold">
          <Landmark size={22} className="hidden sm:block" />
          LoanLite
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-sm text-right">
          <p className="font-semibold leading-tight">{user?.name || user?.email}</p>
          <p className="text-xs text-orange-100 capitalize leading-tight">{user?.role}</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-10 h-10 bg-white/15 rounded-full font-bold hover:bg-white/25 transition-colors"
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white text-gray-800 rounded-lg shadow-xl z-20 overflow-hidden border border-gray-100 animate-fadeIn">
                <p className="px-4 py-3 text-xs font-semibold border-b border-gray-100 truncate text-gray-500">
                  {user?.email}
                </p>
                <button
                  onClick={() => {
                    navigate('/profile');
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  <UserIcon size={16} /> Profile
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
