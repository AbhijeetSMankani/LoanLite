import React, { useState, useEffect } from 'react';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import EmptyState from '../../components/EmptyState';
import userService from '../../services/userService';
import { UserPlus, Users as UsersIcon } from 'lucide-react';

const ROLE_STYLES = {
  admin: 'bg-red-500',
  underwriter: 'bg-purple-500',
  processor: 'bg-blue-500',
  applicant: 'bg-green-500',
};

const selectClass =
  'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all';

const Users = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'processor', password: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers(page, 10);
      setUsers(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await userService.createUser(newUser);
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', role: 'processor', password: '' });
      await fetchUsers();
      setSuccess('User created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        setLoading(true);
        await userService.deleteUser(userId);
        await fetchUsers();
        setSuccess('User deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError(err.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 mt-1">Create and manage system users</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={16} /> Add New User
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {users.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No users found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                            ROLE_STYLES[user.role] || 'bg-gray-500'
                          }`}
                        >
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" disabled title="Coming soon">
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteUser(user.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <Button variant="secondary" onClick={() => setPage(page + 1)} disabled={users.length < 10}>
              Next
            </Button>
          </div>
        )}

        {/* Create User Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewUser({ name: '', email: '', role: 'processor', password: '' });
          }}
          title="Create New User"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({ name: '', email: '', role: 'processor', password: '' });
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateUser}>
                Create User
              </Button>
            </>
          }
        >
          <Input
            label="Name"
            name="name"
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="Enter user name"
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="Enter email"
            required
          />
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-1.5 text-sm">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className={selectClass}
            >
              <option value="processor">Processor</option>
              <option value="underwriter">Underwriter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Input
            label="Password"
            name="password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Enter password"
            required
          />
        </Modal>
      </div>
    </div>
  );
};

export default Users;
