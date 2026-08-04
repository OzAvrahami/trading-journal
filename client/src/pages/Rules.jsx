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

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'wtd', label: 'WTD' },
  { id: 'mtd', label: 'MTD' },
  { id: 'custom', label: 'Custom' },
];
const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'rules', label: 'Rules' },
  { id: 'history', label: 'Check History' },
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
  return (
    <div className="grid gap-3 adaptive:grid-cols-3 wide:grid-cols-6" aria-label="Loading adherence summary">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 w-full" label="Loading adherence metric" />)}
    </div>
  );
}

function SummaryMetrics({ summary }) {
  const metrics = [
    { label: 'Overall adherence', value: <Rate value={summary.adherenceRate} />, tone: 'text-action' },
    { label: 'Eligible checks', value: summary.eligibleChecks, tone: 'text-primary' },
    { label: 'Followed', value: summary.followed, tone: 'text-positive', Icon: CheckCircle },
    { label: 'Broken', value: summary.broken, tone: 'text-negative', Icon: WarningCircle },
    { label: 'Not applicable', value: summary.notApplicable, tone: 'text-muted', Icon: MinusCircle },
    { label: 'Active rules', value: summary.activeRules, tone: 'text-primary' },
  ];
  return (
    <section aria-labelledby="adherence-summary-heading">
      <h2 id="adherence-summary-heading" className="sr-only">Adherence summary</h2>
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
        <p className="mt-2 text-xs text-muted">All checks in this period are not applicable, so they are excluded from the adherence denominator.</p>
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
  if (!rules.length) return <EmptyState title="No rule checks in this period" detail="Record what happened to begin measuring adherence." />;
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Card key={rule.ruleId} density="compact" className="grid gap-3 adaptive:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] adaptive:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-primary">{rule.name}</h3>
              <Badge>{scopeLabel(rule.scope)}</Badge>
              <Badge variant={rule.isActive ? 'positive' : 'neutral'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Last check: <span className="whitespace-nowrap" dir="ltr">{rule.lastCheckDate ? formatDateKey(rule.lastCheckDate) : '—'}</span>
            </p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs text-secondary">
              <span>Adherence</span><strong className="text-sm text-primary"><Rate value={rule.adherenceRate} /></strong>
            </div>
            {rule.adherenceRate != null && (
              <div className="mt-2 h-2 overflow-hidden rounded-sm bg-surface-sunken" role="progressbar" aria-label={`${rule.name} adherence`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={rule.adherenceRate}>
                <span className="block h-full rounded-sm bg-action" style={{ inlineSize: `${rule.adherenceRate}%` }} />
              </div>
            )}
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <span><span className="text-positive">Followed</span> <b dir="ltr">{rule.followed}</b></span>
              <span><span className="text-negative">Broken</span> <b dir="ltr">{rule.broken}</b></span>
              <span>Not applicable <b dir="ltr">{rule.notApplicable}</b></span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 adaptive:justify-end">
            <Button size="sm" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => onEdit(rule)}>Edit</Button>
            <Button size="sm" leadingIcon={<ListChecks size={14} aria-hidden="true" />} disabled={!rule.isActive} title={!rule.isActive ? 'Reactivate this rule before recording a new check.' : undefined} onClick={() => onRecord(rule.ruleId)}>Record Check</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CheckList({ checks, pagination, onEdit, onDelete, deletingId, onPageChange, compact = false }) {
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
              <p>Trade: <Link to={`/trades/${check.trade.id}`} className="font-medium text-action underline-offset-2 hover:underline"><span className="font-mono" dir="ltr">{check.trade.symbol}</span></Link>{check.trade.accountLabel ? ` · ${check.trade.accountLabel}` : ''}</p>
            )}
            {check.journalEntry && (
              <p>Journal: <Link to="/insights/journal" className="font-medium text-action underline-offset-2 hover:underline">{check.journalEntry.title}</Link> <span className="text-muted">({check.journalEntry.isComplete ? 'complete' : 'incomplete'})</span></p>
            )}
            {!check.trade && !check.journalEntry && <p className="text-muted">No linked context</p>}
          </div>
          <div className="flex gap-2 adaptive:justify-end">
            <Button size="sm" variant="tertiary" leadingIcon={<NotePencil size={14} aria-hidden="true" />} onClick={() => onEdit(check)}>Edit</Button>
            <Button size="sm" variant="destructive" leadingIcon={<Trash size={14} aria-hidden="true" />} loading={deletingId === check.id} onClick={() => onDelete(check)}>Delete</Button>
          </div>
        </Card>
      ))}
      {!compact && pagination?.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Check history pages">
          <Button size="sm" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</Button>
          <span className="whitespace-nowrap font-mono text-xs text-muted" dir="ltr">Page {pagination.page} of {pagination.totalPages}</span>
          <Button size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</Button>
        </nav>
      )}
    </div>
  );
}

