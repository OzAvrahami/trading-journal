import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FinancialCoverage } from './FinancialCoverage.jsx';
import { SummaryCards } from '../analytics/SummaryCards.jsx';
import { buildCalendarDays } from '../analytics/TradingCalendar.jsx';

describe('unknown financial coverage',()=>{
  it('shows gross separately and never formats unknown net as zero',()=>{
    render(<SummaryCards data={{unknownNetCount:1,totals:{tradesClosed:2,pnlNet:null,pnlGross:30,totalFees:null,winRate:null},today:{pnlNet:null},wtd:{pnlNet:null},mtd:{pnlNet:null}}} />);
    expect(screen.getByText(/unknown net P&L/)).toBeInTheDocument();
    expect(screen.getByText(/Gross PnL:/)).toHaveTextContent('30.00');
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });
  it('preserves zero and unknown separately in calendar days',()=>{
    const days=buildCalendarDays('2026-11-16','2026-11-17',new Map([['2026-11-16',{pnlNet:null,tradesCount:1}],['2026-11-17',{pnlNet:0,tradesCount:1}]]));
    expect(days[0].pnlNet).toBeNull();expect(days[1].pnlNet).toBe(0);
  });
  it('does not warn when coverage is complete',()=>{
    const {container}=render(<FinancialCoverage count={0} gross={0} />);expect(container).toBeEmptyDOMElement();
  });
});
