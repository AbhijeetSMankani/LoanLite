import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) => {
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-200',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-200',
    success: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-200',
    warning: 'bg-yellow-500 text-gray-900 hover:bg-yellow-600 focus-visible:ring-yellow-200',
    outline: 'bg-transparent text-primary-600 border border-primary-300 hover:bg-primary-50 focus-visible:ring-primary-100',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 border-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-4';
  const isDisabled = disabled || loading;
  const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  const variantClass = variantClasses[variant] || variantClasses.primary;
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${sizeClass} ${variantClass} ${disabledClass} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
