import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { accountsApi } from '../../api/accounts.js';
import { journalApi } from '../../api/journal.js';
import { tradesApi } from '../../api/trades.js';
import { DEFAULT_TIMEZONE, formatDateKey, localTodayKey, normalizeDateKey } from '../../utils/dateOnly.js';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';
import { RULE_OUTCOMES, scopeLabel } from './ruleTypes.js';

function mergeSelected(items, selected) {
  if (!selected || items.some((item) => item.id === selected.id)) return items;
  return [selected, ...items];
}

function accountLabel(account) {
  if (!account) return null;
  return account.accountName || `${account.company} — ${account.accountNumber}`;
}

export function RuleCheckForm({ check, rules, initialRuleId, initialDate, timezone = DEFAULT_TIMEZONE, onSubmit, loading = false }) {
  const [tradeSearch, setTradeSearch] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const [tradeId, setTradeId] = useState(check?.trade?.id ?? '');
  const [journalEntryId, setJournalEntryId] = useState(check?.journalEntry?.id ?? '');
  const isEdit = Boolean(check);
  const ruleOptions = useMemo(() => {
    const active = rules.filter((rule) => rule.isActive);
    if (check?.rule && !active.some((rule) => rule.id === check.rule.id)) return [check.rule, ...active];
    return active;
  }, [check, rules]);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      ruleId: check?.ruleId ?? initialRuleId ?? '',
      checkDate: check?.checkDate ?? initialDate ?? localTodayKey(new Date(), timezone),
      outcome: check?.outcome ?? '',
      notes: check?.notes ?? '',
    },
  });
  const selectedRule = ruleOptions.find((rule) => rule.id === watch('ruleId'));

  const tradeParams = useMemo(() => ({
    page: 1,
    limit: 20,
    sort: 'entry_datetime',
    order: 'desc',
    ...(tradeSearch.trim() ? { symbol: tradeSearch.trim() } : {}),
  }), [tradeSearch]);
  const journalParams = useMemo(() => ({
    page: 1,
    limit: 20,
    status: 'all',
    ...(journalSearch.trim() ? { search: journalSearch.trim() } : {}),
  }), [journalSearch]);
  const tradesQuery = useQuery({
    queryKey: ['trades', 'rule-check-picker', tradeParams],
    queryFn: () => tradesApi.list(tradeParams),
    placeholderData: (previous) => previous,
  });
  const journalQuery = useQuery({
    queryKey: ['journal', 'rule-check-picker', journalParams],
    queryFn: () => journalApi.list(journalParams),
    placeholderData: (previous) => previous,
  });
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const accountsById = new Map((accountsQuery.data ?? []).map((account) => [account.id, account]));
  const trades = mergeSelected(tradesQuery.data?.data ?? [], check?.trade);
  const entries = mergeSelected(journalQuery.data?.entries ?? [], check?.journalEntry);

  function submit(values) {
    onSubmit({
      ruleId: values.ruleId,
      checkDate: values.checkDate,
      outcome: values.outcome,
      notes: values.notes.trim() || null,
      tradeId: tradeId || null,
      journalEntryId: journalEntryId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label="Rule" required error={errors.ruleId?.message}>
          {(fieldProps) => (
            <Select data-autofocus {...fieldProps} {...register('ruleId', { required: 'Choose a rule.' })}>
              <option value="">Choose a rule</option>
              {ruleOptions.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}{rule.isActive === false ? ' (inactive)' : ''}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Check date" required error={errors.checkDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" {...fieldProps} {...register('checkDate', { required: 'Choose a check date.' })} />}
        </Field>
      </div>

      {selectedRule && (
        <p className="rounded-md border border-information bg-information-soft px-3 py-2 text-xs text-secondary">
          {selectedRule.scope === 'trade' && 'Trade rules commonly link to a trade.'}
          {selectedRule.scope === 'daily' && 'Daily rules commonly link to a daily review.'}
          {selectedRule.scope === 'general' && 'General rules may be recorded without a link.'}
          {' '}Scope: {scopeLabel(selectedRule.scope)}.
        </p>
      )}

      <fieldset>
        <legend className="label">Outcome <span className="text-negative" aria-hidden="true">*</span></legend>
        <div className="grid gap-2 adaptive:grid-cols-3">
          {RULE_OUTCOMES.map((outcome) => (
            <label key={outcome.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-default bg-surface-raised px-3 text-sm text-secondary has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:checked]:font-semibold has-[:checked]:text-primary">
              <input type="radio" value={outcome.value} className="h-4 w-4 accent-action" {...register('outcome', { required: 'Choose an outcome.' })} />
              <span>{outcome.label}</span>
            </label>
          ))}
        </div>
        {errors.outcome && <p className="mt-1 text-xs text-negative">{errors.outcome.message}</p>}
      </fieldset>

      <Field label="Notes" helpText="Optional context about what happened." error={errors.notes?.message}>
        {(fieldProps) => (
          <textarea rows={3} maxLength={5000} className="input min-h-20 resize-y" {...fieldProps} {...register('notes', { maxLength: { value: 5000, message: 'Use 5,000 characters or fewer.' } })} />
        )}
      </Field>

      <fieldset className="rounded-lg border border-default bg-surface-raised p-3">
        <legend className="px-1 text-xs font-semibold text-secondary">Linked trade (optional)</legend>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface px-3">
          <MagnifyingGlass size={16} className="text-muted" aria-hidden="true" />
          <span className="sr-only">Search trades by symbol</span>
          <input type="search" value={tradeSearch} onChange={(event) => setTradeSearch(event.target.value)} placeholder="Search by symbol" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-primary outline-none placeholder:text-muted" />
        </label>
        <div className="mt-3 max-h-44 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Available trades">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-secondary hover:bg-surface-sunken">
            <input type="radio" name="linked-trade" checked={!tradeId} onChange={() => setTradeId('')} className="h-4 w-4 accent-action" /> No linked trade
          </label>
          {tradesQuery.isError && <p className="px-2 py-2 text-sm text-negative" role="alert">Trades could not be loaded. The current selection is preserved.</p>}
          {trades.map((trade) => {
            const account = trade.accountLabel || accountLabel(accountsById.get(trade.accountId));
            return (
              <label key={trade.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm text-secondary hover:bg-surface-sunken">
                <input type="radio" name="linked-trade" checked={tradeId === trade.id} onChange={() => setTradeId(trade.id)} className="mt-0.5 h-4 w-4 accent-action" />
                <span className="min-w-0 flex-1">
                  <span className="font-mono font-semibold text-primary" dir="ltr">{trade.symbol}</span>
                  <span className="ms-2 capitalize">{trade.status}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted"><span dir="ltr">{formatDateKey(normalizeDateKey(trade.entryDatetime))}</span>{account ? ` · ${account}` : ''}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-default bg-surface-raised p-3">
        <legend className="px-1 text-xs font-semibold text-secondary">Linked Journal entry (optional)</legend>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface px-3">
          <MagnifyingGlass size={16} className="text-muted" aria-hidden="true" />
          <span className="sr-only">Search Journal entries</span>
          <input type="search" value={journalSearch} onChange={(event) => setJournalSearch(event.target.value)} placeholder="Search title or content" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-primary outline-none placeholder:text-muted" />
        </label>
        <div className="mt-3 max-h-44 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Available Journal entries">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-secondary hover:bg-surface-sunken">
            <input type="radio" name="linked-journal" checked={!journalEntryId} onChange={() => setJournalEntryId('')} className="h-4 w-4 accent-action" /> No linked Journal entry
          </label>
          {journalQuery.isError && <p className="px-2 py-2 text-sm text-negative" role="alert">Journal entries could not be loaded. The current selection is preserved.</p>}
          {entries.map((entry) => (
            <label key={entry.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm text-secondary hover:bg-surface-sunken">
              <input type="radio" name="linked-journal" checked={journalEntryId === entry.id} onChange={() => setJournalEntryId(entry.id)} className="mt-0.5 h-4 w-4 accent-action" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-primary">{entry.title}</span>
                <span className="mt-0.5 block text-xs text-muted"><span className="capitalize">{entry.entryType?.replaceAll('_', ' ')}</span> · <span dir="ltr">{formatDateKey(entry.entryDate)}</span> · {entry.isComplete ? 'Complete' : 'Incomplete'}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? 'Save check' : 'Record check'}
      </Button>
    </form>
  );
}
