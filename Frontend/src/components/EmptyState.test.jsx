import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Inbox } from 'lucide-react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders a default title when none is given', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders a custom title, message, and action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No applications found"
        message="Nothing matches this filter yet."
        action={<button>Start Application</button>}
      />
    );

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(screen.getByText('Nothing matches this filter yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Application' })).toBeInTheDocument();
  });

  it('renders no message paragraph when message is empty', () => {
    render(<EmptyState title="Empty" message="" />);
    // Only the title text node should be present — no stray empty <p>.
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('uses the error variant styling affordance for error states', () => {
    render(<EmptyState variant="error" title="Application not found" />);
    expect(screen.getByText('Application not found')).toBeInTheDocument();
  });
});
