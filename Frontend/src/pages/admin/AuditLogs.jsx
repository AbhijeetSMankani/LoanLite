import React, { useState, useEffect } from 'react';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import userService from '../../services/userService';

const AuditLogs = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAuditLogs();
  }, [page]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await userService.getAuditLogs(page, 20);
      setLogs(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
      // Mock data for demonstration
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

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Audit Logs</h1>
          <p className="text-gray-600 mt-2">System activity and user action history</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            Using demo data - {error}
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 text-lg">No audit logs found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Timestamp</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Action</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Target</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{log.user}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.target}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                        log.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-800 font-semibold">Page {page}</span>
            <Button
              variant="secondary"
              onClick={() => setPage(page + 1)}
              disabled={logs.length < 20}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;