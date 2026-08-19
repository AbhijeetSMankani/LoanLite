import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="bg-orange-600 text-white shadow-md px-6 h-16 flex items-center justify-between">
      {/* Logo */}
      <div className="text-2xl font-bold">LoanLite</div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-sm">
          <p className="font-semibold mb-1">{user?.name || user?.email}</p>
          <p className="text-xs text-orange-100 capitalize">{user?.role}</p>
        </div>

        {/* Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-10 h-10 bg-orange-500 rounded-full cursor-pointer font-bold hover:bg-orange-700"
          >
            {user?.name?.charAt(0) || 'U'}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl z-50">
              <p className="px-4 py-2 text-xs font-semibold border-b border-gray-200">
                {user?.email}
              </p>
              <button
                onClick={() => {
                  navigate('/profile');
                  setMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;