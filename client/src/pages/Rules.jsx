import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, ListChecks, MinusCircle, NotePencil, PencilSimple, Plus, Power, Trash, WarningCircle,
} from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router-dom';
import { rulesApi } from '../api/rules.js';
import { RuleCheckForm } from '../components/rules/RuleCheckForm.jsx';
import { RuleForm } from '../components/rules/RuleForm.jsx';
import { outcomeMeta, RULE_OUTCOMES, RULE_SCOPES, scopeLabel } from '../components/rules/ruleTypes.js';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatDateKey, periodRange } from '../utils/dateOnly.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';
import { useTranslation } from 'react-i18next';

const PERIODS = [
  { id: 'today', labelKey: 'dashboard.today' },
  { id: 'wtd', labelKey: 'dashboard.wtd' },
  { id: 'mtd', labelKey: 'dashboard.mtd' },
  { id: 'custom', labelKey: 'dashboard.custom' },
];
const VIEWS = [
  { id: 'overview', labelKey: 'rules.overview' },
  { id: 'rules', labelKey: 'rules.tabRules' },
  { id: 'history', labelKey: 'rules.history' },
];
const DEFAULT_RULE_FILTERS = Object.freeze({ status: 'all', scope: '', search: '' });
const DEFAULT_CHECK_FILTERS = Object.freeze({ ruleId: '', outcome: '', page: 1, limit: 25 });

function compactParams(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value != null));
}

function Rate({ value }) {
  return <span className="whitespace-nowrap font-mono" dir="ltr">{value == null ? '—' : `${value.toFixed(1)}%`}</span>;
}

function SummarySkeleton() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 adaptive:grid-cols-3 wide:grid-cols-6" aria-label={t('rules.loadingSummary')}>
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 w-full" label={t('rules.loadingMetric')} />)}
    </div>
  );
}

function SummaryMetrics({ summary }) {
  const { t } = useTranslation();
  const metrics = [
    { label: t('rules.overallAdherence'), value: <Rate value={summary.adherenceRate} />, tone: 'text-action' },
    { label: t('rules.eligibleChecks'), value: summary.eligibleChecks, tone: 'text-primary' },
    { label: t('rules.followed'), value: summary.followed, tone: 'text-positive', Icon: CheckCircle },
    { label: t('rules.broken'), value: summary.broken, tone: 'text-negative', Icon: WarningCircle },
    { label: t('rules.notApplicable'), value: summary.notApplicable, tone: 'text-muted', Icon: MinusCircle },
    { label: t('rules.activeRules'), value: summary.activeRules, tone: 'text-primary' },
  ];
  return (
    <section aria-labelledby="adherence-summary-heading">
      <h2 id="adherence-summary-heading" className="sr-only">{t('rules.summary')}</h2>
      <dl className="grid gap-3 adaptive:grid-cols-3 wide:grid-cols-6">
        {metrics.map(({ label, value, tone, Icon }) => (
          <Card as="div" density="compact" key={label}>
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {Icon && <Icon size={13} aria-hidden="true" />} {label}
            </dt>
            <dd className={`mt-2 whitespace-nowrap font-mono text-xl font-semibold ${tone}`} dir="ltr">{value}</dd>
          </Card>
        ))}
      </dl>
      {summary.totalChecks > 0 && summary.eligibleChecks === 0 && (
        <p className="mt-2 text-xs text-muted">{t('rules.notApplicableDetail')}</p>
      )}
    </section>
  );
}

function OutcomeBadge({ outcome }) {
  const meta = outcomeMeta(outcome);
  const Icon = outcome === 'followed' ? CheckCircle : outcome === 'broken' ? WarningCircle : MinusCircle;
  return <Badge variant={meta.variant}><Icon size={13} aria-hidden="true" /> {meta.label}</Badge>;
}

