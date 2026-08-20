import React, { useState, useEffect } from 'react';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import userService from '../../services/userService';
import { History } from 'lucide-react';

const FILTERS = ['all', 'success', 'failed'];

const AuditLogs = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await userService.getAuditLogs(page, 20);
      setLogs(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
      setLogs([
        {
          id: 1,
          user: 'John Doe',
          action: 'Application Submitted',
          target: 'Application #123',
          timestamp: new Date(),
          status: 'success',
        },
        {
          id: 2,
          user: 'Jane Smith',
          action: 'Document Verified',
          target: 'Document #456',
          timestamp: new Date(Date.now() - 3600000),
          status: 'success',
        },
        {
          id: 3,
          user: 'Admin User',
          action: 'User Created',
          target: 'User: processor@example.com',
          timestamp: new Date(Date.now() - 7200000),
          status: 'success',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.status === filter);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">System activity and user action history</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
            Showing demo data &mdash; {error}
          </div>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors whitespace-nowrap ${
                filter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredLogs.length === 0 ? (
            <EmptyState icon={History} title="No audit logs found" message="Nothing matches this filter yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{log.user}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.target}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                            log.status === 'success' ? 'bg-green-600' : 'bg-red-600'
                          }`}
                        >
                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredLogs.length > 0 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-700 font-semibold text-sm">Page {page}</span>
            <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={logs.length < 20}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
