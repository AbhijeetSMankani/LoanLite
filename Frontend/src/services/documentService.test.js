import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axiosInstance';
import documentService from './documentService';

vi.mock('../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadDocument', () => {
  it('posts multipart form data to the applicant-facing upload endpoint', async () => {
    const formData = new FormData();
    formData.append('file', new File(['x'], 'pan.pdf', { type: 'application/pdf' }));
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 1, documentType: 'PAN_CARD' } });

    await documentService.uploadDocument(5, formData);

    expect(axiosInstance.post).toHaveBeenCalledWith('/applications/5/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('propagates a 400 for an unsupported content-type or oversized file', async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: "Unsupported file type 'text/html'" } },
    });

    await expect(documentService.uploadDocument(5, new FormData())).rejects.toBeTruthy();
  });
});

describe('getUploadedDocuments', () => {
  it('returns documents and missingRequiredDocuments with safe defaults', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: { documents: [{ id: 1 }], missingRequiredDocuments: ['ADDRESS_PROOF'] },
    });

    const result = await documentService.getUploadedDocuments(5);

    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.missingRequiredDocuments).toEqual(['ADDRESS_PROOF']);
  });

  it('defaults to empty arrays when the response omits them', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: {} });

    const result = await documentService.getUploadedDocuments(5);

    expect(result.data).toEqual([]);
    expect(result.missingRequiredDocuments).toEqual([]);
  });
});

describe('deleteDocument', () => {
  it('calls DELETE on the document endpoint', async () => {
    axiosInstance.delete.mockResolvedValueOnce({});

    await documentService.deleteDocument(9);

    expect(axiosInstance.delete).toHaveBeenCalledWith('/documents/9');
  });

  it('propagates a 403 when the document is not PENDING (or not the caller\'s own)', async () => {
    axiosInstance.delete.mockRejectedValueOnce({ response: { status: 403 } });

    await expect(documentService.deleteDocument(9)).rejects.toBeTruthy();
  });
});

describe('verifyDocument', () => {
  it('maps verified:true to VERIFIED and includes remarks', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1, verificationStatus: 'VERIFIED' } });

    await documentService.verifyDocument(1, { verified: true, notes: 'looks good' });

    expect(axiosInstance.patch).toHaveBeenCalledWith('/documents/1', {
      verificationStatus: 'VERIFIED',
      remarks: 'looks good',
    });
  });

  it('maps verified:false to REJECTED', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1, verificationStatus: 'REJECTED' } });

    await documentService.verifyDocument(1, { verified: false, notes: 'blurry scan' });

    expect(axiosInstance.patch).toHaveBeenCalledWith('/documents/1', {
      verificationStatus: 'REJECTED',
      remarks: 'blurry scan',
    });
  });
});

describe('requestDocuments', () => {
  it('sends the message when provided', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1 } });

    await documentService.requestDocuments(1, 'please reupload PAN card');

    expect(axiosInstance.patch).toHaveBeenCalledWith('/documents/applications/1/request-documents', {
      message: 'please reupload PAN card',
    });
  });

  it('sends no body when message is empty (backend body is optional)', async () => {
    axiosInstance.patch.mockResolvedValueOnce({ data: { id: 1 } });

    await documentService.requestDocuments(1, '');

    expect(axiosInstance.patch).toHaveBeenCalledWith('/documents/applications/1/request-documents', undefined);
  });
});
