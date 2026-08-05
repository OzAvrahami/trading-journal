import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DailyReviewForm } from './DailyReviewForm.jsx';

const existing = {
  id: 'review-1', content: 'Existing notes', wentWell: 'Stayed patient', improve: null,
  nextSessionPlan: 'Wait for confirmation', emotions: ['Calm'], mistakes: ['Early exit'], isComplete: false,
};

describe('DailyReviewForm', () => {
  it('renders the bounded fields without title, screenshots, Goals, or manual metrics', () => {
    render(<DailyReviewForm review={null} date="2026-08-04" onSubmit={() => {}} />);
    expect(screen.getByLabelText(/Session notes/)).toBeInTheDocument();
    expect(screen.getByLabelText('What went well')).toBeInTheDocument();
    expect(screen.getByLabelText('What should improve')).toBeInTheDocument();
    expect(screen.getByLabelText('Next-session plan')).toBeInTheDocument();
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot|goals|manual progress/i)).not.toBeInTheDocument();
  });

  it('prepopulates legacy-compatible values and completion state', () => {
    render(<DailyReviewForm review={existing} date="2026-08-04" onSubmit={() => {}} />);
    expect(screen.getByLabelText(/Session notes/)).toHaveValue('Existing notes');
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Mark this Daily Review complete/)).not.toBeChecked();
  });

  it('requires visible session content and keeps entered text in place', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DailyReviewForm review={null} date="2026-08-04" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Save Daily Review' }));
    expect(screen.getByText('Session notes are required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Session notes/), 'My unsaved notes');
    expect(screen.getByLabelText(/Session notes/)).toHaveValue('My unsaved notes');
  });

  it('builds a normalized structured payload with suggestions, custom values, and completion', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DailyReviewForm review={existing} date="2026-08-04" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Focused' }));
    await user.type(screen.getByLabelText('Custom emotions'), 'focused');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    await user.click(screen.getByRole('button', { name: 'Moved stop' }));
    await user.click(screen.getByLabelText(/Mark this Daily Review complete/));
    await user.click(screen.getByRole('button', { name: 'Save Daily Review' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Existing notes', wentWell: 'Stayed patient', nextSessionPlan: 'Wait for confirmation',
      emotions: ['Calm', 'Focused'], mistakes: ['Early exit', 'Moved stop'], isComplete: true,
    }));
  });

  it('exposes selected chip state with text and aria-pressed instead of color alone', async () => {
    const user = userEvent.setup();
    render(<DailyReviewForm review={null} date="2026-08-04" onSubmit={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Patient' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
