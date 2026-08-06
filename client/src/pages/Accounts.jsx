import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowCounterClockwise, CheckCircle, Eye, PencilSimple, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { accountsApi } from '../api/accounts.js';
import { portfolioApi } from '../api/portfolio.js';
import { AccountForm } from '../components/accounts/AccountForm.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatDate, formatNumber, formatPct, formatR, formatSignedCurrency } from '../utils/formatters.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';

const GROUPS = ['personal_investment', 'active_trading', 'prop_firm'];
function money(value, currency, signed = false) { return value == null ? '—' : (signed ? formatSignedCurrency : formatCurrency)(value, { currency }); }

function ParticipationControl({ account, field, label, pending, onChange }) {
  const groupBlocked = account.accountGroup === 'prop_firm' && field !== 'includeInTradingAnalytics';
  return <label className="flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface-sunken px-2.5 text-xs text-secondary">
    <input type="checkbox" checked={Boolean(account[field])} disabled={pending || groupBlocked || account.status === 'archived'} onChange={(event) => onChange(account, field, event.target.checked)} />
    <span>{label}</span>
    {pending && <span className="ms-auto text-muted" role="status">…</span>}
  </label>;
}

function AccountCard({ account, onView, onEdit, onLifecycle, onDefault, onParticipation, pendingField }) {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const investment = account.linkedInvestmentPortfolio;
  const investmentReady = account.includeInInvestmentValue && account.investmentSetupComplete;
  return <Card as="article" className="min-w-0 space-y-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-semibold text-primary" dir="auto">{account.accountName || account.company}</h3><p className="mt-1 truncate text-xs text-muted" dir="auto">{account.company}</p><p className="mt-1 font-mono text-xs text-secondary" dir="ltr">{account.accountNumber}</p></div><div className="flex flex-wrap justify-end gap-1"><Badge>{t(`status.${account.status}`)}</Badge>{account.isDefault && <Badge variant="positive"><CheckCircle size={13} aria-hidden="true" />{t('accounts.defaultAccount')}</Badge>}</div></div>
    <dl className="grid grid-cols-2 gap-3 text-sm adaptive:grid-cols-3">
      <div><dt className="text-xs text-muted">{investmentReady ? t('portfolio.totalValue') : t('accounts.trackedBalance')}</dt><dd className="mt-1 font-mono" dir="ltr">{investmentReady ? money(investment.totalValue, account.baseCurrency) : money(account.trackedBalance, account.baseCurrency)}</dd></div>
      <div><dt className="text-xs text-muted">{investmentReady ? t('portfolio.cashBalance') : t('common.netPnl')}</dt><dd className="mt-1 font-mono" dir="ltr">{investmentReady ? money(investment.cashBalance, account.baseCurrency) : money(account.pnlNet, account.baseCurrency, true)}</dd></div>
      <div><dt className="text-xs text-muted">{investmentReady ? t('portfolio.positions') : t('accounts.closedOpen')}</dt><dd className="mt-1 font-mono" dir="ltr">{investmentReady ? formatNumber(investment.positionCount) : `${account.closedTrades} / ${account.openTrades}`}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.winRate')}</dt><dd className="mt-1 font-mono" dir="ltr">{formatPct(account.winRate)}</dd></div>
      <div><dt className="text-xs text-muted">{t('common.averageR')}</dt><dd className="mt-1 font-mono" dir="ltr">{formatR(account.averageR)}</dd></div>
      <div><dt className="text-xs text-muted">{t('accounts.lastTrade')}</dt><dd className="mt-1 font-mono text-xs" dir="ltr">{formatDate(account.lastTradeAt, { timezone })}</dd></div>
    </dl>
    <div className="space-y-2" aria-label={t('accounts.participation')}>
      <ParticipationControl account={account} field="includeInInvestmentValue" label={t('accounts.portfolioValue')} pending={pendingField === 'includeInInvestmentValue'} onChange={onParticipation} />
      <ParticipationControl account={account} field="includeInNetWorth" label={t('accounts.personalNetWorth')} pending={pendingField === 'includeInNetWorth'} onChange={onParticipation} />
      <ParticipationControl account={account} field="includeInTradingAnalytics" label={t('accounts.tradingAnalytics')} pending={pendingField === 'includeInTradingAnalytics'} onChange={onParticipation} />
    </div>
    {account.includeInInvestmentValue && !account.investmentSetupComplete && <div role="status" className="rounded-md border border-warning bg-warning-soft p-2 text-xs text-secondary"><strong className="block text-primary">{t('accounts.investmentSetupIncomplete')}</strong>{t('accounts.investmentSetupIncompleteDetail')}</div>}
    {investmentReady && <div className="flex items-center justify-between gap-2 rounded-md bg-information-soft p-2 text-xs text-secondary"><span>{t('accounts.includedInInvestments')}</span><Link className="font-medium text-action" to={`/portfolio?accountId=${encodeURIComponent(account.id)}`}>{t('accounts.openInvestments')}</Link></div>}
    <div className="flex flex-wrap gap-2 border-t border-default pt-3"><Button type="button" variant="secondary" size="mobile" leadingIcon={<Eye size={16} aria-hidden="true" />} onClick={() => onView(account)}>{t('common.view')}</Button><Button type="button" variant="tertiary" size="mobile" leadingIcon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => onEdit(account)}>{t('common.edit')}</Button>{account.status === 'archived' ? <Button type="button" variant="tertiary" size="mobile" leadingIcon={<ArrowCounterClockwise size={16} aria-hidden="true" />} onClick={() => onLifecycle(account, 'active')}>{t('accounts.restore')}</Button> : <><Button type="button" variant="tertiary" size="mobile" leadingIcon={<Archive size={16} aria-hidden="true" />} onClick={() => onLifecycle(account, 'archived')}>{t('accounts.archive')}</Button>{!account.isDefault && <Button type="button" variant="tertiary" size="mobile" onClick={() => onDefault(account)}>{t('accounts.setDefault')}</Button>}</>}</div>
  </Card>;
}

