import React from 'react';

const Input = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled = false,
  required = false,
  rows = 4,
  className = '',
  ...props
}) => {
  const fieldClassName = `w-full px-4 py-2.5 border rounded-lg text-sm transition-all duration-150 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
  } ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'} ${className}`;

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={name} className="block text-gray-700 font-semibold mb-1.5 text-sm">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={fieldClassName}
          {...props}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={fieldClassName}
          {...props}
        />
      )}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default Input;
