import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <Loader fullScreen message="Loading..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-screen">
        <AppRoutes />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-100">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 min-h-0 w-full">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
