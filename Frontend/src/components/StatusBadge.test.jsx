import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['Draft', 'Draft'],
    ['Submitted', 'Submitted'],
    ['Under Verification', 'Under Verification'],
    ['Waiting for Documents', 'Waiting for Documents'],
    ['Verified', 'Verified'],
    ['Under Review', 'Under Review'],
    ['Accepted', 'Accepted'],
    ['Rejected', 'Rejected'],
    ['Withdrawn', 'Withdrawn'],
  ])('renders the canonical backend status "%s" with a matching label', (status, expectedLabel) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it.each([
    ['APPROVE', 'Approved'],
    ['MANUAL_REVIEW', 'Manual Review'],
    ['REJECT', 'Rejected'],
  ])('renders the processor recommendation value "%s" with a styled label (case-insensitive)', (rec, expectedLabel) => {
    render(<StatusBadge status={rec} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('falls back to the raw string for an unrecognized status rather than crashing', () => {
    render(<StatusBadge status="SOME_NEW_STATUS" />);
    expect(screen.getByText('SOME_NEW_STATUS')).toBeInTheDocument();
  });

  it('shows "Unknown" for a missing status instead of rendering blank', () => {
    render(<StatusBadge status={undefined} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
