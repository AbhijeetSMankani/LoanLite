import React, { useState, useEffect } from 'react';
import Loader from '../../components/Loader';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import userService from '../../services/userService';

const Users = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'processor',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [page]);

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
      alert('User created successfully!');
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
        alert('User deleted successfully!');
      } catch (err) {
        setError(err.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
            <p className="text-gray-600 mt-2">Create and manage system users</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Add New User
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 text-lg">No users found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Date Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                        user.role === 'admin' ? 'bg-red-500' :
                        user.role === 'underwriter' ? 'bg-purple-500' :
                        user.role === 'processor' ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => alert('Edit functionality coming soon')}
                        className="text-xs px-3 py-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-xs px-3 py-1"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {users.length > 0 && (
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
              disabled={users.length < 10}
            >
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
              <Button
                variant="primary"
                onClick={handleCreateUser}
              >
                Create User
              </Button>
            </>
          }
        >
          <div className="space-y-4">
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
              <label className="block text-gray-700 font-semibold mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Users;