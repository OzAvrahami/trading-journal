import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/index.js';
import { GlobalErrorBoundary } from './GlobalErrorBoundary.jsx';

function BrokenView() {
  throw new Error('private render detail');
}

const suppressExpectedRenderError = (event) => event.preventDefault();

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', suppressExpectedRenderError);
  });

  afterEach(() => {
    window.removeEventListener('error', suppressExpectedRenderError);
    vi.restoreAllMocks();
  });

  it('shows bounded recovery UI and moves focus without exposing diagnostics', async () => {
    render(<GlobalErrorBoundary><BrokenView /></GlobalErrorBoundary>);
    const heading = screen.getByRole('heading', { level: 1, name: 'TradingLog could not display this page' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.queryByText(/private render detail/i)).not.toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('uses the active Hebrew translation and document direction', async () => {
    await i18n.changeLanguage('he');
    document.documentElement.dir = 'rtl';
    render(<GlobalErrorBoundary><BrokenView /></GlobalErrorBoundary>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('לא ניתן להציג את העמוד ב־TradingLog');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
