import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ApplicationDetails from './ApplicationDetails';
import loanService from '../../services/loanService';
import documentService from '../../services/documentService';

vi.mock('../../services/loanService', () => ({
  default: { getApplicationById: vi.fn(), submitApplication: vi.fn(), withdrawApplication: vi.fn() },
}));
vi.mock('../../services/documentService', () => ({
  default: { getUploadedDocuments: vi.fn(), uploadDocument: vi.fn(), deleteDocument: vi.fn() },
}));

const baseApp = (overrides = {}) => ({
  id: 10,
  status: 'Draft',
  loanAmount: 200000,
  tenureMonths: 24,
  declaredIncome: 50000,
  decisionComments: null,
  ...overrides,
});

const renderDetails = (id = '10') =>
  render(
    <MemoryRouter initialEntries={[`/applicant/application/${id}`]}>
      <Routes>
        <Route path="/applicant/application/:id" element={<ApplicationDetails />} />
        <Route path="/applicant/apply/:id" element={<div>Edit Page Landed</div>} />
        <Route path="/applicant/my-applications" element={<div>My Applications Landed</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  documentService.getUploadedDocuments.mockResolvedValue({ data: [], missingRequiredDocuments: [] });
  // happy-dom doesn't implement window.confirm; re-assign fresh each test
  // rather than relying on vi.spyOn (nothing to spy on) or restore ordering.
  window.confirm = vi.fn(() => true);
});

describe('ApplicationDetails — loading and error states', () => {
  it('shows a loader before data arrives', () => {
    loanService.getApplicationById.mockImplementation(() => new Promise(() => {}));
    renderDetails();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "Application not found" when the fetch fails', async () => {
    loanService.getApplicationById.mockRejectedValueOnce(new Error('Network Error'));
    renderDetails();
    expect(await screen.findByText('Application not found')).toBeInTheDocument();
  });
});

describe('ApplicationDetails — Draft actions (Submit / Withdraw / Edit)', () => {
  it('shows Edit and Submit only for a Draft application, and Withdraw always (except when already Withdrawn)', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    renderDetails();

    await screen.findByText('Application #10');
    expect(screen.getByRole('button', { name: /Submit Application/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Withdraw Application/ })).toBeInTheDocument();
  });

  it('hides every action button once the application is Withdrawn', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp({ status: 'Withdrawn' }) });
    renderDetails();

    await screen.findByText('Application #10');
    expect(screen.queryByRole('button', { name: /Submit Application/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Withdraw Application/ })).not.toBeInTheDocument();
  });

  it('submits the draft application and shows a success message', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    loanService.submitApplication.mockResolvedValueOnce({ data: baseApp({ status: 'Submitted' }) });
    renderDetails();
    await screen.findByText('Application #10');

    await user.click(screen.getByRole('button', { name: /Submit Application/ }));

    expect(loanService.submitApplication).toHaveBeenCalledWith('10');
    expect(await screen.findByText('Application submitted successfully.')).toBeInTheDocument();
  });

  it('withdraws the application after confirming in the modal', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp({ status: 'Submitted' }) });
    loanService.withdrawApplication.mockResolvedValueOnce({ data: baseApp({ status: 'Withdrawn' }) });
    renderDetails();
    await screen.findByText('Application #10');

    await user.click(screen.getByRole('button', { name: /Withdraw Application/ }));
    expect(screen.getByText(/Are you sure you want to withdraw/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(loanService.withdrawApplication).toHaveBeenCalledWith('10');
    expect(await screen.findByText('Application withdrawn.')).toBeInTheDocument();
  });

  it('navigates to the edit wizard when Edit is clicked', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    renderDetails();
    await screen.findByText('Application #10');

    await user.click(screen.getByRole('button', { name: /Edit/ }));

    expect(await screen.findByText('Edit Page Landed')).toBeInTheDocument();
  });
});

describe('ApplicationDetails — underwriter decision reason', () => {
  it('shows the acceptance reason from decisionComments', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({
      data: baseApp({ status: 'Accepted', decisionComments: 'Strong credit profile.' }),
    });
    renderDetails();

    expect(await screen.findByText('Application Accepted')).toBeInTheDocument();
    expect(screen.getByText('Strong credit profile.')).toBeInTheDocument();
  });

  it('shows a fallback message when a rejection has no comments', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({
      data: baseApp({ status: 'Rejected', decisionComments: null }),
    });
    renderDetails();

    expect(await screen.findByText('Application Rejected')).toBeInTheDocument();
    expect(screen.getByText('No additional reason was provided by the underwriter.')).toBeInTheDocument();
  });

  it('shows no decision card for an application still in progress', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp({ status: 'Under Review' }) });
    renderDetails();

    await screen.findByText('Application #10');
    expect(screen.queryByText('Application Accepted')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Rejected')).not.toBeInTheDocument();
  });
});

