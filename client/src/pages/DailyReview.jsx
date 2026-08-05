import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { CaretLeft, CaretRight, CheckCircle, Plus } from '@phosphor-icons/react';
import { analyticsApi } from '../api/analytics.js';
import { accountsApi } from '../api/accounts.js';
import { dailyReviewApi } from '../api/dailyReview.js';
import { rulesApi } from '../api/rules.js';
import { tradesApi } from '../api/trades.js';
import { DailyReviewForm } from '../components/dailyReview/DailyReviewForm.jsx';
import { RouteHeaderControls } from '../components/layout/HeaderControls.jsx';
import { RuleCheckForm } from '../components/rules/RuleCheckForm.jsx';
import { outcomeMeta, scopeLabel } from '../components/rules/ruleTypes.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { ValueIndicator } from '../components/ui/ValueIndicator.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useDirection } from '../hooks/useDirection.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';
import { addDaysToDateKey, currentDateKey, formatDateKey, isValidDateKey } from '../utils/dateOnly.js';
import { formatCurrency, formatLtrText, pnlColor } from '../utils/formatters.js';

const queryKeys = {
  review: (date) => ['daily-review', date],
  summary: (date) => ['analytics', 'day-summary', date],
  trades: (date) => ['trades', 'daily-review', date],
  rules: ['rules', 'daily-review', 'active'],
  checks: (date) => ['rules', 'daily-review-checks', date],
  adherence: (date) => ['rules', 'daily-review-adherence', date],
};

function displayTime(value, timezone) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function Metric({ label, value, detail, financial = false }) {
  return (
    <Card as="div" density="compact">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 text-xl font-semibold text-primary" dir="ltr">
        {financial && value != null ? <ValueIndicator value={value}>{formatCurrency(value)}</ValueIndicator> : value ?? '—'}
      </div>
      {detail && <p className="mt-1 text-xs text-secondary">{detail}</p>}
    </Card>
  );
}

function SectionHeader({ id, title, detail, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id={id} className="text-base font-semibold text-primary">{title}</h2>{detail && <p className="mt-1 text-sm text-secondary">{detail}</p>}</div>
      {action}
    </div>
  );
}

function DayHeaderControls({ date, timezone }) {
  const navigate = useNavigate();
  const { isRtl } = useDirection();
  const today = currentDateKey(timezone);
  const PreviousIcon = isRtl ? CaretRight : CaretLeft;
  const NextIcon = isRtl ? CaretLeft : CaretRight;
  return (
    <RouteHeaderControls slot="dailyReviewDate">
      <div className="flex flex-wrap items-center gap-2" aria-label="Daily Review date navigation">
        <Button type="button" size="mobile" className="adaptive:min-h-9 adaptive:px-3" aria-label="Previous day" onClick={() => navigate(`/daily-review/${addDaysToDateKey(date, -1)}`)}><PreviousIcon size={17} aria-hidden="true" /></Button>
        <input type="date" dir="ltr" aria-label="Selected Daily Review date" value={date} onChange={(event) => { if (isValidDateKey(event.target.value)) navigate(`/daily-review/${event.target.value}`); }} className="input min-h-11 w-[9.5rem] adaptive:min-h-9" />
        <Button type="button" size="mobile" className="adaptive:min-h-9" disabled={date === today} onClick={() => navigate(`/daily-review/${today}`)}>Today</Button>
        <Button type="button" size="mobile" className="adaptive:min-h-9 adaptive:px-3" aria-label="Next day" onClick={() => navigate(`/daily-review/${addDaysToDateKey(date, 1)}`)}><NextIcon size={17} aria-hidden="true" /></Button>
      </div>
    </RouteHeaderControls>
  );
}

export function DailyReviewTodayRedirect() {
  const timezone = useUserTimezone();
  return <Navigate to={`/daily-review/${currentDateKey(timezone)}`} replace />;
}

