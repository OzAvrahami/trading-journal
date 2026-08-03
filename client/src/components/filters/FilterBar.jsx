import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, startOfMonth, subWeeks } from 'date-fns';
import { CaretDown, CaretUp, FunnelSimple, X } from '@phosphor-icons/react';
import { accountsApi } from '../../api/accounts.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';

export const DEFAULT_TRADE_FILTERS = {
  page: 1,
  limit: 50,
  sort: 'entry_datetime',
  order: 'desc',
};

export const TRADE_FILTER_KEYS = [
  'from',
  'to',
  'accountId',
  'symbol',
  'market',
  'direction',
  'status',
  'outcome',
  'strategy',
  'timeframe',
];

export const DATE_PRESETS = [
  { label: 'Today', getRange: () => { const d = format(new Date(), 'yyyy-MM-dd'); return { from: d, to: d }; } },
  { label: 'Yesterday', getRange: () => { const d = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'); return { from: d, to: d }; } },
  { label: 'This Week', getRange: () => ({ from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Last Week', getRange: () => { const s = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: format(s, 'yyyy-MM-dd'), to: format(e, 'yyyy-MM-dd') }; } },
  { label: 'This Month', getRange: () => ({ from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'All Time', getRange: () => ({ from: '', to: '' }) },
];

const MARKETS = ['stocks', 'crypto', 'futures', 'forex'];
const DIRECTIONS = ['long', 'short'];
const STATUSES = ['open', 'closed'];
const OUTCOMES = ['win', 'loss'];
const TIMEFRAMES = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

export function getActiveTradeFilterKeys(filters) {
  return TRADE_FILTER_KEYS.filter((key) => filters[key] != null && filters[key] !== '');
}

function accountLabel(account) {
  const base = `${account.company} — ${account.accountNumber}`;
  return account.accountName ? `${base} (${account.accountName})` : base;
}

export function FilterBar({ filters, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const activeKeys = getActiveTradeFilterKeys(filters);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  });

  function set(key, value) {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  }

  function applyPreset(preset) {
    const range = preset.getRange();
    onChange({ ...filters, from: range.from || undefined, to: range.to || undefined, page: 1 });
  }

  function clearFilters() {
    onChange({ ...DEFAULT_TRADE_FILTERS });
  }

  return (
    <section className="rounded-lg border border-default bg-surface p-3 shadow-flat" aria-label="Trade filters">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-9 items-center gap-2 pe-1 text-sm font-medium text-primary">
          <FunnelSimple size={17} aria-hidden="true" />
          Filters
          {activeKeys.length > 0 && <Badge variant="action">{activeKeys.length} active</Badge>}
        </div>

        {DATE_PRESETS.map((preset) => (
          <Button key={preset.label} type="button" size="sm" variant="tertiary" onClick={() => applyPreset(preset)}>
            {preset.label}
          </Button>
        ))}

        <Button
          type="button"
          size="sm"
          className="ms-auto"
          aria-expanded={expanded}
          aria-controls="advanced-trade-filters"
          trailingIcon={expanded ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Fewer filters' : 'More filters'}
        </Button>
      </div>

      {activeKeys.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-default pt-3" aria-label="Active filters">
          {activeKeys.map((key) => (
            <Badge key={key} variant="neutral" className="capitalize">
              {key === 'accountId' ? 'Account' : key}
            </Badge>
          ))}
          <Button type="button" size="sm" variant="tertiary" leadingIcon={<X size={14} aria-hidden="true" />} onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {expanded && (
        <div id="advanced-trade-filters" className="mt-3 grid grid-cols-1 gap-3 border-t border-default pt-3 sm:grid-cols-2 compact:grid-cols-4">
          <Field label="From" id="trade-filter-from">
            {(props) => <Input type="date" value={filters.from || ''} onChange={(event) => set('from', event.target.value)} {...props} />}
          </Field>
          <Field label="To" id="trade-filter-to">
            {(props) => <Input type="date" value={filters.to || ''} onChange={(event) => set('to', event.target.value)} {...props} />}
          </Field>
          <Field label="Account" id="trade-filter-account">
            {(props) => (
              <Select value={filters.accountId || ''} onChange={(event) => set('accountId', event.target.value)} {...props}>
                <option value="">All accounts</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Symbol" id="trade-filter-symbol">
            {(props) => <Input dir="ltr" placeholder="AAPL" value={filters.symbol || ''} onChange={(event) => set('symbol', event.target.value)} {...props} />}
          </Field>
          <Field label="Market" id="trade-filter-market">
            {(props) => (
              <Select value={filters.market || ''} onChange={(event) => set('market', event.target.value)} {...props}>
                <option value="">All markets</option>
                {MARKETS.map((market) => <option key={market} value={market}>{market}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Direction" id="trade-filter-direction">
            {(props) => (
              <Select value={filters.direction || ''} onChange={(event) => set('direction', event.target.value)} {...props}>
                <option value="">All directions</option>
                {DIRECTIONS.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Status" id="trade-filter-status">
            {(props) => (
              <Select value={filters.status || ''} onChange={(event) => set('status', event.target.value)} {...props}>
                <option value="">All statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Outcome" id="trade-filter-outcome">
            {(props) => (
              <Select value={filters.outcome || ''} onChange={(event) => set('outcome', event.target.value)} {...props}>
                <option value="">All outcomes</option>
                {OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Strategy" id="trade-filter-strategy">
            {(props) => <Input placeholder="Breakout" value={filters.strategy || ''} onChange={(event) => set('strategy', event.target.value)} {...props} />}
          </Field>
          <Field label="Timeframe" id="trade-filter-timeframe">
            {(props) => (
              <Select value={filters.timeframe || ''} onChange={(event) => set('timeframe', event.target.value)} {...props}>
                <option value="">All timeframes</option>
                {TIMEFRAMES.map((timeframe) => <option key={timeframe} value={timeframe}>{timeframe}</option>)}
              </Select>
            )}
          </Field>
          <div className="flex items-end sm:col-span-2 compact:col-span-2 compact:justify-end">
            <Button type="button" onClick={clearFilters} disabled={activeKeys.length === 0}>Clear filters</Button>
          </div>
        </div>
      )}
    </section>
  );
}
