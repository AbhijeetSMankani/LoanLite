import { describe, it, expect } from 'vitest';
import { getDisplayStatus, isWaitingForDocuments, DOCUMENTS_REQUESTED_ACTION } from './applicationStatus';

const historyEntry = (action, createdAt) => ({ action, createdAt });

describe('getDisplayStatus', () => {
  it('returns the raw status unchanged when not Under Verification', () => {
    expect(getDisplayStatus({ status: 'Submitted', applicationHistory: [] })).toBe('Submitted');
    expect(getDisplayStatus({ status: 'Accepted', applicationHistory: [] })).toBe('Accepted');
  });

  it('returns "Under Verification" as-is when there is no history at all', () => {
    expect(getDisplayStatus({ status: 'Under Verification', applicationHistory: [] })).toBe('Under Verification');
  });

  it('returns "Waiting for Documents" when the latest history entry is DOCUMENTS_REQUESTED', () => {
    const app = {
      status: 'Under Verification',
      applicationHistory: [
        historyEntry('PROCESSOR_CLAIMED', '2026-08-01T10:00:00'),
        historyEntry(DOCUMENTS_REQUESTED_ACTION, '2026-08-02T10:00:00'),
      ],
    };
    expect(getDisplayStatus(app)).toBe('Waiting for Documents');
  });

  it('picks the entry with the latest createdAt regardless of array order', () => {
    const app = {
      status: 'Under Verification',
      applicationHistory: [
        historyEntry(DOCUMENTS_REQUESTED_ACTION, '2026-08-05T10:00:00'),
        historyEntry('PROCESSOR_CLAIMED', '2026-08-01T10:00:00'),
      ],
    };
    expect(getDisplayStatus(app)).toBe('Waiting for Documents');
  });

  it('does not flag as waiting when a later action superseded the document request', () => {
    const app = {
      status: 'Under Verification',
      applicationHistory: [
        historyEntry(DOCUMENTS_REQUESTED_ACTION, '2026-08-01T10:00:00'),
        historyEntry('DOCUMENT_VERIFIED', '2026-08-03T10:00:00'),
      ],
    };
    expect(getDisplayStatus(app)).toBe('Under Verification');
  });

  it('handles a null/undefined application gracefully', () => {
    expect(getDisplayStatus(null)).toBeUndefined();
    expect(getDisplayStatus(undefined)).toBeUndefined();
  });
});

describe('isWaitingForDocuments', () => {
  it('is true only when the derived display status is Waiting for Documents', () => {
    const waiting = {
      status: 'Under Verification',
      applicationHistory: [historyEntry(DOCUMENTS_REQUESTED_ACTION, '2026-08-01T10:00:00')],
    };
    const notWaiting = { status: 'Submitted', applicationHistory: [] };

    expect(isWaitingForDocuments(waiting)).toBe(true);
    expect(isWaitingForDocuments(notWaiting)).toBe(false);
  });
});
