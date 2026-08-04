import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ArrowCounterClockwise, CheckCircle, Clock, Pause, PencilSimple, Play, Plus, Target, Trash, WarningCircle,
} from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { goalsApi } from '../api/goals.js';
import { GoalForm } from '../components/goals/GoalForm.jsx';
import {
  formatGoalValue, GOAL_METRICS, GOAL_STATES, GOAL_STATUSES, metricMeta, UNAVAILABLE_REASONS,
} from '../components/goals/goalTypes.js';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatDateKey } from '../utils/dateOnly.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';

const DEFAULT_FILTERS = Object.freeze({ status: 'all', metric: '', search: '' });

function compactParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
}

function Summary({ summary }) {
  const metrics = [
    ['Active', summary.active],
    ['In progress', summary.inProgress],
    ['Upcoming', summary.upcoming],
    ['Achieved', summary.achieved],
    ['Missed', summary.missed],
    ['Paused', summary.paused],
  ];
  return (
    <section aria-labelledby="goals-summary-heading">
      <h2 id="goals-summary-heading" className="sr-only">Goals summary</h2>
      <dl className="grid grid-cols-2 gap-3 adaptive:grid-cols-3 wide:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Card as="div" density="compact" key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-2 whitespace-nowrap font-mono text-xl font-semibold text-primary" dir="ltr">{value}</dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}

function SummarySkeleton() {
  return <div className="grid grid-cols-2 gap-3 adaptive:grid-cols-3 wide:grid-cols-6" aria-label="Loading Goals summary">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20" label="Loading goal metric" />)}</div>;
}

function stateIcon(state) {
  if (state === 'achieved') return CheckCircle;
  if (state === 'missed') return WarningCircle;
  if (state === 'upcoming') return Clock;
  return Target;
}

function GoalCard({ goal, onEdit, onStatus, onDelete, updating, deleting }) {
  const metric = metricMeta(goal.metricKey);
  const state = GOAL_STATES[goal.derivedState] ?? GOAL_STATES.in_progress;
  const StateIcon = stateIcon(goal.derivedState);
  const visualProgress = goal.progressPercent == null ? null : Math.max(0, Math.min(100, goal.progressPercent));
  const unavailable = !goal.hasData ? (UNAVAILABLE_REASONS[goal.unavailableReason] ?? 'Current progress is unavailable.') : null;
  const current = formatGoalValue(goal.currentValue, goal.unit, { signed: goal.metricKey === 'net_pnl' });
  const target = formatGoalValue(goal.targetValue, goal.unit);
  const isAtMost = goal.comparison === 'at_most';
  const overLimit = isAtMost && goal.hasData && goal.differenceToTarget > 0;

  return (
    <Card as="article" className="flex min-w-0 flex-col gap-4" aria-labelledby={`goal-${goal.id}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-action-soft text-action"><StateIcon size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`goal-${goal.id}`} className="min-w-0 truncate text-sm font-semibold text-primary">{goal.name}</h3>
            <Badge variant={state.variant}><StateIcon size={13} aria-hidden="true" /> {state.label}</Badge>
            <Badge>{GOAL_STATUSES.find((item) => item.value === goal.status)?.label ?? goal.status}</Badge>
          </div>
          {goal.description && <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{goal.description}</p>}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>{metric.label}</span>
            <span className="whitespace-nowrap font-mono" dir="ltr">{formatDateKey(goal.startDate)} — {formatDateKey(goal.endDate)}</span>
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-md border border-default bg-surface-sunken p-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Current</dt>
          <dd className={`mt-1 whitespace-nowrap font-mono text-xl font-semibold ${goal.metricKey === 'net_pnl' && goal.hasData && goal.currentValue !== 0 ? (goal.currentValue > 0 ? 'text-positive' : 'text-negative') : goal.hasData ? 'text-primary' : 'text-muted'}`} dir="ltr">{current}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{isAtMost ? 'Maximum' : 'Target'}</dt>
          <dd className="mt-1 whitespace-nowrap font-mono text-xl font-semibold text-primary" dir="ltr">{target}</dd>
        </div>
      </dl>

      {unavailable ? (
        <p className="text-xs text-muted" role="status">{unavailable}</p>
      ) : isAtMost ? (
        <p className={`flex items-center gap-2 text-sm ${overLimit ? 'text-negative' : 'text-primary'}`}>
          {overLimit ? <WarningCircle size={16} aria-hidden="true" /> : <CheckCircle size={16} className="text-positive" aria-hidden="true" />}
          <span>{overLimit ? 'Over limit by' : 'Remaining allowance'} <strong className="whitespace-nowrap font-mono" dir="ltr">{formatGoalValue(Math.abs(goal.differenceToTarget), goal.unit)}</strong></span>
        </p>
      ) : goal.progressPercent != null ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-secondary">
            <span>{goal.targetSatisfied ? 'Target achieved' : 'Progress'}</span>
            <span className="whitespace-nowrap font-mono" dir="ltr">{Math.round(visualProgress * 10) / 10}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-sm bg-surface-sunken"
            role="progressbar"
            aria-label={`${goal.name}: current ${current}, target ${target}, ${Math.round(visualProgress * 10) / 10}% displayed, ${state.label}`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={visualProgress}
          >
            <span className="block h-full rounded-sm bg-action" style={{ inlineSize: `${visualProgress}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Progress percentage is not meaningful for this target value.</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-default pt-3">
        <Button size="mobile" className="adaptive:min-h-8" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => onEdit(goal)}>Edit</Button>
        {goal.status === 'active' && <Button size="mobile" className="adaptive:min-h-8" leadingIcon={<Pause size={14} aria-hidden="true" />} loading={updating} onClick={() => onStatus(goal, 'paused')}>Pause</Button>}
        {goal.status === 'paused' && <Button size="mobile" className="adaptive:min-h-8" leadingIcon={<Play size={14} aria-hidden="true" />} loading={updating} onClick={() => onStatus(goal, 'active')}>Resume</Button>}
        {goal.status === 'archived' ? (
          <Button size="mobile" className="adaptive:min-h-8" leadingIcon={<ArrowCounterClockwise size={14} aria-hidden="true" />} loading={updating} onClick={() => onStatus(goal, 'active')}>Restore</Button>
        ) : (
          <Button size="mobile" className="adaptive:min-h-8" leadingIcon={<Archive size={14} aria-hidden="true" />} loading={updating} onClick={() => onStatus(goal, 'archived')}>Archive</Button>
        )}
        <Button size="mobile" className="adaptive:min-h-8" variant="destructive" leadingIcon={<Trash size={14} aria-hidden="true" />} loading={deleting} onClick={() => onDelete(goal)}>Delete</Button>
      </div>
    </Card>
  );
}

function GoalSection({ title, goals, ...actions }) {
  if (!goals.length) return null;
  return (
    <section aria-labelledby={`goals-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <h2 id={`goals-${title.toLowerCase().replaceAll(' ', '-')}`} className="mb-2 text-sm font-semibold text-primary">{title}</h2>
      <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">
        {goals.map((goal) => <GoalCard key={goal.id} goal={goal} {...actions} updating={actions.updatingId === goal.id} deleting={actions.deletingId === goal.id} />)}
      </div>
    </section>
  );
}

export default function Goals() {
  const timezone = useUserTimezone();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useMemo(() => compactParams(filters), [filters]);
  const hasFilters = Boolean(filters.status !== 'all' || filters.metric || filters.search);

  const goalsQuery = useQuery({
    queryKey: ['goals', 'list', params],
    queryFn: () => goalsApi.list(params),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (searchParams.get('action') !== 'new-goal') return;
    setEditingGoal(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  function invalidateGoals() {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
  }

  const createMutation = useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => { invalidateGoals(); setFormOpen(false); toast.success('Goal created.'); },
    onError: () => toast.error('Goal could not be created.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => goalsApi.update(id, data),
    onSuccess: () => { invalidateGoals(); setFormOpen(false); setEditingGoal(null); toast.success('Goal updated.'); },
    onError: () => toast.error('Goal could not be updated.'),
  });
  const deleteMutation = useMutation({
    mutationFn: goalsApi.remove,
    onSuccess: () => { invalidateGoals(); toast.success('Goal deleted.'); },
    onError: () => toast.error('Goal could not be deleted. It remains available.'),
  });

  function openNew() { setEditingGoal(null); setFormOpen(true); }
  function openEdit(goal) { setEditingGoal(goal); setFormOpen(true); }
  function closeForm() {
    if (createMutation.isPending || updateMutation.isPending) return;
    setFormOpen(false);
    setEditingGoal(null);
  }
  function submitGoal(data) {
    if (editingGoal) updateMutation.mutate({ id: editingGoal.id, data });
    else createMutation.mutate(data);
  }
  function changeStatus(goal, status) {
    updateMutation.mutate({ id: goal.id, data: { status } });
  }
  function removeGoal(goal) {
    if (window.confirm(`Delete “${goal.name}”? This removes only the goal definition.`)) deleteMutation.mutate(goal.id);
  }
  function clearFilters() { setFilters({ ...DEFAULT_FILTERS }); }

  const data = goalsQuery.data;
  const goals = data?.goals ?? [];
  const primary = goals.filter((goal) => ['upcoming', 'in_progress'].includes(goal.derivedState));
  const outcomes = goals.filter((goal) => ['achieved', 'missed'].includes(goal.derivedState));
  const managed = goals.filter((goal) => ['paused', 'archived'].includes(goal.derivedState));
  const updatingId = updateMutation.isPending ? updateMutation.variables?.id : null;
  const deletingId = deleteMutation.isPending ? deleteMutation.variables : null;
  const sectionActions = { onEdit: openEdit, onStatus: changeStatus, onDelete: removeGoal, updatingId, deletingId };

  return (
    <div className="space-y-4 adaptive:space-y-5">
      <RouteHeaderControls slot="goalsActions">
        <Button type="button" variant="primary" size="mobile" className="adaptive:min-h-9" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>New Goal</Button>
      </RouteHeaderControls>

      {goalsQuery.isLoading ? <SummarySkeleton /> : data && <Summary summary={data.summary} />}

      <Card density="compact" aria-label="Goal filters">
        <div className="flex flex-wrap gap-2">
          <label className="min-w-52 flex-[2_1_18rem]"><span className="sr-only">Search goals</span><input type="search" value={filters.search} maxLength={100} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search goals" className="input min-h-11 adaptive:min-h-9" /></label>
          <label className="min-w-40 flex-1"><span className="sr-only">Goal status</span><select aria-label="Goal status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="all">All statuses</option>{GOAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="min-w-44 flex-1"><span className="sr-only">Goal metric</span><select aria-label="Goal metric" value={filters.metric} onChange={(event) => setFilters((current) => ({ ...current, metric: event.target.value }))} className="input min-h-11 adaptive:min-h-9"><option value="">All metrics</option>{GOAL_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {hasFilters && goals.length > 0 && <Button size="mobile" className="adaptive:min-h-9" onClick={clearFilters}>Clear filters</Button>}
        </div>
      </Card>

      {goalsQuery.isFetching && !goalsQuery.isLoading && <p className="text-xs text-muted" role="status">Refreshing Goals…</p>}
      {goalsQuery.isError && data && <ErrorState title="Goals could not be refreshed" detail="The last available Goals remain visible." available="Filters and existing goal actions" onRetry={goalsQuery.refetch} />}

      {goalsQuery.isLoading ? (
        <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72" label="Loading goal" />)}</div>
      ) : goalsQuery.isError && !data ? (
        <ErrorState title="Goals could not be loaded" detail="Goal definitions and progress calculations are unavailable right now." available="The rest of TradingLog" onRetry={goalsQuery.refetch} />
      ) : goals.length === 0 ? (
        <EmptyState
          filtered={hasFilters}
          onClear={clearFilters}
          title={hasFilters ? 'No goals match the current filters' : 'No goals yet'}
          detail={hasFilters ? 'Clear the current filters to return to all goals.' : 'Create a measurable goal to begin tracking progress from your trading activity.'}
        />
      ) : (
        <div className="space-y-5">
          <GoalSection title="Active and upcoming" goals={primary} {...sectionActions} />
          <GoalSection title="Outcomes" goals={outcomes} {...sectionActions} />
          <GoalSection title="Paused and archived" goals={managed} {...sectionActions} />
        </div>
      )}

      <Modal open={formOpen} onClose={closeForm} title={editingGoal ? 'Edit goal' : 'New goal'} size="lg">
        <GoalForm key={editingGoal?.id ?? 'new'} goal={editingGoal} timezone={timezone} onSubmit={submitGoal} loading={createMutation.isPending || updateMutation.isPending} />
      </Modal>
    </div>
  );
}