function AdherenceRows({ rules, onEdit, onRecord }) {
  const { t } = useTranslation();
  if (!rules.length) return <EmptyState title={t('rules.noChecks')} detail={t('rules.recordToMeasure')} />;
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Card key={rule.ruleId} density="compact" className="grid gap-3 adaptive:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] adaptive:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-primary">{rule.name}</h3>
              <Badge>{scopeLabel(rule.scope)}</Badge>
              <Badge variant={rule.isActive ? 'positive' : 'neutral'}>{t(`status.${rule.isActive ? 'active' : 'inactive'}`)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t('rules.lastCheck')}: <span className="whitespace-nowrap" dir="ltr">{rule.lastCheckDate ? formatDateKey(rule.lastCheckDate) : '—'}</span>
            </p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs text-secondary">
              <span>{t('rules.adherence')}</span><strong className="text-sm text-primary"><Rate value={rule.adherenceRate} /></strong>
            </div>
            {rule.adherenceRate != null && (
              <div className="mt-2 h-2 overflow-hidden rounded-sm bg-surface-sunken" role="progressbar" aria-label={t('rules.ruleAdherenceLabel', { name: rule.name })} aria-valuemin="0" aria-valuemax="100" aria-valuenow={rule.adherenceRate}>
                <span className="block h-full rounded-sm bg-action" style={{ inlineSize: `${rule.adherenceRate}%` }} />
              </div>
            )}
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <span><span className="text-positive">{t('rules.followed')}</span> <b dir="ltr">{rule.followed}</b></span>
              <span><span className="text-negative">{t('rules.broken')}</span> <b dir="ltr">{rule.broken}</b></span>
              <span>{t('rules.notApplicable')} <b dir="ltr">{rule.notApplicable}</b></span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 adaptive:justify-end">
            <Button size="sm" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => onEdit(rule)}>{t('common.edit')}</Button>
            <Button size="sm" leadingIcon={<ListChecks size={14} aria-hidden="true" />} disabled={!rule.isActive} title={!rule.isActive ? t('rules.reactivateHelp') : undefined} onClick={() => onRecord(rule.ruleId)}>{t('rules.recordCheck')}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CheckList({ checks, pagination, onEdit, onDelete, deletingId, onPageChange, compact = false }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <Card key={check.id} density="compact" className="grid gap-3 adaptive:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_auto] adaptive:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-primary">{check.rule.name}</h3>
              <OutcomeBadge outcome={check.outcome} />
            </div>
            <p className="mt-1 whitespace-nowrap font-mono text-xs text-muted" dir="ltr">{formatDateKey(check.checkDate)}</p>
            {check.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{check.notes}</p>}
          </div>
          <div className="space-y-1.5 text-xs text-secondary">
            {check.trade && (
              <p>{t('common.trades', { count: 1 })}: <Link to={`/trades/${check.trade.id}`} className="font-medium text-action underline-offset-2 hover:underline"><span className="font-mono" dir="ltr">{check.trade.symbol}</span></Link>{check.trade.accountLabel ? <>{' · '}<bdi>{check.trade.accountLabel}</bdi></> : null}</p>
            )}
            {check.journalEntry && (
              <p>{t('common.journal')}: <Link to="/insights/journal" className="font-medium text-action underline-offset-2 hover:underline">{check.journalEntry.title}</Link> <span className="text-muted">({t(`status.${check.journalEntry.isComplete ? 'complete' : 'incomplete'}`)})</span></p>
            )}
            {!check.trade && !check.journalEntry && <p className="text-muted">{t('rules.noLinkedContext')}</p>}
          </div>
          <div className="flex gap-2 adaptive:justify-end">
            <Button size="sm" variant="tertiary" leadingIcon={<NotePencil size={14} aria-hidden="true" />} onClick={() => onEdit(check)}>{t('common.edit')}</Button>
            <Button size="sm" variant="destructive" leadingIcon={<Trash size={14} aria-hidden="true" />} loading={deletingId === check.id} onClick={() => onDelete(check)}>{t('common.delete')}</Button>
          </div>
        </Card>
      ))}
      {!compact && pagination?.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t('rules.historyPages')}>
          <Button size="sm" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>{t('common.previous')}</Button>
          <span className="whitespace-nowrap font-mono text-xs text-muted" dir="ltr">{t('common.pageOf', { page: pagination.page, pages: pagination.totalPages })}</span>
          <Button size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>{t('common.next')}</Button>
        </nav>
      )}
    </div>
  );
}