function UnlinkedInvestmentPanel({ portfolios, accounts, onLink, onCreate }) {
  const { t } = useTranslation();
  if (!portfolios.length) return null;
  return <section aria-labelledby="unlinked-investments"><div className="mb-3"><h2 id="unlinked-investments" className="text-sm font-semibold text-primary">{t('accounts.unlinkedInvestmentData')}</h2><p className="mt-1 text-xs text-muted">{t('accounts.unlinkedInvestmentDataDetail')}</p></div><div className="grid gap-3 compact:grid-cols-2">{portfolios.map((portfolio) => {
    const candidates = accounts.filter((account) => !account.linkedInvestmentPortfolio && account.baseCurrency === portfolio.baseCurrency && account.status !== 'archived');
    return <Card key={portfolio.id} density="compact"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-primary" dir="auto">{portfolio.name}</h3><p className="mt-1 text-xs text-muted" dir="ltr">{portfolio.baseCurrency}</p></div><Badge>{t(`status.${portfolio.status}`)}</Badge></div><p className="mt-3 text-xs text-secondary">{t('accounts.existingInvestmentPreserved')}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="mobile" disabled={!candidates.length} onClick={() => onLink(portfolio, candidates)}>{t('accounts.linkToAccount')}</Button><Button size="mobile" variant="secondary" onClick={() => onCreate(portfolio)}>{t('accounts.createAndLink')}</Button></div>{!candidates.length && <p className="mt-2 text-xs text-muted">{t('accounts.noCompatibleAccount')}</p>}</Card>;
  })}</div></section>;
}

