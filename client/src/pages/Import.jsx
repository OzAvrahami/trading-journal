import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseImport, commitImport } from '../api/imports.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';

const BROKERS = [
  { key: 'topstepx', label: 'TopstepX' },
  { key: 'tradovate', label: 'Tradovate' },
];

const STEPS = ['select', 'preview', 'done'];

function StepIndicator({ current }) {
  const labels = ['Select & Upload', 'Preview', 'Done'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const stepKey = STEPS[i];
        const isActive = current === stepKey;
        const isDone   = STEPS.indexOf(current) > i;
        return (
          <div key={stepKey} className="flex items-center gap-2">
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${isDone  ? 'bg-green-600 text-white'
              : isActive ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400'}
            `}>
              {isDone ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${isActive ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className={`h-px w-10 ${isDone ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatBadge({ label, value, color = 'gray' }) {
  const colors = {
    gray:  'bg-gray-800 text-gray-200',
    blue:  'bg-blue-900/60 text-blue-200',
    green: 'bg-green-900/60 text-green-200',
    amber: 'bg-amber-900/60 text-amber-200',
  };
  return (
    <div className={`rounded-lg px-4 py-3 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function PreviewTable({ rows }) {
  if (!rows.length) return <p className="text-gray-500 text-sm">No rows to preview.</p>;

  const cols = [
    { key: 'symbol',          label: 'Symbol' },
    { key: 'direction',       label: 'Direction' },
    { key: 'entry_datetime',  label: 'Entry' },
    { key: 'exit_datetime',   label: 'Exit' },
    { key: 'entry_price',     label: 'Entry $' },
    { key: 'exit_price',      label: 'Exit $' },
    { key: 'quantity',        label: 'Qty' },
    { key: 'pnl_net',         label: 'PnL Net' },
    { key: 'fees',            label: 'Fees' },
  ];

  const fmt = (key, val) => {
    if (val == null) return '—';
    if (['entry_datetime','exit_datetime'].includes(key)) {
      return new Date(val).toLocaleString();
    }
    if (['entry_price','exit_price','pnl_net','fees'].includes(key)) {
      return typeof val === 'number' ? val.toFixed(2) : val;
    }
    return String(val);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            {cols.map(c => (
              <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-800/50 transition">
              {cols.map(c => {
                const val = row[c.key];
                let extra = '';
                if (c.key === 'pnl_net') {
                  extra = val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : '';
                }
                if (c.key === 'direction') {
                  extra = val === 'long' ? 'text-blue-400' : 'text-orange-400';
                }
                return (
                  <td key={c.key} className={`px-3 py-2 text-gray-300 whitespace-nowrap ${extra}`}>
                    {fmt(c.key, val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Import() {
  const toast    = useToast();
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  // Step
  const [step, setStep] = useState('select');

  // Select & upload state
  const [broker, setBroker]   = useState('');
  const [file, setFile]       = useState(null);
  const [parsing, setParsing] = useState(false);

  // Preview state
  const [sessionId, setSessionId]   = useState(null);
  const [preview, setPreview]       = useState([]);
  const [parseStats, setParseStats] = useState(null);
  const [committing, setCommitting] = useState(false);

  // Done state
  const [commitResult, setCommitResult] = useState(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

  async function handleParse() {
    if (!broker) { toast.error('Please select a broker.'); return; }
    if (!file)   { toast.error('Please choose a CSV file.'); return; }

    setParsing(true);
    try {
      const result = await parseImport(broker, file);
      setSessionId(result.sessionId);
      setPreview(result.preview);
      setParseStats(result.stats);
      setStep('preview');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to parse CSV.');
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    setCommitting(true);
    try {
      const result = await commitImport(sessionId);
      setCommitResult(result);
      setStep('done');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message ?? 'Import failed.');
    } finally {
      setCommitting(false);
    }
  }

  function handleReset() {
    setBroker('');
    setFile(null);
    setSessionId(null);
    setPreview([]);
    setParseStats(null);
    setCommitResult(null);
    setStep('select');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-1">Import Trades</h1>
      <p className="text-gray-400 text-sm mb-6">
        Upload a broker CSV export to import your trades. Duplicates are detected automatically.
      </p>

      <StepIndicator current={step} />

      {/* ── Step 1: Select & Upload ── */}
      {step === 'select' && (
        <div className="card space-y-5">
          {/* Broker picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Broker</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BROKERS.map(b => (
                <button
                  key={b.key}
                  onClick={() => setBroker(b.key)}
                  className={`
                    px-4 py-3 rounded-lg border text-sm font-medium transition
                    ${broker === b.key
                      ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}
                  `}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-gray-700 file:text-gray-200
                hover:file:bg-gray-600 file:transition
                cursor-pointer"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>

          <button
            onClick={handleParse}
            disabled={parsing || !broker || !file}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? <><Spinner className="w-4 h-4" /> Parsing…</> : 'Preview Import'}
          </button>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 'preview' && parseStats && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBadge label="Total rows in file" value={parseStats.total} color="gray" />
            <StatBadge label="Unique (in file)"   value={parseStats.uniqueInFile} color="blue" />
            <StatBadge label="In-file duplicates" value={parseStats.inFileDuplicates} color={parseStats.inFileDuplicates > 0 ? 'amber' : 'gray'} />
          </div>

          {/* Preview table */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-400 mb-3">
              Preview (first {preview.length} of {parseStats.uniqueInFile} unique rows)
            </h2>
            <PreviewTable rows={preview} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCommit}
              disabled={committing || parseStats.uniqueInFile === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing
                ? <><Spinner className="w-4 h-4" /> Importing…</>
                : `Import ${parseStats.uniqueInFile} Trade${parseStats.uniqueInFile !== 1 ? 's' : ''}`
              }
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 'done' && commitResult && (
        <div className="card text-center space-y-6">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-100">Import Complete</h2>

          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <StatBadge label="Trades imported" value={commitResult.inserted}     color="green" />
            <StatBadge label="Already existed" value={commitResult.dbDuplicates} color={commitResult.dbDuplicates > 0 ? 'amber' : 'gray'} />
          </div>

          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/trades')} className="btn-primary">
              View Trades
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
