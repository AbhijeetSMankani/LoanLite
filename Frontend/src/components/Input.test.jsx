import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import Input from './Input';

describe('Input', () => {
  it('associates its label with the field so it is reachable by accessible name (screen reader / getByLabelText)', () => {
    render(<Input label="Email" name="email" value="" onChange={() => {}} />);

    const field = screen.getByLabelText('Email');
    expect(field).toBeInTheDocument();
    expect(field.tagName).toBe('INPUT');
  });

  it('marks a required field visually and lets keyboard users type into it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="Email" name="email" value="" onChange={onChange} required />);

    expect(screen.getByText('*')).toBeInTheDocument();

    const field = screen.getByLabelText(/Email/);
    await user.type(field, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders a validation error message associated visually with the field', () => {
    render(<Input label="Loan Amount" name="loanAmount" value="9999999" onChange={() => {}} error="Limit exceeded" />);

    expect(screen.getByText('Limit exceeded')).toBeInTheDocument();
  });

  it('renders no error text when none is passed', () => {
    render(<Input label="Loan Amount" name="loanAmount" value="100" onChange={() => {}} error="" />);

    expect(screen.queryByText(/limit|error/i)).not.toBeInTheDocument();
  });

  it('renders a textarea when type="textarea"', () => {
    render(<Input label="Comments" name="comments" type="textarea" value="" onChange={() => {}} />);

    expect(screen.getByLabelText('Comments').tagName).toBe('TEXTAREA');
  });

  it('disables the field and shows the disabled affordance', () => {
    render(<Input label="Email" name="email" value="" onChange={() => {}} disabled />);

    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
