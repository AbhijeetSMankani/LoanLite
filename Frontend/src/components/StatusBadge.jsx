import React from 'react';

const STATUS_MAP = {
  draft: { classes: 'bg-gray-200 text-gray-700', label: 'Draft' },
  pending: { classes: 'bg-amber-100 text-amber-700', label: 'Pending' },
  submitted: { classes: 'bg-blue-100 text-blue-700', label: 'Submitted' },
  'in-review': { classes: 'bg-amber-100 text-amber-700', label: 'In Review' },
  'under verification': { classes: 'bg-amber-100 text-amber-700', label: 'Under Verification' },
  'waiting for documents': { classes: 'bg-orange-100 text-orange-700', label: 'Waiting for Documents' },
  verified: { classes: 'bg-teal-100 text-teal-700', label: 'Verified' },
  'under review': { classes: 'bg-purple-100 text-purple-700', label: 'Under Review' },
  'pending-decision': { classes: 'bg-purple-100 text-purple-700', label: 'Pending Decision' },
  accepted: { classes: 'bg-green-600 text-white', label: 'Accepted' },
  approved: { classes: 'bg-green-600 text-white', label: 'Approved' },
  approve: { classes: 'bg-green-600 text-white', label: 'Approved' },
  rejected: { classes: 'bg-red-600 text-white', label: 'Rejected' },
  reject: { classes: 'bg-red-600 text-white', label: 'Rejected' },
  referred: { classes: 'bg-primary-100 text-primary-700', label: 'Referred' },
  refer: { classes: 'bg-primary-100 text-primary-700', label: 'Refer Back' },
  withdrawn: { classes: 'bg-gray-200 text-gray-600', label: 'Withdrawn' },
};

const StatusBadge = ({ status }) => {
  const key = typeof status === 'string' ? status.toLowerCase() : status;
  const entry = STATUS_MAP[key] || { classes: 'bg-gray-200 text-gray-700', label: status || 'Unknown' };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block whitespace-nowrap ${entry.classes}`}>
      {entry.label}
    </span>
  );
};

export default StatusBadge;
