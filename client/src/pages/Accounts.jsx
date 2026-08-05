import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowCounterClockwise, CheckCircle, Eye, PencilSimple, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { accountsApi } from '../api/accounts.js';
import { AccountForm } from '../components/accounts/AccountForm.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatDate, formatNumber, formatPct, formatR, formatSignedCurrency, formatCurrency } from '../utils/formatters.js';

function money(value, account, signed = false) { return (signed ? formatSignedCurrency : formatCurrency)(value, { currency: account.baseCurrency }); }
function AccountCard({ account, onView, onEdit, onLifecycle, onDefault }) {
  const { t } = useTranslation();
  return <Card className="min-w-0 space-y-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-semibold text-primary" dir="auto">{account.accountName || account.company}</h3><p className="mt-1 truncate text-xs text-muted" dir="auto">{account.company}</p><p className="mt-1 font-mono text-xs text-secondary" dir="ltr">{account.accountNumber}</p></div><div className="flex flex-wrap justify-end gap-1"><Badge>{t(`status.${account.status}`)}</Badge>{account.isDefault && <Badge variant="positive"><CheckCircle size={13} aria-hidden="true" />{t('accounts.defaultAccount')}</Badge>}</div></div>
    <dl className="grid grid-cols-2 gap-3 text-sm adaptive:grid-cols-3">
      <div><dt className="text-xs text-muted">{t('accounts.openingBalance')}</dt><dd className="mt-1 font-mono" dir="ltr">{money(account.openingBalance, account)}</dd></div>
      <div><dt className="text-xs text-muted">{t('accounts.trackedBalance')}</dt><dd className="mt-1 font-mono" dir="ltr">{money(account.trackedBalance, account)}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.netPnl')}</dt><dd className="mt-1 font-mono" dir="ltr">{money(account.pnlNet, account, true)}</dd></div>
      <div><dt className="text-xs text-muted">{t('accounts.closedOpen')}</dt><dd className="mt-1 font-mono" dir="ltr">{account.closedTrades} / {account.openTrades}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.winRate')}</dt><dd className="mt-1 font-mono" dir="ltr">{formatPct(account.winRate)}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.averageR')}</dt><dd className="mt-1 font-mono" dir="ltr">{formatR(account.averageR)}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.profitFactor')}</dt><dd className="mt-1 font-mono" dir="ltr">{account.profitFactor == null ? '—' : formatNumber(account.profitFactor, { maximumFractionDigits: 2 })}</dd></div>
      <div><dt className="text-xs text-muted">{t('accounts.lastTrade')}</dt><dd className="mt-1 font-mono text-xs" dir="ltr">{formatDate(account.lastTradeAt)}</dd></div>
      <div><dt className="text-xs text-muted">{t('accounts.baseCurrency')}</dt><dd className="mt-1 font-mono" dir="ltr">{account.baseCurrency}</dd></div>
    </dl>
    <div className="flex flex-wrap gap-2 border-t border-default pt-3"><Button type="button" variant="secondary" size="mobile" leadingIcon={<Eye size={16} aria-hidden="true" />} onClick={() => onView(account)}>{t('common.view')}</Button><Button type="button" variant="tertiary" size="mobile" leadingIcon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => onEdit(account)}>{t('common.edit')}</Button>{account.status === 'archived' ? <Button type="button" variant="tertiary" size="mobile" leadingIcon={<ArrowCounterClockwise size={16} aria-hidden="true" />} onClick={() => onLifecycle(account, 'active')}>{t('accounts.restore')}</Button> : <><Button type="button" variant="tertiary" size="mobile" leadingIcon={<Archive size={16} aria-hidden="true" />} onClick={() => onLifecycle(account, 'archived')}>{t('accounts.archive')}</Button>{!account.isDefault && <Button type="button" variant="tertiary" size="mobile" onClick={() => onDefault(account)}>{t('accounts.setDefault')}</Button>}</>}</div>
  </Card>;
}

