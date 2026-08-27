import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ApplyLoan from './ApplyLoan';
import loanService from '../../services/loanService';

vi.mock('../../services/loanService', () => ({
  default: {
    createApplication: vi.fn(),
    updateDraftApplication: vi.fn(),
    submitApplication: vi.fn(),
    getApplicationById: vi.fn(),
  },
}));

const renderApplyLoan = (path = '/applicant/apply') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/applicant/apply" element={<ApplyLoan />} />
        <Route path="/applicant/apply/:id" element={<ApplyLoan />} />
        <Route path="/applicant/my-applications" element={<div>My Applications Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApplyLoan — wizard navigation', () => {
  it('blocks advancing from step 1 when required fields are empty', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Please fill in all fields')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loan Details' })).toBeInTheDocument();
  });

  it('advances to Income Details once amount and term are filled', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.type(screen.getByLabelText(/^Loan Amount/), '200000');
    await user.selectOptions(screen.getByRole('combobox'), '24');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Income Details' })).toBeInTheDocument();
  });
});

describe('ApplyLoan — loan amount validation', () => {
  it('shows an inline "limit exceeded" error live as soon as the amount exceeds 2,500,000', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.type(screen.getByLabelText(/^Loan Amount/), '3000000');

    expect(await screen.findByText(/Limit exceeded/i)).toBeInTheDocument();
  });

  it('blocks advancing past step 1 while the amount exceeds the limit', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.type(screen.getByLabelText(/^Loan Amount/), '3000000');
    await user.selectOptions(screen.getByRole('combobox'), '24');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Loan Details' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Income Details' })).not.toBeInTheDocument();
  });

  it('shows a minimum-amount error for an amount below 50,000', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.type(screen.getByLabelText(/^Loan Amount/), '1000');

    expect(await screen.findByText(/Minimum loan amount/i)).toBeInTheDocument();
  });
});

describe('ApplyLoan — Save as Draft only offered on the Review step', () => {
  it('does not show Save as Draft on step 1 or step 2', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    expect(screen.queryByRole('button', { name: 'Save as Draft' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Loan Amount/), '200000');
    await user.selectOptions(screen.getByRole('combobox'), '24');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Income Details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as Draft' })).not.toBeInTheDocument();
  });

  it('shows Save as Draft once every field (including income) is filled on the Review step', async () => {
    const user = userEvent.setup();
    renderApplyLoan();

    await user.type(screen.getByLabelText(/^Loan Amount/), '200000');
    await user.selectOptions(screen.getByRole('combobox'), '24');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByLabelText(/^Monthly Income/), '50000');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Review Your Application')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeInTheDocument();
  });
});

describe('ApplyLoan — submit flow', () => {
  const fillAndReachReview = async (user) => {
    await user.type(screen.getByLabelText(/^Loan Amount/), '200000');
    await user.selectOptions(screen.getByRole('combobox'), '24');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByLabelText(/^Monthly Income/), '50000');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Review Your Application');
  };

  it('creates the application then submits it, and navigates to My Applications', async () => {
    const user = userEvent.setup();
    loanService.createApplication.mockResolvedValueOnce({ data: { id: 77, status: 'Draft' } });
    loanService.submitApplication.mockResolvedValueOnce({ data: { id: 77, status: 'Submitted' } });
    renderApplyLoan();
    await fillAndReachReview(user);

    await user.click(screen.getByRole('button', { name: 'Submit Application' }));

    await waitFor(() => expect(loanService.submitApplication).toHaveBeenCalledWith(77));
    expect(loanService.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ loanAmount: '200000', loanTerm: '24', income: '50000' })
    );
    // Navigation fires from a 1500ms setTimeout after the success message — wait past that.
    expect(await screen.findByText('My Applications Landed', {}, { timeout: 2500 })).toBeInTheDocument();
  });

  it('shows the backend validation error and does not navigate on a 400', async () => {
    const user = userEvent.setup();
    loanService.createApplication.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'declaredIncome must be greater than 0' } },
    });
    renderApplyLoan();
    await fillAndReachReview(user);

    await user.click(screen.getByRole('button', { name: 'Submit Application' }));

    expect(await screen.findByText('declaredIncome must be greater than 0')).toBeInTheDocument();
    expect(loanService.submitApplication).not.toHaveBeenCalled();
  });
});

describe('ApplyLoan — edit mode (Draft only)', () => {
  it('prefills the form from an existing Draft application', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({
      data: { id: 5, status: 'Draft', loanAmount: 150000, tenureMonths: 36, declaredIncome: 40000 },
    });
    renderApplyLoan('/applicant/apply/5');

    expect(await screen.findByText('Edit Your Draft Application')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Loan Amount/)).toHaveValue(150000);
  });

  it('refuses to edit an application that has left Draft status', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({
      data: { id: 5, status: 'Submitted', loanAmount: 150000, tenureMonths: 36, declaredIncome: 40000 },
    });
    renderApplyLoan('/applicant/apply/5');

    expect(await screen.findByText(/can no longer be edited/i)).toBeInTheDocument();
  });

  it('saves via updateDraftApplication (not createApplication) when editing', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({
      data: { id: 5, status: 'Draft', loanAmount: 150000, tenureMonths: 36, declaredIncome: 40000 },
    });
    loanService.updateDraftApplication.mockResolvedValueOnce({ data: { id: 5, status: 'Draft' } });
    renderApplyLoan('/applicant/apply/5');
    await screen.findByText('Edit Your Draft Application');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

    await waitFor(() => expect(loanService.updateDraftApplication).toHaveBeenCalledWith('5', expect.any(Object)));
    expect(loanService.createApplication).not.toHaveBeenCalled();
  });
});
