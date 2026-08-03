import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValueIndicator } from './ValueIndicator.jsx';

describe('ValueIndicator', () => {
  it.each([0, -0])('renders %s without a directional icon or gain/loss color', value => {
    const { container } = render(<ValueIndicator value={value}>$0.00</ValueIndicator>);
    const indicator = screen.getByText('$0.00').closest('span');
    expect(indicator).toHaveClass('text-secondary');
    expect(indicator).toHaveTextContent('No change: $0.00');
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('retains positive treatment for a gain', () => {
    const { container } = render(<ValueIndicator value={12}>+$12.00</ValueIndicator>);
    expect(screen.getByText('+$12.00').closest('span')).toHaveClass('text-positive');
    expect(screen.getByText('Gain:')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('retains negative treatment for a loss', () => {
    const { container } = render(<ValueIndicator value={-12}>-$12.00</ValueIndicator>);
    expect(screen.getByText('-$12.00').closest('span')).toHaveClass('text-negative');
    expect(screen.getByText('Loss:')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