export default function Rules() {
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
    ? 'End date must not precede start date.'
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
    onSuccess: () => { invalidateRules(); setRuleFormOpen(false); toast.success('Trading rule created.'); },
    onError: () => toast.error('Trading rule could not be created.'),
  });
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }) => rulesApi.update(id, data),
    onSuccess: () => { invalidateRules(); setRuleFormOpen(false); setEditingRule(null); toast.success('Trading rule updated.'); },
    onError: () => toast.error('Trading rule could not be updated.'),
  });
  const deleteRuleMutation = useMutation({
    mutationFn: rulesApi.remove,
    onSuccess: () => { invalidateRules(); toast.success('Trading rule deleted.'); },
    onError: (error) => {
      if (error?.response?.data?.error?.code === 'RULE_HAS_CHECKS') {
        toast.error('This rule has historical checks. Deactivate it instead.');
      } else toast.error('Trading rule could not be deleted.');
    },
  });
  const createCheckMutation = useMutation({
    mutationFn: rulesApi.createCheck,
    onSuccess: () => { invalidateRules(); setCheckFormOpen(false); toast.success('Rule check recorded.'); },
    onError: () => toast.error('Rule check could not be recorded.'),
  });
  const updateCheckMutation = useMutation({
    mutationFn: ({ id, data }) => rulesApi.updateCheck(id, data),
    onSuccess: () => { invalidateRules(); setCheckFormOpen(false); setEditingCheck(null); toast.success('Rule check updated.'); },
    onError: () => toast.error('Rule check could not be updated.'),
  });
  const deleteCheckMutation = useMutation({
    mutationFn: rulesApi.removeCheck,
    onSuccess: () => { invalidateRules(); toast.success('Rule check deleted.'); },
    onError: () => toast.error('Rule check could not be deleted.'),
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
      toast.error('Rule details are unavailable. Retry the rules list before editing.');
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
    if (window.confirm(`Delete “${rule.name}”? Rules with historical checks cannot be deleted.`)) deleteRuleMutation.mutate(rule.id);
  }
  function removeCheck(check) {
    if (window.confirm(`Delete the ${outcomeMeta(check.outcome).label.toLowerCase()} check for “${check.rule.name}”?`)) deleteCheckMutation.mutate(check.id);
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
          <div role="group" aria-label="Rules period" className="flex min-h-11 flex-1 gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9 adaptive:flex-none">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => applyPeriod(item.id)} className={`min-w-12 flex-1 rounded-sm px-2 font-mono text-xs transition-colors adaptive:flex-none ${period === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}>
                {item.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex w-full gap-2 adaptive:w-auto" aria-label="Custom Rules dates">
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none"><span className="sr-only">Start date</span><input aria-label="Start date" type="date" dir="ltr" value={dateRange.from} onChange={(event) => updateCustomDate('from', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" /></label>
              <label className="min-w-0 flex-1 adaptive:w-36 adaptive:flex-none"><span className="sr-only">End date</span><input aria-label="End date" type="date" dir="ltr" value={dateRange.to} onChange={(event) => updateCustomDate('to', event.target.value)} className="input min-h-11 font-mono text-end adaptive:min-h-9" /></label>
            </div>
          )}
          <Button type="button" variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={openNewRule}>New Rule</Button>
          <Button type="button" size="mobile" className="adaptive:min-h-9" leadingIcon={<ListChecks size={16} aria-hidden="true" />} onClick={() => openNewCheck()}>Record Check</Button>
        </div>
      </RouteHeaderControls>

      <div role="tablist" aria-label="Rules view" className="flex min-h-11 overflow-x-auto rounded-md border border-default bg-surface-sunken p-0.5 adaptive:min-h-9">
        {VIEWS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-w-28 flex-1 whitespace-nowrap rounded-sm px-3 text-sm transition-colors ${view === item.id ? 'bg-surface font-semibold text-primary shadow-flat' : 'text-muted hover:text-primary'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {rangeError && <ErrorState title="Date range is invalid" detail="Choose an end date on or after the start date." available="Rules management and forms" />}
      {fullFailure ? (
        <ErrorState title="Rules & Adherence could not be loaded" detail="Rules, adherence, and check history requests failed." available="Period controls and forms" onRetry={() => Promise.all([rulesQuery.refetch(), adherenceQuery.refetch(), historyQuery.refetch()])} />
      ) : view === 'overview' ? (
        <div className="space-y-4 adaptive:space-y-5">
          {adherenceQuery.isLoading ? <SummarySkeleton /> : adherenceQuery.isError && !adherenceQuery.data ? (
            <ErrorState title="Adherence summary could not be loaded" detail="Rules and check history remain available." available="Rules management and history" onRetry={adherenceQuery.refetch} />
          ) : <SummaryMetrics summary={adherenceQuery.data.summary} />}
          {adherenceQuery.isError && adherenceQuery.data && <ErrorState title="Adherence could not be refreshed" detail="The last available results remain visible." available="Rules and history" onRetry={adherenceQuery.refetch} />}
          <section aria-labelledby="per-rule-heading">
            <div className="mb-2 flex items-center justify-between gap-3"><h2 id="per-rule-heading" className="text-sm font-semibold text-primary">Per-rule adherence</h2>{adherenceQuery.isFetching && !adherenceQuery.isLoading && <span className="text-xs text-muted">Refreshing…</span>}</div>
            {adherenceQuery.isLoading ? <Skeleton className="h-40 w-full" label="Loading per-rule adherence" /> : adherenceQuery.data && <AdherenceRows rules={adherenceRows} onEdit={openEditRule} onRecord={openNewCheck} />}
          </section>
          <section aria-labelledby="recent-checks-heading">
            <h2 id="recent-checks-heading" className="mb-2 text-sm font-semibold text-primary">Recent checks</h2>
            {historyQuery.isError && !historyQuery.data ? <ErrorState title="Recent checks could not be loaded" detail="Adherence and rules remain available." available="Adherence and rule management" onRetry={historyQuery.refetch} />
              : historyQuery.isLoading ? <Skeleton className="h-32 w-full" label="Loading recent checks" />
                : checks.length ? <CheckList checks={checks.slice(0, 5)} compact onEdit={openEditCheck} onDelete={removeCheck} deletingId={deleteCheckMutation.isPending ? deleteCheckMutation.variables : null} />
                  : <EmptyState title={noRulesAtAll ? 'No trading rules yet' : 'No rule checks in this period'} detail={noRulesAtAll ? 'Create your first rule to begin tracking process consistency.' : 'Record what happened to begin measuring adherence.'} />}
          </section>
        </div>
      ) : view === 'rules' ? (
        <section aria-labelledby="rules-management-heading" className="space-y-3">
          <h2 id="rules-management-heading" className="sr-only">Rules management</h2>
          <Card density="compact">
            <div className="flex flex-wrap gap-2">
              <label className="min-w-52 flex-[2_1_18rem]"><span className="sr-only">Search rules</span><input type="search" value={ruleFilters.search} onChange={(event) => setRuleFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search rules" className="input min-h-11 adaptive:min-h-9" /></label>
              <label className="min-w-36 flex-1"><span className="sr-only">Rule status</span><select aria-label="Rule status" value={ruleFilters.status} onChange={(event) => setRuleFilters((current) => ({ ...current, status: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              <label className="min-w-36 flex-1"><span className="sr-only">Rule scope</span><select aria-label="Rule scope" value={ruleFilters.scope} onChange={(event) => setRuleFilters((current) => ({ ...current, scope: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="">All scopes</option>{RULE_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
              {hasRuleFilters && ruleRows.length > 0 && <Button size="mobile" className="adaptive:min-h-9" onClick={clearRuleFilters}>Clear filters</Button>}
            </div>
          </Card>
          {rulesQuery.isError && rulesQuery.data && <ErrorState title="Rules could not be refreshed" detail="The last available rules remain visible." available="Editing and check recording" onRetry={rulesQuery.refetch} />}
          {rulesQuery.isLoading ? <Skeleton className="h-48 w-full" label="Loading rules" /> : rulesQuery.isError && !rulesQuery.data ? <ErrorState title="Rules could not be loaded" detail="The rules request failed." available="Adherence and check history" onRetry={rulesQuery.refetch} /> : ruleRows.length === 0 ? (
            <EmptyState filtered={hasRuleFilters} onClear={clearRuleFilters} title={hasRuleFilters ? 'No rules match the current filters' : 'No trading rules yet'} detail={hasRuleFilters ? 'Clear the current filters to return to all rules.' : 'Create your first rule to begin tracking process consistency.'} />
          ) : (
            <div className="space-y-2">
              {ruleRows.map((rule) => (
                <Card key={rule.id} density="compact" className="grid gap-3 adaptive:grid-cols-[minmax(14rem,1fr)_auto] adaptive:items-center">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-primary">{rule.name}</h3><Badge>{scopeLabel(rule.scope)}</Badge><Badge variant={rule.isActive ? 'positive' : 'neutral'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge></div>{rule.description && <p className="mt-1 text-sm text-secondary">{rule.description}</p>}<p className="mt-1 text-xs text-muted"><span dir="ltr">{rule.checkCount ?? 0}</span> historical checks</p></div>
                  <div className="flex flex-wrap gap-2 adaptive:justify-end"><Button size="sm" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => openEditRule(rule)}>Edit</Button><Button size="sm" leadingIcon={<Power size={14} aria-hidden="true" />} loading={updateRuleMutation.isPending && updateRuleMutation.variables?.id === rule.id} onClick={() => toggleRule(rule)}>{rule.isActive ? 'Deactivate' : 'Reactivate'}</Button><Button size="sm" variant="destructive" leadingIcon={<Trash size={14} aria-hidden="true" />} loading={deleteRuleMutation.isPending && deleteRuleMutation.variables === rule.id} onClick={() => removeRule(rule)}>Delete</Button></div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="check-history-heading" className="space-y-3">
          <h2 id="check-history-heading" className="sr-only">Check history</h2>
          <Card density="compact"><div className="flex flex-wrap gap-2"><label className="min-w-48 flex-1"><span className="sr-only">History rule</span><select aria-label="History rule" value={checkFilters.ruleId} onChange={(event) => setCheckFilters((current) => ({ ...current, ruleId: event.target.value, page: 1 }))} className="input min-h-11 adaptive:min-h-9"><option value="">All rules</option>{allRuleRows.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label><label className="min-w-48 flex-1"><span className="sr-only">History outcome</span><select aria-label="History outcome" value={checkFilters.outcome} onChange={(event) => setCheckFilters((current) => ({ ...current, outcome: event.target.value, page: 1 }))} className="input min-h-11 adaptive:min-h-9"><option value="">All outcomes</option>{RULE_OUTCOMES.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select></label>{hasCheckFilters && checks.length > 0 && <Button size="mobile" className="adaptive:min-h-9" onClick={clearCheckFilters}>Clear filters</Button>}</div></Card>
          {historyQuery.isError && historyQuery.data && <ErrorState title="Check history could not be refreshed" detail="The last available checks remain visible." available="Adherence and rules" onRetry={historyQuery.refetch} />}
          {historyQuery.isLoading ? <Skeleton className="h-48 w-full" label="Loading check history" /> : historyQuery.isError && !historyQuery.data ? <ErrorState title="Check history could not be loaded" detail="The history request failed. Adherence and rules remain available." available="Adherence and rules" onRetry={historyQuery.refetch} /> : checks.length === 0 ? <EmptyState filtered={hasCheckFilters} onClear={clearCheckFilters} title={hasCheckFilters ? 'No results match the current filters' : 'No rule checks in this period'} detail={hasCheckFilters ? 'Clear the current filters to return to all checks in this period.' : 'Record what happened to begin measuring adherence.'} /> : <CheckList checks={checks} pagination={pagination} onEdit={openEditCheck} onDelete={removeCheck} deletingId={deleteCheckMutation.isPending ? deleteCheckMutation.variables : null} onPageChange={(page) => setCheckFilters((current) => ({ ...current, page }))} />}
        </section>
      )}

      <Modal open={ruleFormOpen} onClose={() => { if (!createRuleMutation.isPending && !updateRuleMutation.isPending) { setRuleFormOpen(false); setEditingRule(null); } }} title={editingRule ? 'Edit trading rule' : 'New trading rule'} size="md">
        <RuleForm key={editingRule?.id ?? 'new'} rule={editingRule} onSubmit={submitRule} loading={createRuleMutation.isPending || updateRuleMutation.isPending} />
      </Modal>
      <Modal open={checkFormOpen} onClose={() => { if (!createCheckMutation.isPending && !updateCheckMutation.isPending) { setCheckFormOpen(false); setEditingCheck(null); setInitialRuleId(''); } }} title={editingCheck ? 'Edit rule check' : 'Record rule check'} size="lg">
        <RuleCheckForm key={editingCheck?.id ?? `new-${initialRuleId}`} check={editingCheck} rules={allRuleRows} initialRuleId={initialRuleId} timezone={timezone} onSubmit={submitCheck} loading={createCheckMutation.isPending || updateCheckMutation.isPending} />
      </Modal>
    </div>
  );
}
