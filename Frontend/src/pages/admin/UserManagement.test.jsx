import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagement from './UserManagement';
import userService from '../../services/userService';

vi.mock('../../services/userService', () => ({
  default: { getAllUsers: vi.fn(), updateUserRole: vi.fn() },
}));

let mockCurrentUser = { id: 1, name: 'Admin One', email: 'admin@b.com', role: 'admin' };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

const userRow = (overrides = {}) => ({
  id: 2,
  firstName: 'Pat',
  lastName: 'Processor',
  email: 'pat@b.com',
  role: 'ROLE_USER',
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockCurrentUser = { id: 1, name: 'Admin One', email: 'admin@b.com', role: 'admin' };
});

describe('UserManagement — loading/empty states', () => {
  it('shows a loader before the fetch resolves', () => {
    userService.getAllUsers.mockImplementation(() => new Promise(() => {}));
    render(<UserManagement />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the empty state when there are no users', async () => {
    userService.getAllUsers.mockResolvedValueOnce({ data: [], totalPages: 1 });
    render(<UserManagement />);
    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });
});

describe('UserManagement — error state', () => {
  it('shows the backend error message on a failed fetch', async () => {
    userService.getAllUsers.mockRejectedValueOnce({ response: { data: { message: 'boom' } } });
    render(<UserManagement />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});

describe('UserManagement — self-role-change guard (mirrors the backend 400)', () => {
  it('disables role changes for the currently logged-in admin\'s own row', async () => {
    userService.getAllUsers.mockResolvedValueOnce({
      data: [{ id: 1, firstName: 'Admin', lastName: 'One', email: 'admin@b.com', role: 'ROLE_ADMIN' }],
      totalPages: 1,
    });
    render(<UserManagement />);

    expect(await screen.findByText("Can't change your own role")).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('UserManagement — role assignment', () => {
  it('disables Update until a different role is selected', async () => {
    userService.getAllUsers.mockResolvedValueOnce({ data: [userRow()], totalPages: 1 });
    render(<UserManagement />);
    await screen.findByText('Pat Processor');

    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  it('updates the role via PATCH /admin/users/{id}/role and shows a success message', async () => {
    const user = userEvent.setup();
    userService.getAllUsers.mockResolvedValueOnce({ data: [userRow()], totalPages: 1 });
    userService.updateUserRole.mockResolvedValueOnce({ data: { id: 2, role: 'ROLE_PROCESSOR' } });
    render(<UserManagement />);
    await screen.findByText('Pat Processor');

    await user.selectOptions(screen.getByRole('combobox'), 'ROLE_PROCESSOR');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(userService.updateUserRole).toHaveBeenCalledWith(2, 'ROLE_PROCESSOR');
    expect(await screen.findByText('Role updated')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Processor' })).toBeInTheDocument();
  });

  it('shows the backend error inline when the update is rejected (e.g. self-role edge case, unknown role)', async () => {
    const user = userEvent.setup();
    userService.getAllUsers.mockResolvedValueOnce({ data: [userRow()], totalPages: 1 });
    userService.updateUserRole.mockRejectedValueOnce({
      response: { data: { message: 'Unknown role: ROLE_BOGUS' } },
    });
    render(<UserManagement />);
    await screen.findByText('Pat Processor');

    await user.selectOptions(screen.getByRole('combobox'), 'ROLE_ADMIN');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(await screen.findByText('Unknown role: ROLE_BOGUS')).toBeInTheDocument();
  });
});

describe('UserManagement — large list rendering', () => {
  it('renders a full page (server page size 20) without error', async () => {
    const manyUsers = Array.from({ length: 20 }, (_, i) =>
      userRow({ id: i + 2, firstName: `User${i}`, lastName: 'Test', email: `user${i}@b.com` })
    );
    userService.getAllUsers.mockResolvedValueOnce({ data: manyUsers, totalPages: 5 });

    render(<UserManagement />);

    await screen.findByText('User0 Test');
    expect(screen.getAllByRole('row')).toHaveLength(21); // 20 data rows + 1 header row
  });
});

describe('UserManagement — pagination', () => {
  it('fetches the next page of users', async () => {
    const user = userEvent.setup();
    userService.getAllUsers.mockResolvedValueOnce({ data: [userRow({ id: 2 })], totalPages: 2 });
    render(<UserManagement />);
    await screen.findByText('Pat Processor');

    userService.getAllUsers.mockResolvedValueOnce({ data: [userRow({ id: 3, firstName: 'Uma', lastName: 'Underwriter' })], totalPages: 2 });
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(userService.getAllUsers).toHaveBeenCalledWith(2, 20));
    expect(await screen.findByText('Uma Underwriter')).toBeInTheDocument();
  });
});
