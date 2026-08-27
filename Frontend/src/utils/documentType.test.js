import { describe, it, expect } from 'vitest';
import { documentTypeLabel } from './documentType';

describe('documentTypeLabel', () => {
  it('labels ADDRESS_PROOF as Aadhaar (product-specific rename, not a backend rename)', () => {
    expect(documentTypeLabel('ADDRESS_PROOF')).toBe('Aadhaar');
    expect(documentTypeLabel('address_proof')).toBe('Aadhaar');
  });

  it('labels the other two required types', () => {
    expect(documentTypeLabel('PAN_CARD')).toBe('PAN Card');
    expect(documentTypeLabel('SALARY_SLIP')).toBe('Salary Slip');
  });

  it('labels OTHER and falls back to the raw value for unknown types', () => {
    expect(documentTypeLabel('OTHER')).toBe('Other');
    expect(documentTypeLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('falls back to "Other" for null/undefined/empty type', () => {
    expect(documentTypeLabel(null)).toBe('Other');
    expect(documentTypeLabel(undefined)).toBe('Other');
    expect(documentTypeLabel('')).toBe('Other');
  });
});
