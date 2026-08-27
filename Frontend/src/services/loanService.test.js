import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axiosInstance';
import loanService from './loanService';
import { mockPage } from '../test/test-utils';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('createApplication', () => {
  it('sends only the fields the backend actually persists (no purpose/employment)', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 42 }));
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 1, status: 'Draft' } });

    await loanService.createApplication({ loanAmount: '100000', loanTerm: '24', income: '50000', status: 'draft' });

    expect(axiosInstance.post).toHaveBeenCalledWith('/loan-applications', {
      applicant: { id: 42 },
      loanAmount: 100000,
      tenureMonths: 24,
      declaredIncome: 50000,
      status: 'draft',
    });
  });

  it('propagates a validation failure (e.g. loanAmount out of range) as a rejected promise', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'loanAmount must be at most 2500000' } },
    });

    await expect(loanService.createApplication({ loanAmount: '9999999' })).rejects.toBeTruthy();
  });
});

describe('getMyApplications', () => {
  it('sends 0-indexed page/size and unwraps the Page<T> envelope', async () => {
    const apps = [{ id: 1 }, { id: 2 }];
    axiosInstance.get.mockResolvedValueOnce({ data: mockPage(apps, { totalPages: 3, totalElements: 25 }) });

    const result = await loanService.getMyApplications(2, 10);

    expect(axiosInstance.get).toHaveBeenCalledWith('/loan-applications', { params: { page: 1, size: 10 } });
    expect(result.data).toEqual(apps);
    expect(result.totalPages).toBe(3);
  });

  it('returns an empty array (not undefined) when content is missing', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: {} });

    const result = await loanService.getMyApplications();

    expect(result.data).toEqual([]);
  });
});

describe('submitApplication / withdrawApplication / updateDraftApplication', () => {
  it('submit hits the dedicated PATCH submit endpoint, not the generic PUT', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1, status: 'Submitted' } });

    await loanService.submitApplication(1);

    expect(axiosInstance.patch).toHaveBeenCalledWith('/loan-applications/submit/1');
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('withdraw hits the dedicated PATCH withdraw endpoint', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1, status: 'Withdrawn' } });

    await loanService.withdrawApplication(1);

    expect(axiosInstance.patch).toHaveBeenCalledWith('/loan-applications/withdraw/1');
  });

  it('updateDraftApplication PUTs only loanAmount/tenureMonths/declaredIncome (never status)', async () => {
    axiosInstance.put.mockResolvedValueOnce({ data: { id: 7, status: 'Draft' } });

    await loanService.updateDraftApplication(7, { loanAmount: '200000', loanTerm: '36', income: '60000' });

    const [, body] = axiosInstance.put.mock.calls[0];
    expect(body).toEqual({ loanAmount: 200000, tenureMonths: 36, declaredIncome: 60000 });
    expect(body.status).toBeUndefined();
  });
});

describe('processor work-list / claim / verify', () => {
  it('getProcessorWorkList unwraps content and asks for a large page size', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: mockPage([{ id: 1, status: 'Submitted' }]) });

    const result = await loanService.getProcessorWorkList();

    expect(axiosInstance.get).toHaveBeenCalledWith('/processor/work-list', { params: { size: 200 } });
    expect(result.data).toEqual([{ id: 1, status: 'Submitted' }]);
  });

  it('claimApplication only calls the claim endpoint — no follow-up PUT rename', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 1, status: 'Under Verification' } });

    await loanService.claimApplication(1);

    expect(axiosInstance.post).toHaveBeenCalledWith('/processor/claim/1');
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('claimApplication propagates a 409 when another processor already claimed it', async () => {
    axiosInstance.post.mockRejectedValueOnce({ response: { status: 409, data: { status: 'Under Verification' } } });

    await expect(loanService.claimApplication(1)).rejects.toBeTruthy();
  });

  it('verifyApplication only calls the verify endpoint — no follow-up PUT rename', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 1, status: 'Verified', recommendation: 'APPROVE' } });

    await loanService.verifyApplication(1);

    expect(axiosInstance.post).toHaveBeenCalledWith('/processor/applications/1/verify');
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('verifyApplication propagates the 400 raised when required documents are not all verified', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Cannot verify: ... ADDRESS_PROOF' } },
    });

    await expect(loanService.verifyApplication(1)).rejects.toBeTruthy();
  });
});

describe('underwriter work-list / claim / decision', () => {
  it('getUnderwriterWorkList unwraps content', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: mockPage([{ id: 2, status: 'Verified' }]) });

    const result = await loanService.getUnderwriterWorkList();

    expect(result.data).toEqual([{ id: 2, status: 'Verified' }]);
  });

  it('claimApplicationAsUnderwriter calls the underwriter claim endpoint', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 2, status: 'Under Review' } });

    await loanService.claimApplicationAsUnderwriter(2);

    expect(axiosInstance.post).toHaveBeenCalledWith('/underwriter/claim/2');
  });

  it.each([
    ['ACCEPT', 'ACCEPTED'],
    ['REJECT', 'REJECTED'],
  ])('decideApplication maps UI value %s to backend value %s', async (uiValue, backendValue) => {
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 2, status: backendValue === 'ACCEPTED' ? 'Accepted' : 'Rejected' } });

    await loanService.decideApplication(2, uiValue, 'some comments');

    expect(axiosInstance.post).toHaveBeenCalledWith('/underwriter/applications/2/decision', {
      decision: backendValue,
      comments: 'some comments',
    });
  });

  it('decideApplication propagates a 400 when the application is not Under Review', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Cannot record a decision: application must be Under Review' } },
    });

    await expect(loanService.decideApplication(2, 'ACCEPT', '')).rejects.toBeTruthy();
  });
});

describe('getLoanRules', () => {
  it('derives debtToIncomeRatio and defaults recommendation to pending-decision', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: { emi: 5000, declaredIncome: 50000, creditScore: 720, verifiedIncome: 48000, recommendation: null },
    });

    const { data } = await loanService.getLoanRules(5);

    expect(data.debtToIncomeRatio).toBe(10);
    expect(data.incomeVerification).toBe('verified');
    expect(data.recommendation).toBe('pending-decision');
  });

  it('returns null debtToIncomeRatio when emi/declaredIncome are absent', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: {} });

    const { data } = await loanService.getLoanRules(5);

    expect(data.debtToIncomeRatio).toBeNull();
    expect(data.incomeVerification).toBe('pending');
  });
});