describe('ApplicationDetails — document upload', () => {
  it('labels a document\'s type as Aadhaar rather than Address Proof', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [{ id: 1, fileName: 'aadhaar.pdf', documentType: 'ADDRESS_PROOF', verificationStatus: 'VERIFIED' }],
      missingRequiredDocuments: [],
    });
    renderDetails();

    expect(await screen.findByText('Aadhaar')).toBeInTheDocument();
    expect(screen.queryByText('Address Proof')).not.toBeInTheDocument();
  });

  it('disables the modal Upload button until a file is selected, then uploads with the chosen type', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.uploadDocument.mockResolvedValueOnce({ data: { id: 2 } });
    const { container } = renderDetails();
    await screen.findByText('Application #10');

    await user.click(screen.getByRole('button', { name: /Upload/ }));
    // Two "Upload" buttons now exist: the header one that opened this modal,
    // and the modal's own confirm button — take the modal's (the last one).
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload' });
    const uploadConfirmButton = uploadButtons[uploadButtons.length - 1];
    expect(uploadConfirmButton).toBeDisabled();

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['dummy'], 'aadhaar.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);
    await user.selectOptions(screen.getByRole('combobox'), 'ADDRESS_PROOF');

    expect(uploadConfirmButton).toBeEnabled();
    await user.click(uploadConfirmButton);

    await waitFor(() => expect(documentService.uploadDocument).toHaveBeenCalledTimes(1));
    const [uploadedId, formData] = documentService.uploadDocument.mock.calls[0];
    expect(uploadedId).toBe('10');
    expect(formData.get('documentType')).toBe('ADDRESS_PROOF');
    expect(formData.get('file').name).toBe('aadhaar.pdf');
  });

  it('shows an error and does not close the modal when the upload is rejected', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    // handleFileUpload's catch reads err.message, not err.response?.data?.message
    // (unlike the submit/withdraw/delete handlers on this same page) — so a real
    // axios error here surfaces the generic fallback, not the backend's reason.
    documentService.uploadDocument.mockRejectedValueOnce({
      response: { status: 400, data: { message: "Unsupported file type 'text/html'" } },
    });
    const { container } = renderDetails();
    await screen.findByText('Application #10');

    await user.click(screen.getByRole('button', { name: /Upload/ }));
    const fileInput = container.querySelector('input[type="file"]');
    await user.upload(fileInput, new File(['x'], 'evil.html', { type: 'text/html' }));
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload' });
    await user.click(uploadButtons[uploadButtons.length - 1]);

    expect(await screen.findByText('Failed to upload document')).toBeInTheDocument();
  });
});

describe('ApplicationDetails — XSS: server-sourced strings render as text, not markup', () => {
  it('renders a malicious document filename literally instead of executing it', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    const payload = '<img src=x onerror="window.__xss=true">';
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [{ id: 1, fileName: payload, documentType: 'PAN_CARD', verificationStatus: 'PENDING' }],
      missingRequiredDocuments: [],
    });
    delete window.__xss;

    const { container } = renderDetails();

    expect(await screen.findByText(payload)).toBeInTheDocument();
    // React escapes text content by default (no dangerouslySetInnerHTML in this
    // component) — confirm no <img> tag was actually created from the string.
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(window.__xss).toBeUndefined();
  });
});

describe('ApplicationDetails — deleting a document (the only "edit" path available to an applicant)', () => {
  it('shows a remove control only for PENDING documents', async () => {
    loanService.getApplicationById.mockResolvedValueOnce({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [
        { id: 1, fileName: 'pending.pdf', documentType: 'PAN_CARD', verificationStatus: 'PENDING' },
        { id: 2, fileName: 'verified.pdf', documentType: 'SALARY_SLIP', verificationStatus: 'VERIFIED' },
      ],
      missingRequiredDocuments: [],
    });
    renderDetails();

    await screen.findByText('pending.pdf');
    expect(screen.getAllByTitle('Remove this document so you can upload a replacement')).toHaveLength(1);
  });

  it('deletes the document after the user confirms', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [{ id: 1, fileName: 'pending.pdf', documentType: 'PAN_CARD', verificationStatus: 'PENDING' }],
      missingRequiredDocuments: [],
    });
    documentService.deleteDocument.mockResolvedValueOnce({ data: {} });
    renderDetails();
    await screen.findByText('pending.pdf');

    await user.click(screen.getByTitle('Remove this document so you can upload a replacement'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(documentService.deleteDocument).toHaveBeenCalledWith(1));
  });

  it('does not delete when the user cancels the confirmation', async () => {
    const user = userEvent.setup();
    loanService.getApplicationById.mockResolvedValue({ data: baseApp() });
    documentService.getUploadedDocuments.mockResolvedValueOnce({
      data: [{ id: 1, fileName: 'pending.pdf', documentType: 'PAN_CARD', verificationStatus: 'PENDING' }],
      missingRequiredDocuments: [],
    });
    window.confirm = vi.fn(() => false);
    renderDetails();
    await screen.findByText('pending.pdf');

    await user.click(screen.getByTitle('Remove this document so you can upload a replacement'));

    expect(documentService.deleteDocument).not.toHaveBeenCalled();
  });
});
