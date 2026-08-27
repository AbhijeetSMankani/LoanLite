import { describe, it, expect } from 'vitest';
import { stripRolePrefix, fullName } from './role';

describe('stripRolePrefix', () => {
  it('strips the ROLE_ prefix and lowercases', () => {
    expect(stripRolePrefix('ROLE_PROCESSOR')).toBe('processor');
    expect(stripRolePrefix('ROLE_UNDERWRITER')).toBe('underwriter');
    expect(stripRolePrefix('ROLE_ADMIN')).toBe('admin');
  });

  it('maps the backend\'s ROLE_USER onto the frontend\'s "applicant" concept', () => {
    // The backend has no ROLE_APPLICANT — self-registered users are always
    // ROLE_USER, and this app treats that as the applicant role everywhere.
    expect(stripRolePrefix('ROLE_USER')).toBe('applicant');
  });

  it('lowercases a role with no ROLE_ prefix without touching applicant mapping', () => {
    expect(stripRolePrefix('ADMIN')).toBe('admin');
  });

  it('passes through falsy input unchanged', () => {
    expect(stripRolePrefix(null)).toBe(null);
    expect(stripRolePrefix(undefined)).toBe(undefined);
    expect(stripRolePrefix('')).toBe('');
  });
});

describe('fullName', () => {
  it('joins first and last name', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('falls back to email when name parts are missing', () => {
    expect(fullName({ firstName: '', lastName: '', email: 'a@b.com' })).toBe('a@b.com');
  });

  it('falls back to N/A when there is nothing to show', () => {
    expect(fullName({})).toBe('N/A');
    expect(fullName(null)).toBe('N/A');
    expect(fullName(undefined)).toBe('N/A');
  });

  it('handles only a first or only a last name', () => {
    expect(fullName({ firstName: 'Ada' })).toBe('Ada');
    expect(fullName({ lastName: 'Lovelace' })).toBe('Lovelace');
  });
});
