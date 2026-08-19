import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  disabled = false, 
  className = '',
  ...props 
}) => {
  const variantClasses = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600',
    secondary: 'bg-gray-300 text-gray-800 hover:bg-gray-400',
    success: 'bg-green-500 text-white hover:bg-green-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    warning: 'bg-yellow-500 text-gray-800 hover:bg-yellow-600',
    outline: 'bg-transparent text-orange-500 border border-orange-500 hover:bg-orange-100',
  };

  const baseClasses = 'px-4 py-2 rounded font-semibold transition-all duration-200 cursor-pointer border-none text-sm';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const variantClass = variantClasses[variant] || variantClasses.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClass} ${disabledClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;