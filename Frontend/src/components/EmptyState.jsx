import React from 'react';
import { Inbox, AlertTriangle } from 'lucide-react';

const EmptyState = ({
  icon: Icon,
  title = 'Nothing here yet',
  message = '',
  action = null,
  variant = 'default',
}) => {
  const isError = variant === 'error';
  const ResolvedIcon = Icon || (isError ? AlertTriangle : Inbox);

  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
          isError ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
        }`}
      >
        <ResolvedIcon size={26} strokeWidth={1.75} />
      </div>
      <p className="text-gray-800 font-semibold text-base">{title}</p>
      {message && <p className="text-gray-500 text-sm mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
