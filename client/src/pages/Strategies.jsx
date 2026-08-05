import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowCounterClockwise, PencilSimple, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { strategiesApi } from '../api/strategies.js';
import { StrategyForm } from '../components/strategies/StrategyForm.jsx';
import { SetupForm } from '../components/strategies/SetupForm.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatNumber, formatPct, formatR, formatSignedCurrency } from '../utils/formatters.js';

function Metric({ label, value, format = formatNumber, direction = 'ltr' }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap font-mono text-sm font-semibold text-primary" dir={direction}>{value == null ? '—' : format(value)}</dd></div>;
}

function Performance({ item }) {
  const { t } = useTranslation();
  return (
    <dl className="grid grid-cols-2 gap-3 adaptive:grid-cols-4 wide:grid-cols-7">
      <Metric label={t('strategies.closedTrades')} value={item.closedTrades} />
      <Metric label={t('strategies.openTrades')} value={item.openTrades} />
      <Metric label={t('strategies.outcomes')} value={t('strategies.outcomeRecord', { winners: item.winners, losers: item.losers, breakeven: item.breakeven })} format={(value) => value} direction="auto" />
      <Metric label={t('common.netPnl')} value={item.pnlNet} format={formatSignedCurrency} />
      <Metric label={t('common.winRate')} value={item.winRate} format={formatPct} />
      <Metric label={t('common.averageR')} value={item.averageR} format={formatR} />
      <Metric label={t('common.profitFactor')} value={item.profitFactor} format={(value) => formatNumber(value, { maximumFractionDigits: 2 })} />
    </dl>
  );
}

