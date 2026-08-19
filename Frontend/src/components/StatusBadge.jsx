import React from 'react';

const StatusBadge = ({ status }) => {
  const statusClasses = {
    draft: 'bg-gray-200 text-gray-800',
    submitted: 'bg-blue-100 text-blue-800',
    'in-review': 'bg-yellow-100 text-yellow-800',
    'verified': 'bg-green-100 text-green-800',
    'pending-decision': 'bg-purple-100 text-purple-800',
    approved: 'bg-green-500 text-white',
    rejected: 'bg-red-500 text-white',
    referred: 'bg-orange-100 text-orange-800',
  };

  const displayText = {
    draft: 'Draft',
    submitted: 'Submitted',
    'in-review': 'In Review',
    'verified': 'Verified',
    'pending-decision': 'Pending Decision',
    approved: 'Approved',
    rejected: 'Rejected',
    referred: 'Referred',
  };

  const classes = statusClasses[status] || statusClasses.draft;
  const text = displayText[status] || status;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${classes}`}>
      {text}
    </span>
  );
};

export default StatusBadge;