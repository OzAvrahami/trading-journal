import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => {
  const Component = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Component, BarChart: Component, Bar: Component, XAxis: Component,
    YAxis: Component, CartesianGrid: Component, Tooltip: Component, Cell: Component, ReferenceLine: Component,
  };
});

import { ANALYTICS_DIMENSIONS, AnalyticsBreakdown } from './AnalyticsBreakdown.jsx';
import { R_BUCKET_ORDER, RDistribution, orderRBuckets } from './RDistribution.jsx';

const breakdownRows = [
  { key: 'monday', label: 'Monday', tradesCount: 2, winners: 1, losers: 1, winRate: 0.5, pnlNet: -25, avgRMultiple: null },
  { key: 'tuesday', label: 'Tuesday', tradesCount: 1, winners: 1, losers: 0, winRate: 1, pnlNet: 75, avgRMultiple: 1.5 },
];

const rBuckets = R_BUCKET_ORDER.map((key, index) => ({
  key,
  label: [`≤ -2R`, '-2R to -1.5R', '-1.5R to -1R', '-1R to -0.5R', '-0.5R to 0R', '0R to 0.5R', '0.5R to 1R', '1R to 2R', '2R to 3R', '≥ 3R'][index],
  min: index === 0 ? null : index - 5,
  max: index === 9 ? null : index - 4,
  count: index === 5 ? 2 : 1,
}));

describe('Insights charts', () => {
  it('exposes only supported keyboard buttons and keeps the breakdown plot LTR', async () => {
    const onByChange = vi.fn();
    render(<AnalyticsBreakdown data={breakdownRows} accounts={[]} by="weekday" onByChange={onByChange} />);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(ANALYTICS_DIMENSIONS.map((item) => item.label));
    expect(screen.queryByRole('button', { name: /session/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekday' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Market' }));
    expect(onByChange).toHaveBeenCalledWith('market');
    expect(screen.getByRole('img', { name: /Net PnL chart/ })).toHaveAttribute('dir', 'ltr');
    expect(screen.getAllByText('—').every((node) => node.getAttribute('dir') === 'ltr')).toBe(true);
  });

  it('orders R buckets mathematically even when the response arrives reversed', () => {
    expect(orderRBuckets([...rBuckets].reverse()).map((bucket) => bucket.key)).toEqual(R_BUCKET_ORDER);
    document.documentElement.setAttribute('dir', 'rtl');
    const { container } = render(<RDistribution data={{ totalTrades: 11, buckets: [...rBuckets].reverse() }} />);
    const plot = screen.getByRole('img', { name: /ordered from negative to positive/i });
    expect(plot).toHaveAttribute('dir', 'ltr');
    expect(container.querySelector('ol')).toHaveAttribute('dir', 'ltr');
    expect([...container.querySelectorAll('[data-r-bucket]')].map((node) => node.dataset.rBucket)).toEqual(R_BUCKET_ORDER);
    expect(screen.getAllByText('0R to 0.5R')[0]).toHaveAttribute('dir', 'ltr');
  });

  it('does not turn missing R values into a zero-performance bucket', () => {
    render(<RDistribution data={{ totalTrades: 0, buckets: [] }} />);
    expect(screen.getByRole('heading', { name: 'R-multiple data is unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/not treated as 0R/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