function Summary({ summary }) {
  const { t } = useTranslation();
  const rows = [
    ['activeStrategies', t('strategies.activeStrategies')], ['activeSetups', t('strategies.activeSetups')],
    ['managedClosedTrades', t('strategies.managedClosedTrades')], ['unlinkedClosedTrades', t('strategies.unlinkedClosedTrades')],
  ];
  return <section aria-labelledby="strategy-summary-heading"><h2 id="strategy-summary-heading" className="sr-only">{t('strategies.summary')}</h2><dl className="grid grid-cols-2 gap-3 wide:grid-cols-4">{rows.map(([key, label]) => <Card as="div" density="compact" key={key}><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 font-mono text-2xl font-semibold text-primary" dir="ltr">{summary?.[key] ?? 0}</dd></Card>)}</dl></section>;
}

function LegacyRows({ title, rows }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-primary">{title}</h3>
      {rows.length ? <div className="grid gap-2 adaptive:grid-cols-2">{rows.map((row, index) => (
        <div key={`${row.value ?? 'unclassified'}-${index}`} className="rounded-md border border-default bg-surface-raised p-3">
          <div className="flex items-start justify-between gap-3"><span className="font-medium text-primary" dir="auto">{row.value || t('strategies.unclassified')}</span><span className="whitespace-nowrap font-mono text-xs text-muted" dir="ltr">{t('strategies.tradeCount', { count: row.tradeCount })}</span></div>
          <dl className="mt-3 grid grid-cols-3 gap-2"><Metric label={t('strategies.closedTrades')} value={row.closedTrades} /><Metric label={t('common.netPnl')} value={row.pnlNet} format={formatSignedCurrency} /><Metric label={t('common.winRate')} value={row.winRate} format={formatPct} /></dl>
        </div>
      ))}</div> : <p className="text-sm text-muted">{t('strategies.noLegacyValues')}</p>}
    </div>
  );
}

export default function Strategies() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [strategyForm, setStrategyForm] = useState(null);
  const [setupForm, setSetupForm] = useState(null);
  const strategiesQuery = useQuery({ queryKey: ['strategies', { includeArchived: true }], queryFn: () => strategiesApi.list({ includeArchived: 'true' }) });
  const setupsQuery = useQuery({ queryKey: ['setups', { includeArchived: true }], queryFn: () => strategiesApi.listSetups({ includeArchived: 'true' }) });
  const legacyQuery = useQuery({ queryKey: ['strategies', 'legacy'], queryFn: strategiesApi.legacy });
  const strategies = strategiesQuery.data?.strategies || [];
  const setups = setupsQuery.data?.setups || [];
  const selected = strategies.find((item) => item.id === selectedId) || strategies[0] || null;

  useEffect(() => { if (!selectedId && strategies[0]) setSelectedId(strategies[0].id); }, [selectedId, strategies]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['strategies'] });
    queryClient.invalidateQueries({ queryKey: ['setups'] });
  }
  const strategyMutation = useMutation({
    mutationFn: ({ id, data }) => id ? strategiesApi.update(id, data) : strategiesApi.create(data),
    onSuccess: (result) => { invalidate(); setStrategyForm(null); setSelectedId(result.strategy.id); toast.success(t('strategies.strategySaved')); },
    onError: (error) => toast.error(error?.response?.data?.error?.code === 'STRATEGY_NAME_EXISTS' ? t('strategies.duplicateStrategy') : t('strategies.saveFailed')),
  });
  const setupMutation = useMutation({
    mutationFn: ({ id, data }) => id ? strategiesApi.updateSetup(id, data) : strategiesApi.createSetup(data),
    onSuccess: () => { invalidate(); setSetupForm(null); toast.success(t('strategies.setupSaved')); },
    onError: (error) => toast.error(error?.response?.data?.error?.code === 'SETUP_NAME_EXISTS' ? t('strategies.duplicateSetup') : t('strategies.saveFailed')),
  });

  const fullFailure = strategiesQuery.isError && setupsQuery.isError && legacyQuery.isError;
  if (strategiesQuery.isLoading) return <div className="space-y-4"><Skeleton className="h-24" label={t('strategies.loading')} /><Skeleton className="h-64" label={t('strategies.loading')} /></div>;
  if (fullFailure) return <ErrorState title={t('strategies.loadFailed')} detail={t('strategies.loadFailedDetail')} onRetry={() => Promise.all([strategiesQuery.refetch(), setupsQuery.refetch(), legacyQuery.refetch()])} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2"><Button variant="primary" size="mobile" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setStrategyForm({})}>{t('strategies.createStrategy')}</Button></div>
      <Summary summary={strategiesQuery.data?.summary} />
      {strategiesQuery.isError && <ErrorState title={t('strategies.refreshFailed')} detail={t('strategies.staleVisible')} onRetry={strategiesQuery.refetch} />}
      {!strategies.length ? <EmptyState title={t('strategies.noStrategies')} detail={t('strategies.noStrategiesDetail')} action={<Button variant="primary" onClick={() => setStrategyForm({})}>{t('strategies.createStrategy')}</Button>} /> : (
        <div className="grid gap-4 wide:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.5fr)]">
          <section aria-labelledby="strategy-list-heading"><h2 id="strategy-list-heading" className="mb-2 text-sm font-semibold text-primary">{t('strategies.strategyList')}</h2><div className="space-y-2">{strategies.map((strategy) => (
            <button key={strategy.id} type="button" aria-pressed={selected?.id === strategy.id} onClick={() => setSelectedId(strategy.id)} className={`min-h-11 w-full rounded-lg border p-3 text-start transition-colors ${selected?.id === strategy.id ? 'border-action bg-action-soft' : 'border-default bg-surface hover:border-strong'}`}>
              <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-primary" dir="auto">{strategy.name}</strong><Badge variant={strategy.isActive ? 'positive' : 'neutral'}>{t(`status.${strategy.isActive ? 'active' : 'archived'}`)}</Badge></span>
              <span className="mt-1 block text-xs text-muted">{t('strategies.setupCount', { count: strategy.setupCount })} · {t('strategies.closedCount', { count: strategy.closedTrades })}</span>
            </button>
          ))}</div></section>
          {selected && <section aria-labelledby="selected-strategy-heading" className="space-y-4"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 id="selected-strategy-heading" className="text-lg font-semibold text-primary" dir="auto">{selected.name}</h2>{selected.description && <p className="mt-1 text-sm text-secondary" dir="auto">{selected.description}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="tertiary" leadingIcon={<PencilSimple size={14} aria-hidden="true" />} onClick={() => setStrategyForm(selected)}>{t('common.edit')}</Button><Button size="sm" leadingIcon={selected.isActive ? <Archive size={14} aria-hidden="true" /> : <ArrowCounterClockwise size={14} aria-hidden="true" />} loading={strategyMutation.isPending && strategyMutation.variables?.id === selected.id} onClick={() => strategyMutation.mutate({ id: selected.id, data: { isActive: !selected.isActive } })}>{t(selected.isActive ? 'strategies.archive' : 'strategies.restore')}</Button></div></div><div className="mt-4"><Performance item={selected} /></div></Card>
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-primary">{t('strategies.setups')}</h2><Button size="sm" leadingIcon={<Plus size={14} aria-hidden="true" />} disabled={!selected.isActive} onClick={() => setSetupForm({ strategyId: selected.id })}>{t('strategies.createSetup')}</Button></div>
            {setupsQuery.isError ? <ErrorState title={t('strategies.setupsLoadFailed')} onRetry={setupsQuery.refetch} /> : (setups.filter((setup) => setup.strategyId === selected.id).length ? <div className="space-y-2">{setups.filter((setup) => setup.strategyId === selected.id).map((setup) => <Card key={setup.id} density="compact"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-primary" dir="auto">{setup.name}</h3><Badge variant={setup.isActive ? 'positive' : 'neutral'}>{t(`status.${setup.isActive ? 'active' : 'archived'}`)}</Badge></div>{setup.description && <p className="mt-1 text-sm text-secondary" dir="auto">{setup.description}</p>}</div><div className="flex gap-2"><Button size="sm" variant="tertiary" onClick={() => setSetupForm(setup)}>{t('common.edit')}</Button><Button size="sm" loading={setupMutation.isPending && setupMutation.variables?.id === setup.id} onClick={() => setupMutation.mutate({ id: setup.id, data: { isActive: !setup.isActive } })}>{t(setup.isActive ? 'strategies.archive' : 'strategies.restore')}</Button></div></div><div className="mt-3"><Performance item={setup} /></div></Card>)}</div> : <EmptyState title={t('strategies.noSetups')} detail={t('strategies.noSetupsDetail')} />)}
          </section>}
        </div>
      )}
      <Card aria-labelledby="legacy-heading"><h2 id="legacy-heading" className="text-base font-semibold text-primary">{t('strategies.legacyValues')}</h2><p className="mt-1 text-sm text-secondary">{t('strategies.legacyDetail')}</p>{legacyQuery.isError ? <div className="mt-4"><ErrorState title={t('strategies.legacyLoadFailed')} onRetry={legacyQuery.refetch} /></div> : <div className="mt-4 grid gap-5 wide:grid-cols-2"><LegacyRows title={t('strategies.legacyStrategies')} rows={legacyQuery.data?.strategies || []} /><LegacyRows title={t('strategies.legacySetups')} rows={legacyQuery.data?.setups || []} /></div>}</Card>

      <Modal open={strategyForm !== null} onClose={() => !strategyMutation.isPending && setStrategyForm(null)} title={strategyForm?.id ? t('strategies.editStrategy') : t('strategies.createStrategy')}>
        <StrategyForm key={strategyForm?.id || 'new'} strategy={strategyForm?.id ? strategyForm : null} loading={strategyMutation.isPending} onSubmit={(data) => strategyMutation.mutate({ id: strategyForm?.id, data })} />
      </Modal>
      <Modal open={setupForm !== null} onClose={() => !setupMutation.isPending && setSetupForm(null)} title={setupForm?.id ? t('strategies.editSetup') : t('strategies.createSetup')}>
        <SetupForm key={setupForm?.id || `new-${setupForm?.strategyId || selected?.id}`} setup={setupForm?.id ? setupForm : null} strategies={strategies} selectedStrategyId={setupForm?.strategyId || selected?.id} loading={setupMutation.isPending} onSubmit={(data) => setupMutation.mutate({ id: setupForm?.id, data })} />
      </Modal>
    </div>
  );
}
