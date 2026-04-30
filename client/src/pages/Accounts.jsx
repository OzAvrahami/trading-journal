import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';

const PROP_FIRMS = [
  'Topstep', 'Lucid', 'MFF', 'Apex', 'FTMO', 'E8', 'The5ers',
  'Earn2Trade', 'Tradeify', 'Bulenox', 'BluSky', 'Funded Engineer',
];

const ACCOUNT_TYPES    = ['funded', 'evaluation', 'demo', 'live'];
const ACCOUNT_STATUSES = ['active', 'inactive', 'archived'];

const STATUS_COLORS = {
  active:   'badge-green',
  inactive: 'badge-gray',
  archived: 'badge-gray',
};

// ---- Account form -----------------------------------------------------------

function AccountForm({ defaultValues = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    company:       defaultValues.company       || '',
    accountNumber: defaultValues.accountNumber || '',
    accountName:   defaultValues.accountName   || '',
    accountType:   defaultValues.accountType   || '',
    status:        defaultValues.status        || 'active',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.company.trim() || !form.accountNumber.trim()) return;
    onSubmit({
      company:       form.company,
      accountNumber: form.accountNumber,
      accountName:   form.accountName  || null,
      accountType:   form.accountType  || null,
      status:        form.status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prop Firm / Broker *</label>
          <input
            className="input"
            list="firm-list"
            placeholder="Topstep"
            value={form.company}
            onChange={e => set('company', e.target.value)}
            required
          />
          <datalist id="firm-list">
            {PROP_FIRMS.map(f => <option key={f} value={f} />)}
          </datalist>
        </div>
        <div>
          <label className="label">Account Number *</label>
          <input
            className="input"
            placeholder="e.g. 12345678"
            value={form.accountNumber}
            onChange={e => set('accountNumber', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Display Name</label>
          <input
            className="input"
            placeholder="e.g. Main Funded"
            value={form.accountName}
            onChange={e => set('accountName', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.accountType} onChange={e => set('accountType', e.target.value)}>
            <option value="">—</option>
            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          {ACCOUNT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="pt-1">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving…' : (defaultValues.id ? 'Update Account' : 'Create Account')}
        </button>
      </div>
    </form>
  );
}

// ---- Main page --------------------------------------------------------------

export default function Accounts() {
  const qc    = useQueryClient();
  const toast = useToast();

  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', account }
  const [deleteTarget, setDeleteTarget] = useState(null); // account to confirm-delete

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn:  accountsApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['accounts'] });

  const createMutation = useMutation({
    mutationFn: (data) => accountsApi.create(data),
    onSuccess: () => { invalidate(); toast.success('Account created.'); setModalState(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || 'Failed to create account.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => accountsApi.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Account updated.'); setModalState(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || 'Failed to update account.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => accountsApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('Account deleted.'); setDeleteTarget(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete account.'),
  });

  function accountLabel(a) {
    const base = `${a.company} — ${a.accountNumber}`;
    return a.accountName ? `${base} (${a.accountName})` : base;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your prop firm and broker accounts</p>
        </div>
        <button onClick={() => setModalState({ mode: 'create' })} className="btn-primary">
          + New Account
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          No accounts yet. Create one to start logging trades.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                {['Prop Firm / Broker', 'Account #', 'Name', 'Type', 'Status', 'Trades', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {accounts.map(a => (
                <tr key={a.id} className="bg-gray-950 hover:bg-gray-900 transition">
                  <td className="px-4 py-3 font-medium text-gray-100 capitalize">{a.company}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono">{a.accountNumber}</td>
                  <td className="px-4 py-3 text-gray-400">{a.accountName || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{a.accountType || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.tradesCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModalState({ mode: 'edit', account: a })}
                        className="text-xs text-gray-500 hover:text-gray-200 transition px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs text-gray-600 hover:text-red-400 transition px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalState !== null}
        onClose={() => setModalState(null)}
        title={modalState?.mode === 'edit' ? 'Edit Account' : 'New Account'}
        size="md"
      >
        {modalState?.mode === 'create' && (
          <AccountForm
            onSubmit={createMutation.mutate}
            loading={createMutation.isPending}
          />
        )}
        {modalState?.mode === 'edit' && (
          <AccountForm
            defaultValues={modalState.account}
            onSubmit={(data) => updateMutation.mutate({ id: modalState.account.id, data })}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Account"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            {deleteTarget.tradesCount > 0 ? (
              <p className="text-sm text-amber-400">
                This account has <strong>{deleteTarget.tradesCount} trade(s)</strong>.
                You must reassign or delete those trades before deleting this account.
              </p>
            ) : (
              <p className="text-sm text-gray-300">
                Permanently delete <strong className="text-gray-100">{deleteTarget.company} — {deleteTarget.accountNumber}</strong>?
                This cannot be undone.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending || deleteTarget.tradesCount > 0}
                className="btn-danger text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
