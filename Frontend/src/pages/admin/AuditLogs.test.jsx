import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogs from './AuditLogs';
import userService from '../../services/userService';

vi.mock('../../services/userService', () => ({
  default: { getAuditLogs: vi.fn() },
}));

const log = (overrides = {}) => ({
  id: 1,
  user: 'Ada Lovelace',
  action: 'SUBMITTED',
  target: 'Application #7',
  timestamp: '2026-08-01T10:00:00',
  status: 'success',
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AuditLogs — loading state', () => {
  it('shows a loader before the first fetch resolves', () => {
    userService.getAuditLogs.mockImplementation(() => new Promise(() => {}));
    render(<AuditLogs />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('AuditLogs — empty state', () => {
  it('shows the empty state when there are no logs', async () => {
    userService.getAuditLogs.mockResolvedValueOnce({ data: [], totalPages: 1 });
    render(<AuditLogs />);
    expect(await screen.findByText('No audit logs found')).toBeInTheDocument();
  });
});

describe('AuditLogs — error state (no more fake fallback data)', () => {
  it('shows the real error message and an empty table instead of hardcoded demo rows', async () => {
    userService.getAuditLogs.mockRejectedValueOnce(new Error('Network Error'));
    render(<AuditLogs />);

    expect(await screen.findByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    // These used to be hardcoded fallback rows shown on any error — must be gone.
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing demo data/)).not.toBeInTheDocument();
  });
});

describe('AuditLogs — rendering and filtering', () => {
  it('renders log rows with user/action/target/status', async () => {
    userService.getAuditLogs.mockResolvedValueOnce({ data: [log()], totalPages: 1 });
    render(<AuditLogs />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getByText('Application #7')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('filters logs by status', async () => {
    const user = userEvent.setup();
    userService.getAuditLogs.mockResolvedValueOnce({
      data: [log({ id: 1, user: 'Success User', status: 'success' }), log({ id: 2, user: 'Failed User', status: 'failed' })],
      totalPages: 1,
    });
    render(<AuditLogs />);
    await screen.findByText('Success User');

    await user.click(screen.getByRole('button', { name: 'failed' }));

    expect(screen.queryByText('Success User')).not.toBeInTheDocument();
    expect(screen.getByText('Failed User')).toBeInTheDocument();
  });
});

describe('AuditLogs — pagination', () => {
  it('disables Next on the last page and fetches the next page otherwise', async () => {
    const user = userEvent.setup();
    userService.getAuditLogs.mockResolvedValueOnce({ data: [log({ id: 1 })], totalPages: 2 });
    render(<AuditLogs />);
    await screen.findByText('Ada Lovelace');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    userService.getAuditLogs.mockResolvedValueOnce({ data: [log({ id: 2 })], totalPages: 2 });
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(userService.getAuditLogs).toHaveBeenCalledWith(2, 20));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
