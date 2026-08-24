import React, { useState, useEffect } from 'react';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import userService from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { fullName } from '../../utils/role';
import { Users } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'ROLE_USER', label: 'Applicant' },
  { value: 'ROLE_PROCESSOR', label: 'Processor' },
  { value: 'ROLE_UNDERWRITER', label: 'Underwriter' },
  { value: 'ROLE_ADMIN', label: 'Admin' },
];

const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role;

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingRoles, setPendingRoles] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [rowMessages, setRowMessages] = useState({});

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await userService.getAllUsers(page, 20);
      setUsers(response.data || []);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleRoleSelect = (userId, role) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const handleUpdateRole = async (targetUser) => {
    const newRole = pendingRoles[targetUser.id];
    if (!newRole || newRole === targetUser.role) return;

    try {
      setSavingId(targetUser.id);
      setRowMessages((prev) => ({ ...prev, [targetUser.id]: null }));
      const { data: updated } = await userService.updateUserRole(targetUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: updated.role } : u)));
      setRowMessages((prev) => ({ ...prev, [targetUser.id]: { type: 'success', text: 'Role updated' } }));
    } catch (err) {
      setRowMessages((prev) => ({
        ...prev,
        [targetUser.id]: { type: 'error', text: err.response?.data?.message || 'Failed to update role' },
      }));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500 mt-1">Assign processor, underwriter, or admin access to a user</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {users.length === 0 ? (
            <EmptyState icon={Users} title="No users found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assign Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const selected = pendingRoles[u.id] ?? u.role;
                    const message = rowMessages[u.id];
                    return (
                      <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">{fullName(u)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-800">{roleLabel(u.role)}</td>
                        <td className="px-6 py-4 text-sm">
                          {isSelf ? (
                            <span className="text-xs text-gray-400">Can't change your own role</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={selected}
                                onChange={(e) => handleRoleSelect(u.id, e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all"
                              >
                                {ROLE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={savingId === u.id}
                                disabled={selected === u.role}
                                onClick={() => handleUpdateRole(u)}
                              >
                                Update
                              </Button>
                              {message && (
                                <span
                                  className={`text-xs font-medium ${
                                    message.type === 'success' ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {message.text}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {users.length > 0 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-700 font-semibold text-sm">Page {page}</span>
            <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
