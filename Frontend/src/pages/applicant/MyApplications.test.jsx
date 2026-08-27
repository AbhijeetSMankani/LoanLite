import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MyApplications from './MyApplications';
import loanService from '../../services/loanService';

vi.mock('../../services/loanService', () => ({
  default: { getMyApplications: vi.fn() },
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/applicant/my-applications']}>
      <Routes>
        <Route path="/applicant/my-applications" element={<MyApplications />} />
        <Route path="/applicant/apply" element={<div>Apply Page Landed</div>} />
        <Route path="/applicant/apply/:id" element={<div>Edit Page Landed</div>} />
        <Route path="/applicant/application/:id" element={<div>Application Details Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

const app = (overrides = {}) => ({
  id: 1,
  loanAmount: 100000,
  status: 'Submitted',
  createdAt: '2026-08-01T00:00:00',
  applicationHistory: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MyApplications — loading state', () => {
  it('shows a loader while the initial fetch is in flight', () => {
    loanService.getMyApplications.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('MyApplications — empty state', () => {
  it('shows the empty state with a call to action when there are no applications', async () => {
    loanService.getMyApplications.mockResolvedValueOnce({ data: [], totalPages: 1 });
    renderPage();

    expect(await screen.findByText('No applications found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Your First Application' })).toBeInTheDocument();
  });
});

describe('MyApplications — error state', () => {
  it('shows the error banner and falls back to the empty list', async () => {
    loanService.getMyApplications.mockRejectedValueOnce(new Error('Network Error'));
    renderPage();

    expect(await screen.findByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText('No applications found')).toBeInTheDocument();
  });
});

describe('MyApplications — table rendering and navigation', () => {
  it('renders application rows and navigates to details on View', async () => {
    const user = userEvent.setup();
    loanService.getMyApplications.mockResolvedValueOnce({ data: [app({ id: 42 })], totalPages: 1 });
    renderPage();

    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('₹100,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Application Details Landed')).toBeInTheDocument();
  });

  it('shows an Edit button only for Draft applications', async () => {
    loanService.getMyApplications.mockResolvedValueOnce({
      data: [app({ id: 1, status: 'Draft' }), app({ id: 2, status: 'Submitted' })],
      totalPages: 1,
    });
    renderPage();

    await screen.findByText('#1');
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
  });
});

describe('MyApplications — filtering', () => {
  it('filters by the derived display status, including "waiting for documents"', async () => {
    const user = userEvent.setup();
    const waitingApp = app({
      id: 5,
      status: 'Under Verification',
      applicationHistory: [{ action: 'DOCUMENTS_REQUESTED', createdAt: '2026-08-01T00:00:00' }],
    });
    loanService.getMyApplications.mockResolvedValueOnce({
      data: [app({ id: 1, status: 'Draft' }), waitingApp],
      totalPages: 1,
    });
    renderPage();
    await screen.findByText('#1');

    await user.click(screen.getByRole('button', { name: 'waiting for documents' }));

    expect(screen.queryByRole('cell', { name: '#1' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '#5' })).toBeInTheDocument();
  });
});

describe('MyApplications — "waiting for documents" alert', () => {
  it('shows a singular alert naming the one application waiting on the user', async () => {
    const user = userEvent.setup();
    const waitingApp = app({
      id: 9,
      status: 'Under Verification',
      applicationHistory: [{ action: 'DOCUMENTS_REQUESTED', createdAt: '2026-08-01T00:00:00' }],
    });
    loanService.getMyApplications.mockResolvedValueOnce({ data: [waitingApp], totalPages: 1 });
    renderPage();

    expect(await screen.findByText('An application is waiting on you')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '#9' }));
    expect(await screen.findByText('Application Details Landed')).toBeInTheDocument();
  });

  it('shows a plural alert naming multiple applications waiting on the user', async () => {
    const waitingApp = (id) =>
      app({ id, status: 'Under Verification', applicationHistory: [{ action: 'DOCUMENTS_REQUESTED', createdAt: '2026-08-01T00:00:00' }] });
    loanService.getMyApplications.mockResolvedValueOnce({ data: [waitingApp(1), waitingApp(2)], totalPages: 1 });
    renderPage();

    expect(await screen.findByText('2 applications are waiting on you')).toBeInTheDocument();
  });

  it('shows no alert when no application is waiting on documents', async () => {
    loanService.getMyApplications.mockResolvedValueOnce({ data: [app({ id: 1 })], totalPages: 1 });
    renderPage();
    await screen.findByText('#1');

    expect(screen.queryByText(/waiting on you/)).not.toBeInTheDocument();
  });
});

describe('MyApplications — pagination', () => {
  it('disables Previous on page 1 and fetches page 2 on Next', async () => {
    const user = userEvent.setup();
    loanService.getMyApplications.mockResolvedValueOnce({ data: [app({ id: 1 })], totalPages: 3 });
    renderPage();
    await screen.findByText('#1');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    loanService.getMyApplications.mockResolvedValueOnce({ data: [app({ id: 2 })], totalPages: 3 });
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(loanService.getMyApplications).toHaveBeenCalledWith(2, 10));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
  });

  it('disables Next on the last page', async () => {
    loanService.getMyApplications.mockResolvedValueOnce({ data: [app({ id: 1 })], totalPages: 1 });
    renderPage();
    await screen.findByText('#1');

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
