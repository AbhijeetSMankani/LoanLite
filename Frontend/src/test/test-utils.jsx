import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Renders a component inside a MemoryRouter without pulling in the real
// AuthProvider (which fires a network call on mount) — pages/components
// under test that call useAuth() should mock '../../context/AuthContext'
// directly so each test controls its own auth state synchronously.
export function renderWithRouter(ui, { route = '/', initialEntries } = {}) {
  const entries = initialEntries || [route];
  return render(<MemoryRouter initialEntries={entries}>{ui}</MemoryRouter>);
}

// A fake authenticated user shaped like AuthContext's normalized user
// (see authService.js: { id, name, email, role }), reusable across tests.
export const mockUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test.user@example.com',
  role: 'applicant',
  ...overrides,
});

export const mockAuthValue = (overrides = {}) => ({
  user: mockUser(),
  loading: false,
  isAuthenticated: true,
  userRole: 'applicant',
  login: () => {},
  logout: () => {},
  ...overrides,
});

// A minimal Page<T> envelope matching what Spring Data actually returns —
// see API_CONTRACT.md §1 Pagination.
export const mockPage = (content = [], overrides = {}) => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  numberOfElements: content.length,
  empty: content.length === 0,
  ...overrides,
});

export * from '@testing-library/react';
