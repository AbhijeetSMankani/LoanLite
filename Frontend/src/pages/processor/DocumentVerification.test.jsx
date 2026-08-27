import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DocumentVerification from './DocumentVerification';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';

vi.mock('../../services/loanService', () => ({
  default: { getApplicationById: vi.fn(), verifyApplication: vi.fn() },
}));
vi.mock('../../services/documentService', () => ({
  default: { getUploadedDocuments: vi.fn(), requestDocuments: vi.fn(), verifyDocument: vi.fn() },
}));

const baseApp = (overrides = {}) => ({
  id: 20,
  applicant: { firstName: 'A', lastName: 'B' },
  loanAmount: 300000,
  declaredIncome: 60000,
  ...overrides,
});

const doc = (overrides = {}) => ({
  id: 1,
  fileName: 'file.pdf',
  documentType: 'PAN_CARD',
  verificationStatus: 'PENDING',
  uploadedAt: '2026-08-01T00:00:00',
  ...overrides,
});

const renderPage = (query = '?applicationId=20') =>
  render(
    <MemoryRouter initialEntries={[`/processor/document-verification${query}`]}>
      <Routes>
        <Route path="/processor/document-verification" element={<DocumentVerification />} />
        <Route path="/processor/applications" element={<div>Processor Applications Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) so a leftover queued mockResolvedValueOnce
  // from a test that failed mid-flow can't leak into the next test.
  vi.resetAllMocks();
});

describe('DocumentVerification — no application selected', () => {
  it('shows the empty state when no applicationId is in the URL', () => {
    renderPage('');
    expect(screen.getByText('No application selected')).toBeInTheDocument();
  });
});

describe('DocumentVerification — required-document verify gate', () => {
  it('disables Verify Application while a required type is not yet VERIFIED', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [doc({ id: 1, documentType: 'PAN_CARD', verificationStatus: 'VERIFIED' }), doc({ id: 2, documentType: 'SALARY_SLIP', verificationStatus: 'PENDING' })],
      missingRequiredDocuments: ['ADDRESS_PROOF'],
    });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Verify Application' })).toBeDisabled();
  });

  it('enables Verify Application once every required type has at least one VERIFIED document, ignoring extras', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [
        doc({ id: 1, documentType: 'PAN_CARD', verificationStatus: 'VERIFIED' }),
        doc({ id: 2, documentType: 'PAN_CARD', verificationStatus: 'REJECTED' }), // a rejected duplicate shouldn't block
        doc({ id: 3, documentType: 'SALARY_SLIP', verificationStatus: 'VERIFIED' }),
        doc({ id: 4, documentType: 'ADDRESS_PROOF', verificationStatus: 'VERIFIED' }),
        doc({ id: 5, documentType: 'OTHER', verificationStatus: 'PENDING' }), // an unrelated pending extra shouldn't block either
      ],
      missingRequiredDocuments: [],
    });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Verify Application' })).toBeEnabled();
  });
});

describe('DocumentVerification — missing documents banner', () => {
  it('labels a missing ADDRESS_PROOF as Aadhaar, not the raw backend constant', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [],
      missingRequiredDocuments: ['PAN_CARD', 'ADDRESS_PROOF'],
    });
    renderPage();

    expect(await screen.findByText('PAN Card, Aadhaar')).toBeInTheDocument();
  });
});

describe('DocumentVerification — approve/reject a document', () => {
  it('approves a pending document and refreshes the list', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.getUploadedDocuments
      .mockResolvedValueOnce({ data: [doc()], missingRequiredDocuments: [] })
      .mockResolvedValueOnce({ data: [doc({ verificationStatus: 'VERIFIED' })], missingRequiredDocuments: [] });
    documentService.verifyDocument.mockResolvedValueOnce({ data: {} });
    renderPage();
    await screen.findByText('file.pdf');

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    // Two "Approve" buttons now exist (the row's and the modal's) — the modal's is last in the DOM.
    const approveButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() =>
      expect(documentService.verifyDocument).toHaveBeenCalledWith(1, { verified: true, notes: '' })
    );
  });

  it('rejects a pending document with notes', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValue({ data: [doc()], missingRequiredDocuments: [] });
    documentService.verifyDocument.mockResolvedValueOnce({ data: {} });
    renderPage();
    await screen.findByText('file.pdf');

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText('Verification Notes'), 'blurry scan');
    // Two "Reject" buttons now exist (the row's and the modal's) — the modal's is last in the DOM.
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    await user.click(rejectButtons[rejectButtons.length - 1]);

    await waitFor(() =>
      expect(documentService.verifyDocument).toHaveBeenCalledWith(1, { verified: false, notes: 'blurry scan' })
    );
  });

  it('shows an already-decided document as a status badge instead of action buttons', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [doc({ verificationStatus: 'VERIFIED' })],
      missingRequiredDocuments: [],
    });
    renderPage();

    await screen.findByText('file.pdf');
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});

describe('DocumentVerification — request documents', () => {
  it('sends a request-documents message naming the missing types by their friendly label', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValue({
      data: [],
      missingRequiredDocuments: ['ADDRESS_PROOF'],
    });
    documentService.requestDocuments.mockResolvedValueOnce({ data: {} });
    renderPage();
    await screen.findByText('Aadhaar');

    await user.click(screen.getByRole('button', { name: 'Request Documents' }));
    await user.type(screen.getByLabelText(/^Message/), 'please reupload');
    await user.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => expect(documentService.requestDocuments).toHaveBeenCalledWith('20', 'please reupload'));
  });
});

describe('DocumentVerification — verify application', () => {
  it('verifies and navigates back to the applications list on success', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [
        doc({ id: 1, documentType: 'PAN_CARD', verificationStatus: 'VERIFIED' }),
        doc({ id: 2, documentType: 'SALARY_SLIP', verificationStatus: 'VERIFIED' }),
        doc({ id: 3, documentType: 'ADDRESS_PROOF', verificationStatus: 'VERIFIED' }),
      ],
      missingRequiredDocuments: [],
    });
    loanService.verifyApplication.mockResolvedValueOnce({ data: { id: 20, status: 'Verified' } });
    renderPage();
    const verifyButton = await screen.findByRole('button', { name: 'Verify Application' });
    expect(verifyButton).toBeEnabled();

    await user.click(verifyButton);

    expect(await screen.findByText('Processor Applications Landed')).toBeInTheDocument();
  });

  it('shows the backend 400 reason when required documents are not all verified server-side', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [
        doc({ id: 1, documentType: 'PAN_CARD', verificationStatus: 'VERIFIED' }),
        doc({ id: 2, documentType: 'SALARY_SLIP', verificationStatus: 'VERIFIED' }),
        doc({ id: 3, documentType: 'ADDRESS_PROOF', verificationStatus: 'VERIFIED' }),
      ],
      missingRequiredDocuments: [],
    });
    loanService.verifyApplication.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Cannot verify: ...' } },
    });
    renderPage();
    const verifyButton = await screen.findByRole('button', { name: 'Verify Application' });

    await user.click(verifyButton);

    expect(await screen.findByText('Cannot verify: ...')).toBeInTheDocument();
  });
});
