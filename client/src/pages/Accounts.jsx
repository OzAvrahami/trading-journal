import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { Plus } from '@phosphor-icons/react';
import { Button } from '../components/ui/Button.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
          <label className="label">{t('accounts.broker', { defaultValue: 'Prop Firm / Broker' })} *</label>
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
          <label className="label">{t('common.accountNumber')} *</label>
          <input
            className="input"
            placeholder={t('accounts.numberPlaceholder')}
            dir="ltr"
            value={form.accountNumber}
            onChange={e => set('accountNumber', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('common.displayName')}</label>
          <input
            className="input"
            placeholder={t('accounts.namePlaceholder')}
            value={form.accountName}
            onChange={e => set('accountName', e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t('common.type')}</label>
          <select className="input" value={form.accountType} onChange={e => set('accountType', e.target.value)}>
            <option value="">—</option>
            {ACCOUNT_TYPES.map(type => <option key={type} value={type}>{t(`status.${type}`)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{t('common.status')}</label>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          {ACCOUNT_STATUSES.map(status => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
        </select>
      </div>

      <div className="pt-1">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('common.saving') : (defaultValues.id ? t('accounts.editAccount') : t('auth.createAccount'))}
        </button>
      </div>
    </form>
  );
}

// ---- Main page --------------------------------------------------------------

export default function Accounts() {
  const { t } = useTranslation();
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
    onSuccess: () => { invalidate(); toast.success(t('accounts.accountCreated')); setModalState(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || t('accounts.saveFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => accountsApi.update(id, data),
    onSuccess: () => { invalidate(); toast.success(t('accounts.accountUpdated')); setModalState(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || t('accounts.saveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => accountsApi.remove(id),
    onSuccess: () => { invalidate(); toast.success(t('accounts.accountDeleted')); setDeleteTarget(null); },
    onError:   (err) => toast.error(err.response?.data?.error?.message || t('accounts.deleteFailed')),
  });

  function accountLabel(a) {
    const base = `${a.company} — ${a.accountNumber}`;
    return a.accountName ? `${base} (${a.accountName})` : base;
  }

  return (
    <div className="space-y-4">
      <RouteHeaderControls
        slot="accountActions"
        commands={[{ id: 'addAccount', label: t('accounts.newAccount'), description: t('accounts.newAccount'), keywords: 'new broker prop firm', Icon: Plus, action: () => setModalState({ mode: 'create' }) }]}
      >
        <Button variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setModalState({ mode: 'create' })}>
          {t('accounts.newAccount')}
        </Button>
      </RouteHeaderControls>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          {t('accounts.noAccountsDetail')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                {[t('accounts.broker', { defaultValue: 'Prop Firm / Broker' }), t('common.accountNumber'), t('common.name'), t('common.type'), t('common.status'), t('common.trades'), ''].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-medium text-gray-500 whitespace-nowrap">
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
                  <td className="px-4 py-3 text-gray-400">{a.accountType ? t(`status.${a.accountType}`) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[a.status] || 'badge-gray'}`}>{t(`status.${a.status}`)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.tradesCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModalState({ mode: 'edit', account: a })}
                        className="text-xs text-gray-500 hover:text-gray-200 transition px-2 py-1"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs text-gray-600 hover:text-red-400 transition px-2 py-1"
                      >
                        {t('common.delete')}
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
        title={modalState?.mode === 'edit' ? t('accounts.editAccount') : t('accounts.newAccountDialog')}
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
        title={t('accounts.deleteAccount')}
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            {deleteTarget.tradesCount > 0 ? (
              <p className="text-sm text-amber-400">
                {t('accounts.hasTrades', { count: deleteTarget.tradesCount })}
              </p>
            ) : (
              <p className="text-sm text-gray-300">
                {t('accounts.permanentDelete', { account: `${deleteTarget.company} — ${deleteTarget.accountNumber}` })}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending || deleteTarget.tradesCount > 0}
                className="btn-danger text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
