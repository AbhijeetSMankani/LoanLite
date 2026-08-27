import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// jsdom doesn't implement scrollTo — several pages (or their layout wrapper)
// may call it, and jsdom throws "not implemented" otherwise.
window.scrollTo = vi.fn();

// happy-dom doesn't implement window.confirm either — pages that use it
// (document delete, etc.) need something spy-able. Defaults to "confirmed";
// override per-test with window.confirm.mockReturnValueOnce(false).
window.confirm = vi.fn(() => true);
