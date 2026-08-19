import React from 'react';

const StatCard = ({ title, value, color = 'bg-blue-500' }) => {
  const colorClasses = {
    'bg-blue-500': 'bg-blue-500',
    'bg-green-500': 'bg-green-500',
    'bg-red-500': 'bg-red-500',
    'bg-yellow-500': 'bg-yellow-500',
    'bg-purple-500': 'bg-purple-500',
    'bg-orange-500': 'bg-orange-500',
    'bg-gray-500': 'bg-gray-500',
  };

  const bgColor = colorClasses[color] || colorClasses['bg-blue-500'];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-xs font-semibold mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`${bgColor} rounded-lg w-12 h-12 flex items-center justify-center text-2xl flex-shrink-0`}>📊</div>
      </div>
    </div>
  );
};

export default StatCard;