export default function DailyReview() {
  const { date } = useParams();
  const timezone = useUserTimezone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [checkRuleId, setCheckRuleId] = useState(null);
  const validDate = isValidDateKey(date);
  const tradeParams = useMemo(() => ({ from: date, to: date, page: 1, limit: 100, sort: 'entry_datetime', order: 'asc' }), [date]);

  const reviewQuery = useQuery({ queryKey: queryKeys.review(date), queryFn: () => dailyReviewApi.get(date), enabled: validDate });
  const summaryQuery = useQuery({ queryKey: queryKeys.summary(date), queryFn: () => analyticsApi.daySummary(date), enabled: validDate });
  const tradesQuery = useQuery({ queryKey: queryKeys.trades(date), queryFn: () => tradesApi.list(tradeParams), enabled: validDate });
  const rulesQuery = useQuery({ queryKey: queryKeys.rules, queryFn: () => rulesApi.list({ status: 'active' }), enabled: validDate });
  const checksQuery = useQuery({ queryKey: queryKeys.checks(date), queryFn: () => rulesApi.listChecks({ from: date, to: date, page: 1, limit: 100 }), enabled: validDate });
  const adherenceQuery = useQuery({ queryKey: queryKeys.adherence(date), queryFn: () => rulesApi.adherence({ from: date, to: date }), enabled: validDate });
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list, enabled: validDate });

  const saveMutation = useMutation({
    mutationFn: (payload) => dailyReviewApi.save(date, payload),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.review(date), result);
      queryClient.invalidateQueries({ queryKey: queryKeys.review(date) });
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success(result.review.isComplete ? 'Daily Review saved and completed.' : 'Daily Review saved.');
    },
    onError: () => toast.error('Daily Review could not be saved. Your entered values remain available.'),
  });
  const checkMutation = useMutation({
    mutationFn: rulesApi.createCheck,
    onSuccess: () => {
      setCheckRuleId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.checks(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adherence(date) });
      toast.success('Rule check recorded.');
    },
    onError: () => toast.error('Rule check could not be recorded.'),
  });

  if (!validDate) {
    const today = currentDateKey(timezone);
    return <ErrorState title="Invalid Daily Review date" detail="The route must contain a real YYYY-MM-DD calendar date." available="Your other Daily Reviews and source records are unchanged." onRetry={() => navigate(`/daily-review/${today}`)} />;
  }

  const summary = summaryQuery.data;
  const trades = tradesQuery.data?.data ?? [];
  const accountsById = new Map((accountsQuery.data ?? []).map((account) => [account.id, account]));
  const rules = rulesQuery.data?.rules ?? [];
  const checks = checksQuery.data?.checks ?? [];
  const checksByRule = checks.reduce((map, check) => map.set(check.ruleId, [...(map.get(check.ruleId) ?? []), check]), new Map());
  const adherence = adherenceQuery.data?.summary?.adherenceRate;
  const dayLabel = formatDateKey(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <DayHeaderControls date={date} timezone={timezone} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
        <span dir="ltr">{dayLabel}</span>
        <span>Calendar timezone: <bdi dir="ltr" className="font-mono">{timezone}</bdi></span>
      </div>

      <section aria-labelledby="day-summary-heading">
        <SectionHeader id="day-summary-heading" title="Day summary" detail="Calculated from trades attributed by entry time for this local calendar date." />
        {summaryQuery.isLoading ? <div className="grid gap-3 grid-cols-2 wide:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" label="Loading day metric" />)}</div>
          : summaryQuery.isError ? <ErrorState title="Day metrics could not be loaded" detail="Trades, Rules, and review notes remain available." onRetry={summaryQuery.refetch} />
            : <div className="grid grid-cols-2 gap-3 wide:grid-cols-4">
              <Metric label="Net PnL" value={summary?.pnlNet} financial />
              <Metric label="Closed trades" value={summary?.closedTrades} detail={summary ? `${summary.winners} winners · ${summary.losers} losers · ${summary.breakeven} breakeven` : null} />
              <Metric label="Win rate" value={summary?.winRate == null ? null : `${summary.winRate.toFixed(1)}%`} />
              <Metric label="Rule adherence" value={adherence == null ? null : `${adherence.toFixed(1)}%`} detail={adherenceQuery.isError ? 'Rule adherence could not be loaded' : 'Not applicable checks excluded'} />
              <Metric label="Open trades" value={summary?.openTrades} />
              <Metric label="Fees" value={summary?.totalFees} financial />
              <Metric label="Best trade" value={summary?.bestTrade ? <Link className={`font-mono hover:underline ${pnlColor(summary.bestTrade.pnlNet)}`} to={`/trades/${summary.bestTrade.id}`}>{formatLtrText(summary.bestTrade.symbol)} {formatCurrency(summary.bestTrade.pnlNet)}</Link> : null} />
              <Metric label="Worst trade" value={summary?.worstTrade ? <Link className={`font-mono hover:underline ${pnlColor(summary.worstTrade.pnlNet)}`} to={`/trades/${summary.worstTrade.id}`}>{formatLtrText(summary.worstTrade.symbol)} {formatCurrency(summary.worstTrade.pnlNet)}</Link> : null} />
            </div>}
      </section>

      <section aria-labelledby="trades-heading">
        <SectionHeader id="trades-heading" title="Trades taken" detail={tradesQuery.data?.pagination ? (tradesQuery.data.pagination.total > trades.length ? `Showing ${trades.length} of ${tradesQuery.data.pagination.total} trades attributed to this date` : `${tradesQuery.data.pagination.total} trades attributed to this date`) : undefined} />
        {tradesQuery.isLoading ? <Skeleton className="h-44" label="Loading trades" />
          : tradesQuery.isError ? <ErrorState title="Trades could not be loaded" detail="You can still record Rules and save the review." onRetry={tradesQuery.refetch} />
            : trades.length === 0 ? <EmptyState title="No trades on this date" detail="A Daily Review can still capture preparation, process, and the next-session plan." />
              : <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">{trades.map((trade) => {
                const account = accountsById.get(trade.accountId);
                const accountName = account?.accountName || account?.company || '—';
                return <Link key={trade.id} to={`/trades/${trade.id}`} className="block min-h-11 rounded-lg border border-default bg-surface p-4 transition-colors hover:border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
                  <div className="flex items-center justify-between gap-2"><span className="font-mono font-semibold text-primary" dir="ltr">{trade.symbol}</span><Badge variant={trade.direction === 'long' ? 'long' : 'short'}>{trade.direction}</Badge></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-secondary"><span>Entry <bdi dir="ltr">{displayTime(trade.entryDatetime, timezone)}</bdi></span><span>Exit <bdi dir="ltr">{displayTime(trade.exitDatetime, timezone)}</bdi></span><span className="capitalize">{trade.status}</span><span className="truncate">{accountName}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted">{[trade.strategy, trade.setup].filter(Boolean).join(' · ') || 'No strategy context'}</span>{trade.status === 'closed' ? <ValueIndicator value={trade.pnlNet}>{formatCurrency(trade.pnlNet)}</ValueIndicator> : <span className="text-xs text-muted">Realized PnL —</span>}</div>
                </Link>;
              })}</div>}
      </section>

      <section aria-labelledby="rules-heading">
        <SectionHeader id="rules-heading" title="Rules and checks" detail="All checks remain in Rules & Adherence; multiple checks per rule and date are preserved." />
        {rulesQuery.isLoading || checksQuery.isLoading ? <Skeleton className="h-44" label="Loading Rules" />
          : rulesQuery.isError || checksQuery.isError ? <ErrorState title="Rules could not be loaded" detail="Trades and your Daily Review remain available." onRetry={() => { rulesQuery.refetch(); checksQuery.refetch(); }} />
            : rules.length === 0 ? <EmptyState title="No active Rules" detail="Create Rules in Rules & Adherence before recording dated checks." />
              : <div className="grid gap-3 adaptive:grid-cols-2">{rules.map((rule) => {
                const ruleChecks = checksByRule.get(rule.id) ?? [];
                const latest = ruleChecks[0];
                return <Card key={rule.id} density="compact"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-primary">{rule.name}</h3><p className="mt-1 text-xs text-muted">{scopeLabel(rule.scope)}</p></div><Button type="button" size="mobile" className="adaptive:min-h-9" onClick={() => setCheckRuleId(rule.id)} leadingIcon={<Plus size={15} aria-hidden="true" />}>Record Check</Button></div>
                  {latest ? <div className="mt-3 space-y-2"><div className="flex items-center gap-2"><Badge variant={latest.outcome === 'broken' ? 'negative' : latest.outcome === 'followed' ? 'positive' : 'neutral'}>{outcomeMeta(latest.outcome).label}</Badge>{ruleChecks.length > 1 && <span className="text-xs text-muted">Latest of {ruleChecks.length} checks</span>}</div>{ruleChecks.length > 1 && <ul className="space-y-1 border-s border-default ps-3 text-xs text-secondary">{ruleChecks.map((check) => <li key={check.id}>{outcomeMeta(check.outcome).label}{check.notes ? ` — ${check.notes}` : ''}</li>)}</ul>}</div>
                    : <p className="mt-3 text-sm text-muted">No check recorded for this date.</p>}
                </Card>;
              })}</div>}
      </section>

      <section aria-labelledby="review-heading">
        <Card as="div" density="spacious">
          <SectionHeader id="review-heading" title="Session review" detail={reviewQuery.data?.review ? `${reviewQuery.data.review.isComplete ? 'Complete' : 'Draft'} Journal entry` : 'No review saved yet. Saving creates one canonical Daily Review Journal entry.'} action={reviewQuery.data?.review?.isComplete ? <Badge variant="positive"><CheckCircle size={14} aria-hidden="true" />Complete</Badge> : <Badge variant="warning">Draft</Badge>} />
          {reviewQuery.isLoading ? <Skeleton className="h-80" label="Loading Daily Review" />
            : reviewQuery.isError ? <ErrorState title="Daily Review could not be loaded" detail="Day metrics, trades, and Rules remain available. Retry before editing to avoid overwriting unknown content." onRetry={reviewQuery.refetch} />
              : <DailyReviewForm review={reviewQuery.data?.review ?? null} date={date} onSubmit={saveMutation.mutate} saving={saveMutation.isPending} />}
        </Card>
      </section>

      <Modal open={Boolean(checkRuleId)} onClose={() => setCheckRuleId(null)} title="Record Rule Check" size="lg">
        <RuleCheckForm rules={rules} initialRuleId={checkRuleId} initialDate={date} timezone={timezone} onSubmit={checkMutation.mutate} loading={checkMutation.isPending} />
      </Modal>
    </div>
  );
}
