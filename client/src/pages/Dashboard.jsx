import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { SummaryCards } from '../components/analytics/SummaryCards.jsx';
import { EquityCurve } from '../components/analytics/EquityCurve.jsx';
import { PnLHistogram } from '../components/analytics/PnLHistogram.jsx';
import { BreakdownChart } from '../components/analytics/BreakdownChart.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { QuickAddModal } from '../components/trades/QuickAddModal.jsx';
import { TradingCalendar } from '../components/analytics/TradingCalendar.jsx';

const DEFAULT_FROM = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const DEFAULT_TO   = format(new Date(), 'yyyy-MM-dd');

export default function Dashboard() {
  const [dateRange, setDateRange]   = useState({ from: DEFAULT_FROM, to: DEFAULT_TO });
  const [breakdownBy, setBreakdownBy] = useState('strategy');
  const [addOpen, setAddOpen]       = useState(false);

  // Account scope: { type: 'all' } | { type: 'account', id } | { type: 'company', name }
  const [scope, setScope] = useState({ type: 'all' });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  accountsApi.list,
  });

  // Unique company names from the user's accounts
  const companies = useMemo(() => {
    const names = [...new Set(accounts.map(a => a.company))].sort();
    return names;
  }, [accounts]);

  // Build query params from scope + date range
  const qParams = useMemo(() => {
    const base = { from: dateRange.from, to: dateRange.to };
    if (scope.type === 'account') return { ...base, accountId: scope.id };
    if (scope.type === 'company') return { ...base, company: scope.name };
    return base;
  }, [dateRange, scope]);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['analytics', 'summary', qParams],
    queryFn: () => analyticsApi.summary(qParams),
  });

  const { data: equityData } = useQuery({
    queryKey: ['analytics', 'equity-curve', qParams],
    queryFn: () => analyticsApi.equityCurve(qParams),
  });

  const { data: distData } = useQuery({
    queryKey: ['analytics', 'distribution', qParams],
    queryFn: () => analyticsApi.distribution(qParams),
  });

  const { data: breakdownData } = useQuery({
    queryKey: ['analytics', 'breakdown', qParams, breakdownBy],
    queryFn: () => analyticsApi.breakdown({ ...qParams, by: breakdownBy }),
  });

  function handleAccountChange(e) {
    const val = e.target.value;
    if (!val) { setScope({ type: 'all' }); return; }
    setScope({ type: 'account', id: val });
  }

  function handleCompanyChange(e) {
    const val = e.target.value;
    if (!val) { setScope({ type: 'all' }); return; }
    setScope({ type: 'company', name: val });
  }

  function accountLabel(a) {
    const base = `${a.company} — ${a.accountNumber}`;
    return a.accountName ? `${base} (${a.accountName})` : base;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Account scope */}
          <select
            className="input text-sm py-1.5 w-44"
            value={scope.type === 'account' ? scope.id : ''}
            onChange={handleAccountChange}
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{accountLabel(a)}</option>
            ))}
          </select>

          {/* Company scope — only shown when no specific account is selected */}
          {scope.type !== 'account' && companies.length > 1 && (
            <select
              className="input text-sm py-1.5 w-36"
              value={scope.type === 'company' ? scope.name : ''}
              onChange={handleCompanyChange}
            >
              <option value="">All Companies</option>
              {companies.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input text-sm py-1.5 w-36"
              value={dateRange.from}
              onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
            />
            <span className="text-gray-600 text-sm">—</span>
            <input
              type="date"
              className="input text-sm py-1.5 w-36"
              value={dateRange.to}
              onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
            />
          </div>

          <button onClick={() => setAddOpen(true)} className="btn-primary">
            + Add Trade
          </button>
        </div>
      </div>

      {sumLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : (
        <SummaryCards data={summary} />
      )}

      <TradingCalendar qParams={qParams} />

      {/* Charts */}
      <EquityCurve data={equityData?.data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PnLHistogram data={distData?.buckets} />
        <BreakdownChart
          data={breakdownData?.data}
          accounts={accounts}
          by={breakdownBy}
          onByChange={setBreakdownBy}
        />
      </div>

      <QuickAddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