export default function Accounts() {
  const { t } = useTranslation(); const toast = useToast(); const qc = useQueryClient(); const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(null); const [confirm, setConfirm] = useState(null); const [linking, setLinking] = useState(null); const [linkAccountId, setLinkAccountId] = useState('');
  const query = useQuery({ queryKey: ['accounts', { includeArchived: true }], queryFn: () => accountsApi.list({ includeArchived: 'true' }) });
  const portfoliosQuery = useQuery({ queryKey: ['portfolios', { includeArchived: true }], queryFn: () => portfolioApi.list({ includeArchived: 'true' }) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['account'] }); qc.invalidateQueries({ queryKey: ['portfolios'] }); qc.invalidateQueries({ queryKey: ['portfolio'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); };
  const save = useMutation({ mutationFn: ({ id, data }) => id ? accountsApi.update(id, data) : accountsApi.create(data), onSuccess: () => { invalidate(); setForm(null); toast.success(t('accounts.accountSaved')); }, onError: e => toast.error(t(`errors.${e.response?.data?.error?.code}`, { defaultValue: t('accounts.saveFailed') })) });
  const lifecycle = useMutation({ mutationFn: ({ account, data }) => accountsApi.update(account.id, data), onSuccess: () => { invalidate(); setConfirm(null); toast.success(t('accounts.accountUpdated')); }, onError: e => toast.error(t(`errors.${e.response?.data?.error?.code}`, { defaultValue: t('accounts.saveFailed') })) });
  const participation = useMutation({ mutationFn: ({ account, field, checked }) => accountsApi.update(account.id, { [field]: checked }), onSuccess: () => { invalidate(); setConfirm(null); toast.success(t('accounts.participationUpdated')); }, onError: e => toast.error(t(`errors.${e.response?.data?.error?.code}`, { defaultValue: t('accounts.participationFailed') })) });
  const linkMutation = useMutation({ mutationFn: ({ accountId, portfolioId }) => accountsApi.linkInvestmentPortfolio(accountId, portfolioId), onSuccess: () => { invalidate(); setLinking(null); setLinkAccountId(''); toast.success(t('accounts.investmentLinked')); }, onError: e => toast.error(t(`errors.${e.response?.data?.error?.code}`, { defaultValue: t('accounts.linkFailed') })) });
  const accounts = (query.data || []).map((account) => ({
    ...account,
    accountGroup: account.accountGroup || 'active_trading',
    includeInInvestmentValue: Boolean(account.includeInInvestmentValue),
    includeInNetWorth: Boolean(account.includeInNetWorth),
    includeInTradingAnalytics: account.includeInTradingAnalytics !== false,
  })); const active = accounts.filter(a => a.status !== 'archived'); const archived = accounts.filter(a => a.status === 'archived');
  const portfolios = portfoliosQuery.data?.portfolios || []; const unlinked = portfolios.filter((portfolio) => !portfolio.tradingAccountId);
  useEffect(() => { const id = searchParams.get('linkPortfolioId'); const portfolio = unlinked.find((item) => item.id === id); if (portfolio) { setLinking({ portfolio, candidates: active.filter(a => !a.linkedInvestmentPortfolio && a.baseCurrency === portfolio.baseCurrency) }); setSearchParams({}, { replace: true }); } }, [active, searchParams, setSearchParams, unlinked]);
  const grouped = useMemo(() => Object.fromEntries(GROUPS.map((group) => [group, active.filter((account) => account.accountGroup === group)])), [active]);
  const startLink = (portfolio, candidates) => { setLinking({ portfolio, candidates }); setLinkAccountId(candidates[0]?.id || ''); };
  const changeParticipation = (account, field, checked) => {
    if (field === 'includeInInvestmentValue' && !checked && account.linkedInvestmentPortfolio) {
      setConfirm({ account, data: { [field]: false }, type: 'participation', label: t('accounts.disableInvestmentConfirm') }); return;
    }
    participation.mutate({ account, field, checked });
  };
  const confirmLifecycle = (account, status) => setConfirm({ account, data: { status }, type: 'lifecycle', label: status === 'archived' ? t('accounts.archiveConfirm', { name: account.accountName || account.company }) : t('accounts.restoreConfirm', { name: account.accountName || account.company }) });
  return <div className="space-y-6"><RouteHeaderControls slot="accountActions"><Button variant="primary" size="mobile" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setForm({ mode: 'create' })}>{t('accounts.newAccount')}</Button></RouteHeaderControls>
    {query.isLoading ? <div className="grid gap-4 compact:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div> : query.isError ? <ErrorState title={t('accounts.loadFailed')} detail={t('accounts.loadFailedDetail')} onRetry={query.refetch} /> : !accounts.length ? <EmptyState title={t('accounts.noAccounts')} detail={t('accounts.noAccountsDetail')} action={<Button variant="primary" onClick={() => setForm({ mode: 'create' })}>{t('accounts.newAccount')}</Button>} /> : <>
      <section aria-labelledby="accounts-summary"><h2 id="accounts-summary" className="mb-3 text-sm font-semibold text-primary">{t('common.summary')}</h2><dl className="grid grid-cols-2 gap-3 adaptive:grid-cols-4"><Card density="compact"><dt className="text-xs text-muted">{t('accounts.activeAccounts')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{active.length}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.includedInInvestments')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{active.filter(a => a.includeInInvestmentValue).length}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.personalNetWorth')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{active.filter(a => a.includeInNetWorth).length}</dd></Card><Card density="compact"><dt className="text-xs text-muted">{t('accounts.tradingAnalytics')}</dt><dd className="mt-1 font-mono text-xl" dir="ltr">{active.filter(a => a.includeInTradingAnalytics).length}</dd></Card></dl>{new Set(accounts.map(a=>a.baseCurrency)).size>1&&<p className="mt-3 rounded-md border border-warning bg-warning-soft p-3 text-sm text-secondary" role="status">{t('accounts.mixedCurrencyDetail')}</p>}</section>
      {GROUPS.map(group => grouped[group].length > 0 && <section key={group} aria-labelledby={`accounts-${group}`}><div className="mb-3 flex flex-wrap items-baseline gap-2"><h2 id={`accounts-${group}`} className="text-sm font-semibold text-primary">{t(`accounts.groups.${group}`)}</h2><span className="text-xs text-muted">{t(`accounts.groupNotes.${group}`)}</span></div><div className="grid gap-4 compact:grid-cols-2 wide:grid-cols-3">{grouped[group].map(account => <AccountCard key={account.id} account={account} onView={value => navigate(`/accounts/${value.id}`)} onEdit={value => setForm({ mode: 'edit', account: value })} onLifecycle={confirmLifecycle} onDefault={value => lifecycle.mutate({ account: value, data: { isDefault: true } })} onParticipation={changeParticipation} pendingField={participation.isPending && participation.variables?.account.id === account.id ? participation.variables.field : null} />)}</div></section>)}
      {archived.length > 0 && <section aria-labelledby="archived-accounts"><h2 id="archived-accounts" className="mb-3 text-sm font-semibold text-primary">{t('accounts.inactiveArchivedAccounts')}</h2><div className="grid gap-4 compact:grid-cols-2 wide:grid-cols-3">{archived.map(account => <AccountCard key={account.id} account={account} onView={value => navigate(`/accounts/${value.id}`)} onEdit={value => setForm({ mode: 'edit', account: value })} onLifecycle={confirmLifecycle} onDefault={() => {}} onParticipation={() => {}} />)}</div></section>}
    </>}
    {portfoliosQuery.isError && <ErrorState title={t('accounts.investmentDataLoadFailed')} detail={t('accounts.investmentDataLoadFailedDetail')} onRetry={portfoliosQuery.refetch} />}
    {!portfoliosQuery.isLoading && !portfoliosQuery.isError && <UnlinkedInvestmentPanel portfolios={unlinked} accounts={accounts} onLink={startLink} onCreate={(portfolio) => setForm({ mode: 'create-link', initialValues: { accountName: portfolio.name, baseCurrency: portfolio.baseCurrency, accountGroup: 'personal_investment', includeInInvestmentValue: true, includeInNetWorth: true, includeInTradingAnalytics: false, linkPortfolioId: portfolio.id } })} />}
    <Modal open={Boolean(form)} onClose={() => !save.isPending && setForm(null)} title={t(form?.mode === 'edit' ? 'accounts.editAccount' : form?.mode === 'create-link' ? 'accounts.createAndLink' : 'accounts.newAccountDialog')} size="lg">{form && <AccountForm account={form.account} initialValues={form.initialValues} loading={save.isPending} onSubmit={data => save.mutate({ id: form.account?.id, data })} />}</Modal>
    <Modal open={Boolean(linking)} onClose={() => !linkMutation.isPending && setLinking(null)} title={t('accounts.linkToAccount')} size="sm">{linking && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); linkMutation.mutate({ accountId: linkAccountId, portfolioId: linking.portfolio.id }); }}><p className="text-sm text-secondary">{t('accounts.linkExistingDetail', { name: linking.portfolio.name })}</p><label className="label" htmlFor="link-account">{t('common.account')}</label><select id="link-account" className="input min-h-11" value={linkAccountId} onChange={event => setLinkAccountId(event.target.value)} required>{linking.candidates.map(account => <option key={account.id} value={account.id}>{account.accountName || account.company} · {account.accountNumber}</option>)}</select><p className="text-xs text-muted">{t('accounts.noAutomaticMatching')}</p><Button className="w-full" variant="primary" size="mobile" type="submit" disabled={!linkAccountId || linkMutation.isPending}>{t('accounts.linkToAccount')}</Button></form>}</Modal>
    <Modal open={Boolean(confirm)} onClose={() => !(lifecycle.isPending || participation.isPending) && setConfirm(null)} title={t(confirm?.type === 'participation' ? 'accounts.confirmParticipation' : 'accounts.confirmLifecycle')} size="sm">{confirm && <div className="space-y-4"><p className="text-sm text-secondary">{confirm.label}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={lifecycle.isPending || participation.isPending} onClick={() => confirm.type === 'participation' ? participation.mutate({ account: confirm.account, field: 'includeInInvestmentValue', checked: false }) : lifecycle.mutate(confirm)}>{t('common.update')}</Button></div></div>}</Modal>
  </div>;
}
