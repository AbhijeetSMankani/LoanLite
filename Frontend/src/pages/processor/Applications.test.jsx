import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProcessorApplications from './Applications';
import loanService from '../../services/loanService';

vi.mock('../../services/loanService', () => ({
  default: { getProcessorWorkList: vi.fn(), getClaimedApplicationsForProcessor: vi.fn(), claimApplication: vi.fn() },
}));

const app = (overrides = {}) => ({
  id: 1,
  applicant: { firstName: 'A', lastName: 'B' },
  loanAmount: 100000,
  status: 'Submitted',
  createdAt: '2026-08-01T00:00:00',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/processor/applications']}>
      <Routes>
        <Route path="/processor/applications" element={<ProcessorApplications />} />
        <Route path="/processor/document-verification" element={<div>Document Verification Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Processor Applications — work list only shows Submitted applications (backend-scoped)', () => {
  it('shows the Available tab (work-list) by default with its count', async () => {
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [app({ id: 1 }), app({ id: 2 })] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(await screen.findByText('Available (2)')).toBeInTheDocument();
    expect(screen.getByText('My Queue (0)')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to claim', async () => {
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(await screen.findByText('No applications waiting')).toBeInTheDocument();
  });
});

describe('Processor Applications — claim flow', () => {
  it('claims an application, moves to My Queue, and refreshes both lists', async () => {
    const user = userEvent.setup();
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [app({ id: 1 })] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({ data: [] });
    loanService.claimApplication.mockResolvedValueOnce({ data: app({ id: 1, status: 'Under Verification' }) });
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({
      data: [app({ id: 1, status: 'Under Verification' })],
    });
    renderPage();
    await screen.findByText('Available (1)');

    await user.click(screen.getByRole('button', { name: 'Claim' }));

    expect(loanService.claimApplication).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByText('My Queue (1)')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it('shows a conflict message when another processor claims it first (409)', async () => {
    const user = userEvent.setup();
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [app({ id: 1 })] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({ data: [] });
    loanService.claimApplication.mockRejectedValueOnce({
      response: { status: 409, data: { status: 'Under Verification' } },
    });
    renderPage();
    await screen.findByText('Available (1)');

    await user.click(screen.getByRole('button', { name: 'Claim' }));

    expect(
      await screen.findByText('Failed to claim application — it may already be claimed.')
    ).toBeInTheDocument();
  });

  it('navigates to Document Verification from the My Queue tab', async () => {
    const user = userEvent.setup();
    loanService.getProcessorWorkList.mockResolvedValueOnce({ data: [] });
    loanService.getClaimedApplicationsForProcessor.mockResolvedValueOnce({
      data: [app({ id: 5, status: 'Under Verification' })],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'My Queue (1)' }));

    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(await screen.findByText('Document Verification Landed')).toBeInTheDocument();
  });
});
