import React from 'react';

const Loader = ({ message = 'Loading...', fullScreen = false }) => {
  const loaderContent = (
    <div className="flex flex-col items-center justify-center">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <div className="w-12 h-12 border-2 border-orange-500 border-b-transparent rounded-full mb-4 animate-spin-custom"></div>
      <p className="text-gray-600 font-semibold">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-2xl">
          {loaderContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {loaderContent}
    </div>
  );
};

export default Loader;