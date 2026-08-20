import React from 'react';
import {
  Layers,
  FileEdit,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Users,
  FileText,
} from 'lucide-react';

const VARIANTS = {
  total: { bg: 'bg-blue-50', text: 'text-blue-600', icon: Layers },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600', icon: FileEdit },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', icon: Clock },
  info: { bg: 'bg-sky-50', text: 'text-sky-600', icon: RefreshCw },
  success: { bg: 'bg-green-50', text: 'text-green-600', icon: CheckCircle2 },
  danger: { bg: 'bg-red-50', text: 'text-red-600', icon: XCircle },
  primary: { bg: 'bg-primary-50', text: 'text-primary-600', icon: FileText },
  users: { bg: 'bg-purple-50', text: 'text-purple-600', icon: Users },
};

const StatCard = ({ title, value, variant = 'total', icon: IconOverride }) => {
  const { bg, text, icon: DefaultIcon } = VARIANTS[variant] || VARIANTS.total;
  const Icon = IconOverride || DefaultIcon;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1 truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`${bg} ${text} rounded-lg w-12 h-12 flex items-center justify-center shrink-0`}>
          <Icon size={22} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
