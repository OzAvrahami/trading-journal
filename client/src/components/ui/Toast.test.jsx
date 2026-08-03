import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast.jsx';

function Harness() {
  const toast = useToast();
  return <button onClick={() => toast.success('Account saved.')}>Show toast</button>;
}

describe('ToastProvider', () => {
  it('renders toast content in a polite live region', async () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Show toast' }));

    expect(screen.getByText('Account saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });
});
