import { useState } from 'react';
import { format, startOfWeek, startOfMonth, subWeeks, subMonths } from 'date-fns';

const PRESETS = [
  { label: 'Today',      getRange: () => { const d = format(new Date(), 'yyyy-MM-dd'); return { from: d, to: d }; } },
  { label: 'Yesterday',  getRange: () => { const d = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'); return { from: d, to: d }; } },
  { label: 'This Week',  getRange: () => ({ from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Last Week',  getRange: () => { const s = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: format(s, 'yyyy-MM-dd'), to: format(e, 'yyyy-MM-dd') }; } },
  { label: 'This Month', getRange: () => ({ from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'All Time',   getRange: () => ({ from: '', to: '' }) },
];

const MARKETS    = ['stocks', 'crypto', 'futures', 'forex'];
const DIRECTIONS = ['long', 'short'];
const STATUSES   = ['open', 'closed'];
const OUTCOMES   = ['win', 'loss'];

export function FilterBar({ filters, onChange }) {
  const [expanded, setExpanded] = useState(false);

  function set(key, value) {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  }

  function applyPreset(preset) {
    const range = preset.getRange();
    onChange({ ...filters, from: range.from || undefined, to: range.to || undefined, page: 1 });
  }

  return (
    <div className="card space-y-3">
      {/* Date presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition"
          >
            {p.label}
          </button>
        ))}

        {/* Custom date range */}
        <div className="flex items-center gap-1 ml-auto">
          <input
            type="date"
            value={filters.from || ''}
            onChange={e => set('from', e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
          <span className="text-gray-600 text-xs">to</span>
          <input
            type="date"
            value={filters.to || ''}
            onChange={e => set('to', e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
        </div>

        <button
          onClick={() => setExpanded(x => !x)}
          className="px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition"
        >
          {expanded ? 'Less ▲' : 'More ▼'}
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-gray-800">
          <div>
            <label className="label">Symbol</label>
            <input
              className="input"
              placeholder="AAPL"
              value={filters.symbol || ''}
              onChange={e => set('symbol', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Market</label>
            <select className="input" value={filters.market || ''} onChange={e => set('market', e.target.value)}>
              <option value="">All</option>
              {MARKETS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Direction</label>
            <select className="input" value={filters.direction || ''} onChange={e => set('direction', e.target.value)}>
              <option value="">All</option>
              {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status || ''} onChange={e => set('status', e.target.value)}>
              <option value="">All</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Outcome</label>
            <select className="input" value={filters.outcome || ''} onChange={e => set('outcome', e.target.value)}>
              <option value="">All</option>
              {OUTCOMES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Strategy</label>
            <input
              className="input"
              placeholder="breakout"
              value={filters.strategy || ''}
              onChange={e => set('strategy', e.target.value)}
            />
          </div>

          <div className="col-span-full flex justify-end">
            <button
              onClick={() => onChange({ page: 1, limit: 50, sort: 'entry_datetime', order: 'desc' })}
              className="btn-secondary text-xs"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
