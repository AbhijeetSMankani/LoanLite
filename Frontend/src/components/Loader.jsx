import React from 'react';

const Loader = ({ message = 'Loading...', fullScreen = false }) => {
  const loaderContent = (
    <div className="flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full mb-4 animate-spin" />
      <p className="text-gray-600 font-medium text-sm">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-2xl">{loaderContent}</div>
      </div>
    );
  }

  return <div className="flex items-center justify-center py-16">{loaderContent}</div>;
};

export default Loader;