export default function Rules() {
  const { t } = useTranslation();
  const timezone = useUserTimezone();
  const [view, setView] = useState('overview');
  const [period, setPeriod] = useState('mtd');
  const [dateRange, setDateRange] = useState(() => periodRange('mtd', timezone));
  const [ruleFilters, setRuleFilters] = useState({ ...DEFAULT_RULE_FILTERS });
  const [checkFilters, setCheckFilters] = useState({ ...DEFAULT_CHECK_FILTERS });
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [checkFormOpen, setCheckFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editingCheck, setEditingCheck] = useState(null);
  const [initialRuleId, setInitialRuleId] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const rangeError = dateRange.from && dateRange.to && dateRange.from > dateRange.to
    ? t('validation.dateRange')
    : '';

  const adherenceParams = useMemo(() => compactParams(dateRange), [dateRange]);
  const rulesParams = useMemo(() => compactParams(ruleFilters), [ruleFilters]);
  const checksParams = useMemo(() => compactParams({ ...dateRange, ...checkFilters }), [checkFilters, dateRange]);

  const rulesQuery = useQuery({
    queryKey: ['rules', 'list', rulesParams],
    queryFn: () => rulesApi.list(rulesParams),
    placeholderData: (previous) => previous,
  });
  const allRulesQuery = useQuery({
    queryKey: ['rules', 'list', { status: 'all' }],
    queryFn: () => rulesApi.list({ status: 'all' }),
    placeholderData: (previous) => previous,
  });
  const adherenceQuery = useQuery({
    queryKey: ['rules', 'adherence', adherenceParams],
    queryFn: () => rulesApi.adherence(adherenceParams),
    enabled: !rangeError,
    placeholderData: (previous) => previous,
  });
  const historyQuery = useQuery({
    queryKey: ['rules', 'checks', checksParams],
    queryFn: () => rulesApi.listChecks(checksParams),
    enabled: !rangeError,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new-rule') {
      setEditingRule(null);
      setRuleFormOpen(true);
    } else if (action === 'record-check') {
      setEditingCheck(null);
      setInitialRuleId('');
      setCheckFormOpen(true);
    } else return;
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  function invalidateRules() {
    queryClient.invalidateQueries({ queryKey: ['rules'] });
  }

  const createRuleMutation = useMutation({
    mutationFn: rulesApi.create,
    onSuccess: () => { invalidateRules(); setRuleFormOpen(false); toast.success(t('rules.ruleCreated')); },
    onError: () => toast.error(t('errors.saveFailed')),
  });
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }) => rulesApi.update(id, data),
    onSuccess: () => { invalidateRules(); setRuleFormOpen(false); setEditingRule(null); toast.success(t('rules.ruleUpdated')); },
    onError: () => toast.error(t('errors.saveFailed')),
  });
  const deleteRuleMutation = useMutation({
    mutationFn: rulesApi.remove,
    onSuccess: () => { invalidateRules(); toast.success(t('rules.ruleDeleted')); },
    onError: (error) => {
      if (error?.response?.data?.error?.code === 'RULE_HAS_CHECKS') {
        toast.error(t('rules.hasChecks'));
      } else toast.error(t('errors.deleteFailed'));
    },
  });
  const createCheckMutation = useMutation({
    mutationFn: rulesApi.createCheck,
    onSuccess: () => { invalidateRules(); setCheckFormOpen(false); toast.success(t('rules.checkSaved')); },
    onError: () => toast.error(t('errors.saveFailed')),
  });
  const updateCheckMutation = useMutation({
    mutationFn: ({ id, data }) => rulesApi.updateCheck(id, data),
    onSuccess: () => { invalidateRules(); setCheckFormOpen(false); setEditingCheck(null); toast.success(t('rules.checkSaved')); },
    onError: () => toast.error(t('errors.saveFailed')),
  });
  const deleteCheckMutation = useMutation({
    mutationFn: rulesApi.removeCheck,
    onSuccess: () => { invalidateRules(); toast.success(t('rules.checkDeleted')); },
    onError: () => toast.error(t('errors.deleteFailed')),
  });

  function applyPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setCheckFilters((current) => ({ ...current, page: 1 }));
    if (nextPeriod !== 'custom') setDateRange(periodRange(nextPeriod, timezone));
  }
  function updateCustomDate(key, value) {
    setPeriod('custom');
    setDateRange((current) => ({ ...current, [key]: value }));
    setCheckFilters((current) => ({ ...current, page: 1 }));
  }
  function openNewRule() { setEditingRule(null); setRuleFormOpen(true); }
  function openEditRule(rule) {
    const fullRule = (rulesQuery.data?.rules ?? []).find((item) => item.id === (rule.id ?? rule.ruleId));
    if (!fullRule && !Object.hasOwn(rule, 'description')) {
      toast.error(t('rules.detailsUnavailable'));
      return;
    }
    setEditingRule(fullRule ?? rule);
    setRuleFormOpen(true);
  }
  function openNewCheck(ruleId = '') { setEditingCheck(null); setInitialRuleId(ruleId); setCheckFormOpen(true); }
  function openEditCheck(check) { setEditingCheck(check); setInitialRuleId(check.ruleId); setCheckFormOpen(true); }
  function submitRule(data) {
    if (editingRule) updateRuleMutation.mutate({ id: editingRule.id, data });
    else createRuleMutation.mutate(data);
  }
  function submitCheck(data) {
    if (editingCheck) updateCheckMutation.mutate({ id: editingCheck.id, data });
    else createCheckMutation.mutate(data);
  }
  function toggleRule(rule) {
    updateRuleMutation.mutate({ id: rule.id, data: { isActive: !rule.isActive } });
  }
  function removeRule(rule) {
    if (window.confirm(t('rules.deleteNamedConfirm', { name: rule.name }))) deleteRuleMutation.mutate(rule.id);
  }
  function removeCheck(check) {
    if (window.confirm(t('rules.deleteCheckConfirm', { outcome: outcomeMeta(check.outcome).label, name: check.rule.name }))) deleteCheckMutation.mutate(check.id);
  }
  function clearRuleFilters() { setRuleFilters({ ...DEFAULT_RULE_FILTERS }); }
  function clearCheckFilters() { setCheckFilters({ ...DEFAULT_CHECK_FILTERS }); }

  const ruleRows = rulesQuery.data?.rules ?? [];
  const allRuleRows = allRulesQuery.data?.rules ?? ruleRows;
  const adherenceRows = adherenceQuery.data?.rules ?? [];
  const checks = historyQuery.data?.checks ?? [];
  const pagination = historyQuery.data?.pagination;
  const hasRuleFilters = Boolean(ruleFilters.status !== 'all' || ruleFilters.scope || ruleFilters.search);
  const hasCheckFilters = Boolean(checkFilters.ruleId || checkFilters.outcome);
  const noRulesAtAll = rulesQuery.isSuccess && ruleFilters.status === 'all' && !ruleFilters.scope && !ruleFilters.search && ruleRows.length === 0;
  const fullFailure = rulesQuery.isError && adherenceQuery.isError && historyQuery.isError;

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <RouteHeaderControls slot="rulesActions">
        <div className="flex w-full flex-wrap items-center gap-2 compact:w-auto compact:justify-end">
          <div role="group" aria-label={t('rules.period')} className="flex min-h-11 flex-1 gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9 adaptive:flex-none">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => applyPeriod(item.id)} className={`min-w-12 flex-1 rounded-sm px-2 font-mono text-xs transition-colors adaptive:flex-none ${period === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}>
                {t(item.labelKey)}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex w-full gap-2 adaptive:w-auto" aria-label={t('rules.customDates')}>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none"><span className="sr-only">{t('goals.startDate')}</span><input aria-label={t('goals.startDate')} type="date" dir="ltr" value={dateRange.from} onChange={(event) => updateCustomDate('from', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" /></label>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none"><span className="sr-only">{t('goals.endDate')}</span><input aria-label={t('goals.endDate')} type="date" dir="ltr" value={dateRange.to} onChange={(event) => updateCustomDate('to', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" /></label>
            </div>
          )}
          <Button type="button" variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={openNewRule}>{t('rules.newRule')}</Button>
          <Button type="button" size="mobile" className="adaptive:min-h-9" leadingIcon={<ListChecks size={16} aria-hidden="true" />} onClick={() => openNewCheck()}>{t('rules.recordCheck')}</Button>
        </div>
      </RouteHeaderControls>

      <div role="tablist" aria-label={t('rules.view')} className="flex min-h-11 overflow-x-auto rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9">
        {VIEWS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-w-28 flex-1 whitespace-nowrap rounded-sm px-3 text-sm transition-colors ${view === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}>
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {rangeError && <ErrorState title={t('rules.invalidRange')} detail={rangeError} available={t('rules.managementForms')} />}
      {fullFailure ? (
        <ErrorState title={t('rules.fullLoadFailed')} detail={t('rules.fullLoadFailedDetail')} available={t('rules.periodAndForms')} onRetry={() => Promise.all([rulesQuery.refetch(), adherenceQuery.refetch(), historyQuery.refetch()])} />
      ) : view === 'overview' ? (
        <div className="space-y-4 adaptive:space-y-5">
          {adherenceQuery.isLoading ? <SummarySkeleton /> : adherenceQuery.isError && !adherenceQuery.data ? (
            <ErrorState title={t('rules.summaryLoadFailed')} detail={t('rules.rulesHistoryAvailable')} available={t('rules.managementHistory')} onRetry={adherenceQuery.refetch} />
          ) : <SummaryMetrics summary={adherenceQuery.data.summary} />}
          {adherenceQuery.isError && adherenceQuery.data && <ErrorState title={t('rules.refreshFailed')} detail={t('rules.lastResultsVisible')} available={t('rules.rulesAndHistory')} onRetry={adherenceQuery.refetch} />}
          <section aria-labelledby="per-rule-heading">
            <div className="mb-2 flex items-center justify-between gap-3"><h2 id="per-rule-heading" className="text-sm font-semibold text-primary">{t('rules.perRule')}</h2>{adherenceQuery.isFetching && !adherenceQuery.isLoading && <span className="text-xs text-muted">{t('common.loading')}</span>}</div>
            {adherenceQuery.isLoading ? <Skeleton className="h-40 w-full" label={t('rules.loadingPerRule')} /> : adherenceQuery.data && <AdherenceRows rules={adherenceRows} onEdit={openEditRule} onRecord={openNewCheck} />}
          </section>
          <section aria-labelledby="recent-checks-heading">
            <h2 id="recent-checks-heading" className="mb-2 text-sm font-semibold text-primary">{t('rules.recentChecks')}</h2>
            {historyQuery.isError && !historyQuery.data ? <ErrorState title={t('rules.recentLoadFailed')} detail={t('rules.adherenceRulesAvailable')} available={t('rules.adherenceManagement')} onRetry={historyQuery.refetch} />
              : historyQuery.isLoading ? <Skeleton className="h-32 w-full" label={t('rules.loadingRecent')} />
                : checks.length ? <CheckList checks={checks.slice(0, 5)} compact onEdit={openEditCheck} onDelete={removeCheck} deletingId={deleteCheckMutation.isPending ? deleteCheckMutation.variables : null} />
                  : <EmptyState title={noRulesAtAll ? 'No trading rules yet' : 'No rule checks in this period'} detail={noRulesAtAll ? 'Create your first rule to begin tracking process consistency.' : 'Record what happened to begin measuring adherence.'} />}
          </section>
        </div>
      ) : view === 'rules' ? (
        <section aria-labelledby="rules-management-heading" className="space-y-3">
          <h2 id="rules-management-heading" className="sr-only">{t('rules.management')}</h2>
          <Card density="compact">
            <div className="flex flex-wrap gap-2">
              <label className="min-w-52 flex-[2_1_18rem]"><span className="sr-only">{t('rules.search')}</span><input type="search" value={ruleFilters.search} onChange={(event) => setRuleFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t('rules.search')} className="input min-h-11 adaptive:min-h-9" /></label>
              <label className="min-w-36 flex-1"><span className="sr-only">{t('rules.statusFilter')}</span><select aria-label={t('rules.statusFilter')} value={ruleFilters.status} onChange={(event) => setRuleFilters((current) => ({ ...current, status: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="all">{t('common.allStatuses')}</option><option value="active">{t('status.active')}</option><option value="inactive">{t('status.inactive')}</option></select></label>
              <label className="min-w-36 flex-1"><span className="sr-only">{t('rules.scopeFilter')}</span><select aria-label={t('rules.scopeFilter')} value={ruleFilters.scope} onChange={(event) => setRuleFilters((current) => ({ ...current, scope: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="">{t('rules.allScopes')}</option>{RULE_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
              {hasRuleFilters && ruleRows.length > 0 && <Button size="mobile" className="adaptive:min-h-9" onClick={clearRuleFilters}>{t('common.clearFilters')}</Button>}
            </div>
          </Card>
          {rulesQuery.isError && rulesQuery.data && <ErrorState title={t('rules.rulesRefreshFailed')} detail={t('rules.lastRulesVisible')} available={t('rules.editingChecksAvailable')} onRetry={rulesQuery.refetch} />}
          {rulesQuery.isLoading ? <Skeleton className="h-48 w-full" label={t('rules.loadingRules')} /> : rulesQuery.isError && !rulesQuery.data ? <ErrorState title={t('rules.rulesLoadFailed')} detail={t('rules.rulesRequestFailed')} available={t('rules.adherenceHistory')} onRetry={rulesQuery.refetch} /> : ruleRows.length === 0 ? (
            <EmptyState filtered={hasRuleFilters} onClear={clearRuleFilters} title={hasRuleFilters ? t('rules.filteredEmpty') : t('rules.noRules')} detail={hasRuleFilters ? t('rules.clearRuleFiltersDetail') : t('rules.noRulesDetail')} />
          ) : (
            <div className="space-y-2">
              {ruleRows.map((rule) => (
                <Card key={rule.id} density="compact" className="grid gap-3 adaptive:grid-cols-[minmax(14rem,1fr)_auto] adaptive:items-center">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-primary">{rule.name}</h3><Badge>{scopeLabel(rule.scope)}</Badge><Badge variant={rule.isActive ? 'positive' : 'neutral'}>{t(`status.${rule.isActive ? 'active' : 'inactive'}`)}</Badge></div>{rule.description && <p className="mt-1 text-sm text-secondary">{rule.description}</p>}<p className="mt-1 text-xs text-muted">{t('rules.historicalChecks', { count: rule.checkCount ?? 0 })}</p></div>
                  <div className="flex flex-wrap gap-2 adaptive:justify-end"><Button size="sm" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => openEditRule(rule)}>{t('common.edit')}</Button><Button size="sm" leadingIcon={<Power size={14} aria-hidden="true" />} loading={updateRuleMutation.isPending && updateRuleMutation.variables?.id === rule.id} onClick={() => toggleRule(rule)}>{t(rule.isActive ? 'rules.deactivate' : 'rules.reactivate')}</Button><Button size="sm" variant="destructive" leadingIcon={<Trash size={14} aria-hidden="true" />} loading={deleteRuleMutation.isPending && deleteRuleMutation.variables === rule.id} onClick={() => removeRule(rule)}>{t('common.delete')}</Button></div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="check-history-heading" className="space-y-3">
          <h2 id="check-history-heading" className="sr-only">{t('rules.history')}</h2>
          <Card density="compact"><div className="flex flex-wrap gap-2"><label className="min-w-48 flex-1"><span className="sr-only">{t('rules.historyRule')}</span><select aria-label={t('rules.historyRule')} value={checkFilters.ruleId} onChange={(event) => setCheckFilters((current) => ({ ...current, ruleId: event.target.value, page: 1 }))} className="input min-h-11 adaptive:min-h-9"><option value="">{t('rules.allRules')}</option>{allRuleRows.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label><label className="min-w-48 flex-1"><span className="sr-only">{t('rules.historyOutcome')}</span><select aria-label={t('rules.historyOutcome')} value={checkFilters.outcome} onChange={(event) => setCheckFilters((current) => ({ ...current, outcome: event.target.value, page: 1 }))} className="input min-h-11 adaptive:min-h-9"><option value="">{t('rules.allOutcomes')}</option>{RULE_OUTCOMES.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select></label>{hasCheckFilters && checks.length > 0 && <Button size="mobile" className="adaptive:min-h-9" onClick={clearCheckFilters}>{t('common.clearFilters')}</Button>}</div></Card>
          {historyQuery.isError && historyQuery.data && <ErrorState title={t('rules.historyRefreshFailed')} detail={t('rules.lastChecksVisible')} available={t('rules.adherenceAndRules')} onRetry={historyQuery.refetch} />}
          {historyQuery.isLoading ? <Skeleton className="h-48 w-full" label={t('rules.loadingHistory')} /> : historyQuery.isError && !historyQuery.data ? <ErrorState title={t('rules.historyLoadFailed')} detail={t('rules.historyLoadFailedDetail')} available={t('rules.adherenceAndRules')} onRetry={historyQuery.refetch} /> : checks.length === 0 ? <EmptyState filtered={hasCheckFilters} onClear={clearCheckFilters} title={hasCheckFilters ? t('states.noMatching') : t('rules.noChecks')} detail={hasCheckFilters ? t('rules.clearCheckFiltersDetail') : t('rules.recordToMeasure')} /> : <CheckList checks={checks} pagination={pagination} onEdit={openEditCheck} onDelete={removeCheck} deletingId={deleteCheckMutation.isPending ? deleteCheckMutation.variables : null} onPageChange={(page) => setCheckFilters((current) => ({ ...current, page }))} />}
        </section>
      )}

      <Modal open={ruleFormOpen} onClose={() => { if (!createRuleMutation.isPending && !updateRuleMutation.isPending) { setRuleFormOpen(false); setEditingRule(null); } }} title={editingRule ? t('rules.editRuleDialog') : t('rules.newRuleDialog')} size="md">
        <RuleForm key={editingRule?.id ?? 'new'} rule={editingRule} onSubmit={submitRule} loading={createRuleMutation.isPending || updateRuleMutation.isPending} />
      </Modal>
      <Modal open={checkFormOpen} onClose={() => { if (!createCheckMutation.isPending && !updateCheckMutation.isPending) { setCheckFormOpen(false); setEditingCheck(null); setInitialRuleId(''); } }} title={editingCheck ? t('rules.editCheckDialog') : t('rules.recordCheckFormDialog')} size="lg">
        <RuleCheckForm key={editingCheck?.id ?? `new-${initialRuleId}`} check={editingCheck} rules={allRuleRows} initialRuleId={initialRuleId} timezone={timezone} onSubmit={submitCheck} loading={createCheckMutation.isPending || updateCheckMutation.isPending} />
      </Modal>
    </div>
  );
}
