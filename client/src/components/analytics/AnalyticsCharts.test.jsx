import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => {
  const Component = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Component, ComposedChart: Component, Area: Component, Bar: Component,
    XAxis: Component, YAxis: Component, CartesianGrid: Component, Tooltip: Component, Legend: Component,
    ReferenceLine: Component, BarChart: Component, Cell: Component,
  };
});

import { EquityCurve } from './EquityCurve.jsx';
import { PnLHistogram } from './PnLHistogram.jsx';
import { BreakdownChart } from './BreakdownChart.jsx';

describe('Dashboard charts', () => {
  it('labels cumulative realized PnL accurately and keeps its plot LTR', () => {
    render(<EquityCurve data={[
      { date: '2026-08-01', dailyPnl: -25, cumulativePnl: -25 },
      { date: '2026-08-02', dailyPnl: 75, cumulativePnl: 50 },
    ]} />);
    expect(screen.getByRole('heading', { name: 'Cumulative realized PnL' })).toBeInTheDocument();
    const plot = screen.getByRole('img', { name: /ends at \$50\.00/i });
    expect(plot).toHaveAttribute('dir', 'ltr');
    expect(plot).toHaveAccessibleName(/increased over 2 plotted days/i);
  });

  it('keeps distribution and breakdown plotting areas LTR', () => {
    const { rerender } = render(<PnLHistogram data={[{ range: '-$100–$0', min: -100, max: 0, count: 2 }]} />);
    expect(screen.getByRole('img', { name: /Dollar PnL distribution/ })).toHaveAttribute('dir', 'ltr');

    rerender(<BreakdownChart data={[{ label: 'Momentum', tradesCount: 2, winRate: 0.5, pnlNet: 25 }]} by="strategy" onByChange={() => {}} />);
    expect(screen.getByRole('img', { name: /Net PnL for 1 strategy group/ })).toHaveAttribute('dir', 'ltr');
  });

  it('renders a constant dollar distribution and preserves the truthful empty state', () => {
    const { rerender } = render(<PnLHistogram data={[{ range: '+25', min: 25, max: 25, count: 3 }]} />);
    expect(screen.getByRole('img', { name: /1 buckets across 3 closed trades/i })).toBeInTheDocument();

    rerender(<PnLHistogram data={[]} />);
    expect(screen.getByRole('heading', { name: 'No PnL distribution yet' })).toBeInTheDocument();
  });
});
