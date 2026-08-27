import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        content
      </Modal>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('renders title, body, and footer when open', () => {
    render(
      <Modal isOpen title="Upload Document" footer={<button>Confirm</button>}>
        <p>Pick a file</p>
      </Modal>
    );

    expect(screen.getByRole('heading', { name: 'Upload Document' })).toBeInTheDocument();
    expect(screen.getByText('Pick a file')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Withdraw">
        Are you sure?
      </Modal>
    );

    // The backdrop is the outermost fixed-position element rendered by Modal.
    await user.click(screen.getByText('Are you sure?').closest('.fixed'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close (X) button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Withdraw">
        Are you sure?
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog content (event does not bubble to the backdrop)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Withdraw">
        Are you sure?
      </Modal>
    );

    await user.click(screen.getByText('Are you sure?'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
