import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoanDecision from './LoanDecision';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';

vi.mock('../../services/loanService', () => ({
  default: { getApplicationById: vi.fn(), getLoanRules: vi.fn(), decideApplication: vi.fn() },
}));
vi.mock('../../services/documentService', () => ({
  default: { getUploadedDocuments: vi.fn() },
}));

const baseApp = (overrides = {}) => ({
  id: 30,
  applicant: { firstName: 'A', lastName: 'B' },
  loanAmount: 400000,
  tenureMonths: 36,
  declaredIncome: 70000,
  ...overrides,
});

const baseRules = (overrides = {}) => ({
  creditScore: 720,
  incomeVerification: 'verified',
  debtToIncomeRatio: 12,
  recommendation: 'APPROVE',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/underwriter/loan-decision/30']}>
      <Routes>
        <Route path="/underwriter/loan-decision/:id" element={<LoanDecision />} />
        <Route path="/underwriter/applications" element={<div>Underwriter Applications Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  documentService.getUploadedDocuments.mockResolvedValue({ data: [], missingRequiredDocuments: [] });
});

describe('LoanDecision — loading and not-found', () => {
  it('shows a loader before data arrives', () => {
    loanService.getApplicationById.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "Application not found" when the fetch fails', async () => {
    loanService.getApplicationById.mockRejectedValueOnce(new Error('Network Error'));
    renderPage();
    expect(await screen.findByText('Application not found')).toBeInTheDocument();
  });
});

describe('LoanDecision — recommendation display', () => {
  it.each([
    ['APPROVE', 'Approved'],
    ['MANUAL_REVIEW', 'Manual Review'],
    ['REJECT', 'Rejected'],
  ])('renders recommendation %s with a styled label', async (recommendation, label) => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules({ recommendation }) });
    renderPage();

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('defaults to "Pending Decision" when no recommendation exists yet', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules({ recommendation: null }) });
    renderPage();

    expect(await screen.findByText('Pending Decision')).toBeInTheDocument();
  });
});

describe('LoanDecision — documents are read-only', () => {
  it('shows uploaded documents with their type label and no edit/verify actions', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [{ id: 1, fileName: 'aadhaar.pdf', documentType: 'ADDRESS_PROOF', verificationStatus: 'VERIFIED' }],
      missingRequiredDocuments: [],
    });
    renderPage();

    expect(await screen.findByText('aadhaar.pdf')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });
});

describe('LoanDecision — decision flow', () => {
  it('requires comments before the decision button is enabled', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules() });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Accept Application' })).toBeDisabled();
  });

  it('accepts the application, mapping the "ACCEPT" UI value through the service, then navigates back', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules() });
    loanService.decideApplication.mockResolvedValueOnce({ data: { id: 30, status: 'Accepted' } });
    renderPage();
    await screen.findByRole('button', { name: 'Accept Application' });

    await user.type(screen.getByPlaceholderText('Provide detailed comments about your decision'), 'Looks good.');
    await user.click(screen.getByRole('button', { name: 'Accept Application' }));

    expect(loanService.decideApplication).toHaveBeenCalledWith('30', 'ACCEPT', 'Looks good.');
    expect(await screen.findByText('Application accepted successfully.')).toBeInTheDocument();
    expect(await screen.findByText('Underwriter Applications Landed', {}, { timeout: 2500 })).toBeInTheDocument();
  });

  it('switches to Reject when that option is chosen', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules() });
    loanService.decideApplication.mockResolvedValueOnce({ data: { id: 30, status: 'Rejected' } });
    renderPage();
    await screen.findByRole('button', { name: 'Accept Application' });

    await user.click(screen.getByRole('radio', { name: 'Reject' }));
    await user.type(screen.getByPlaceholderText('Provide detailed comments about your decision'), 'Low credit score.');
    await user.click(screen.getByRole('button', { name: 'Reject Application' }));

    expect(loanService.decideApplication).toHaveBeenCalledWith('30', 'REJECT', 'Low credit score.');
  });

  it('shows the backend error and stays put when the decision is refused (e.g. not Under Review)', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    loanService.getLoanRules.mockResolvedValueOnce({ data: baseRules() });
    loanService.decideApplication.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Cannot record a decision: application must be Under Review' } },
    });
    renderPage();
    await screen.findByRole('button', { name: 'Accept Application' });

    await user.type(screen.getByPlaceholderText('Provide detailed comments about your decision'), 'x');
    await user.click(screen.getByRole('button', { name: 'Accept Application' }));

    expect(await screen.findByText('Cannot record a decision: application must be Under Review')).toBeInTheDocument();
  });
});