export default function Accounts() {
  const { t } = useTranslation(); const toast = useToast(); const qc = useQueryClient(); const navigate = useNavigate();
  const [form, setForm] = useState(null); const [confirm, setConfirm] = useState(null);
  const query = useQuery({ queryKey: ['accounts', { includeArchived: true }], queryFn: () => accountsApi.list({ includeArchived: 'true' }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['accounts'] });
  const save = useMutation({ mutationFn: ({ id, data }) => id ? accountsApi.update(id, data) : accountsApi.create(data), onSuccess: () => { invalidate(); setForm(null); toast.success(t('accounts.accountSaved')); }, onError: e => toast.error(e.response?.data?.error?.message || t('accounts.saveFailed')) });
  const lifecycle = useMutation({ mutationFn: ({ account, data }) => accountsApi.update(account.id, data), onSuccess: () => { invalidate(); setConfirm(null); toast.success(t('accounts.accountUpdated')); }, onError: e => toast.error(e.response?.data?.error?.message || t('accounts.saveFailed')) });
  const accounts = query.data || []; const active = accounts.filter(a => a.status === 'active'); const archived = accounts.filter(a => a.status !== 'active');
  const currencies = [...new Set(accounts.map(a => a.baseCurrency))]; const mixed = currencies.length > 1; const defaultAccount = accounts.find(a => a.isDefault);
  const totals = accounts.reduce((sum, a) => ({ closed: sum.closed + a.closedTrades, open: sum.open + a.openTrades, tracked: sum.tracked + a.trackedBalance }), { closed: 0, open: 0, tracked: 0 });
  const confirmLifecycle = (account, status) => setConfirm({ account, data: { status }, label: status === 'archived' ? t('accounts.archiveConfirm', { name: account.accountName || account.company }) : t('accounts.restoreConfirm', { name: account.accountName || account.company }) });
  return <div className="space-y-5"><RouteHeaderControls slot="accountActions"><Button variant="primary" size="mobile" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setForm({ mode: 'create' })}>{t('accounts.newAccount')}</Button></RouteHeaderControls>
    {query.isLoading ? <div className="grid gap-4 compact:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div> : query.isError ? <ErrorState title={t('accounts.loadFailed')} detail={t('accounts.loadFailedDetail')} onRetry={query.refetch} /> : !accounts.length ? <EmptyState title={t('accounts.noAccounts')} detail={t('accounts.noAccountsDetail')} action={<Button variant="primary" onClick={() => setForm({ mode: 'create' })}>{t('accounts.newAccount')}</Button>} /> : <>
      <section aria-labelledby="accounts-summary"><h2 id="accounts-summary" className="mb-3 text-sm font-semibold text-primary">{t('common.summary')}</h2><dl className="grid grid-cols-2 gap-3 adaptive:grid-cols-5"><Card density="compact"><dt className="text-xs text-muted">{t('accounts.activeAccounts')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{active.length}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.archivedAccounts')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{archived.length}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.defaultAccount')}</dt><dd className="mt-1 truncate text-sm" dir="auto">{defaultAccount?.accountName || defaultAccount?.company || t('accounts.noDefault')}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.closedOpen')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{totals.closed} / {totals.open}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.trackedBalance')}</dt><dd className="mt-1 font-mono text-lg" dir="ltr">{mixed ? '—' : formatCurrency(totals.tracked, { currency: currencies[0] })}</dd>{mixed && <p className="mt-1 text-xs text-muted">{t('accounts.mixedCurrencyDetail')}</p>}</Card></dl></section>
      <section aria-labelledby="active-accounts"><h2 id="active-accounts" className="mb-3 text-sm font-semibold text-primary">{t('accounts.activeAccounts')}</h2><div className="grid gap-4 compact:grid-cols-2 wide:grid-cols-3">{active.map(a => <AccountCard key={a.id} account={a} onView={account => navigate(`/accounts/${account.id}`)} onEdit={account => setForm({ mode: 'edit', account })} onLifecycle={confirmLifecycle} onDefault={account => lifecycle.mutate({ account, data: { isDefault: true } })} />)}</div></section>
      {archived.length > 0 && <section aria-labelledby="archived-accounts"><h2 id="archived-accounts" className="mb-3 text-sm font-semibold text-primary">{t('accounts.inactiveArchivedAccounts')}</h2><div className="grid gap-4 compact:grid-cols-2 wide:grid-cols-3">{archived.map(a => <AccountCard key={a.id} account={a} onView={account => navigate(`/accounts/${account.id}`)} onEdit={account => setForm({ mode: 'edit', account })} onLifecycle={confirmLifecycle} onDefault={() => {}} />)}</div></section>}
    </>}
    <Modal open={Boolean(form)} onClose={() => !save.isPending && setForm(null)} title={t(form?.mode === 'edit' ? 'accounts.editAccount' : 'accounts.newAccountDialog')} size="md">{form && <AccountForm account={form.account} loading={save.isPending} onSubmit={data => save.mutate({ id: form.account?.id, data })} />}</Modal>
    <Modal open={Boolean(confirm)} onClose={() => !lifecycle.isPending && setConfirm(null)} title={t('accounts.confirmLifecycle')} size="sm">{confirm && <div className="space-y-4"><p className="text-sm text-secondary">{confirm.label}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate(confirm)}>{t('common.update')}</Button></div></div>}</Modal>
  </div>;
}
