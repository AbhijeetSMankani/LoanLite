import React from 'react';

const Card = ({ children, className = '', padded = true, ...props }) => {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padded ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
