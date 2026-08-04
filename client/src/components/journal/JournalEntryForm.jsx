import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { accountsApi } from '../../api/accounts.js';
import { tradesApi } from '../../api/trades.js';
import { formatDateKey, localTodayKey, normalizeDateKey } from '../../utils/dateOnly.js';
import { Button } from '../ui/Button.jsx';
import { Checkbox, Field, Input, Select } from '../ui/FormControls.jsx';
import { JOURNAL_ENTRY_TYPES, normalizeJournalTags } from './journalTypes.js';

function accountLabel(account) {
  if (!account) return null;
  return account.accountName || `${account.company} — ${account.accountNumber}`;
}

export function JournalEntryForm({ entry, onSubmit, loading = false }) {
  const [tradeSearch, setTradeSearch] = useState('');
  const [selectedTrades, setSelectedTrades] = useState(() => new Map((entry?.trades ?? []).map((trade) => [trade.id, trade])));
  const isEdit = Boolean(entry);
  const { register, handleSubmit, formState: { errors }, setError } = useForm({
    defaultValues: {
      entryType: entry?.entryType ?? 'note',
      entryDate: entry?.entryDate ?? localTodayKey(),
      title: entry?.title ?? '',
      content: entry?.content ?? '',
      tags: entry?.tags?.join(', ') ?? '',
      isComplete: entry?.isComplete ?? false,
    },
  });

  const tradeParams = useMemo(() => ({
    page: 1,
    limit: 20,
    sort: 'entry_datetime',
    order: 'desc',
    ...(tradeSearch.trim() ? { symbol: tradeSearch.trim() } : {}),
  }), [tradeSearch]);
  const tradesQuery = useQuery({
    queryKey: ['trades', 'journal-link-picker', tradeParams],
    queryFn: () => tradesApi.list(tradeParams),
    placeholderData: (previous) => previous,
  });
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const accountsById = new Map((accountsQuery.data ?? []).map((account) => [account.id, account]));
  const availableTrades = tradesQuery.data?.data ?? [];

  function toggleTrade(trade, checked) {
    setSelectedTrades((current) => {
      const next = new Map(current);
      if (checked) {
        if (next.size < 20) next.set(trade.id, trade);
      } else {
        next.delete(trade.id);
      }
      return next;
    });
  }

  function submit(values) {
    const tags = normalizeJournalTags(values.tags);
    if (tags.length > 10) {
      setError('tags', { type: 'manual', message: 'Use no more than 10 tags.' });
      return;
    }
    if (tags.some((tag) => tag.length > 32)) {
      setError('tags', { type: 'manual', message: 'Each tag must be 32 characters or fewer.' });
      return;
    }
    onSubmit({
      entryType: values.entryType,
      entryDate: values.entryDate,
      title: values.title.trim(),
      content: values.content.trim(),
      tags,
      isComplete: Boolean(values.isComplete),
      tradeIds: [...selectedTrades.keys()],
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label="Entry type" required error={errors.entryType?.message}>
          {(fieldProps) => (
            <Select {...fieldProps} {...register('entryType', { required: 'Choose an entry type.' })}>
              {JOURNAL_ENTRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Journal date" required error={errors.entryDate?.message}>
          {(fieldProps) => <Input type="date" dir="ltr" {...fieldProps} {...register('entryDate', { required: 'Choose a journal date.' })} />}
        </Field>
      </div>

      <Field label="Title" required error={errors.title?.message}>
        {(fieldProps) => <Input data-autofocus maxLength={160} {...fieldProps} {...register('title', { required: 'Enter a title.', validate: (value) => value.trim().length > 0 || 'Enter a title.' })} />}
      </Field>

      <Field label="Content" required error={errors.content?.message}>
        {(fieldProps) => (
          <textarea
            rows={7}
            className="input min-h-40 resize-y whitespace-pre-wrap"
            {...fieldProps}
            {...register('content', { required: 'Enter journal content.', validate: (value) => value.trim().length > 0 || 'Enter journal content.' })}
          />
        )}
      </Field>

      <Field label="Tags" helpText="Separate up to 10 tags with commas." error={errors.tags?.message}>
        {(fieldProps) => <Input placeholder="process, patience" {...fieldProps} {...register('tags')} />}
      </Field>

      <Checkbox label="Mark this entry complete" {...register('isComplete')} />

      <fieldset className="rounded-lg border border-default bg-surface-raised p-3">
        <legend className="px-1 text-xs font-semibold text-secondary">Linked trades (optional)</legend>
        <p className="mb-3 text-xs text-muted">Select up to 20 of your recent trades. Selected trades remain linked while you search.</p>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface px-3">
          <MagnifyingGlass size={16} className="text-muted" aria-hidden="true" />
          <span className="sr-only">Search trades by symbol</span>
          <input
            type="search"
            value={tradeSearch}
            onChange={(event) => setTradeSearch(event.target.value)}
            placeholder="Search by symbol"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
          />
        </label>
        <p className="mt-2 text-xs text-muted" aria-live="polite">{selectedTrades.size} of 20 selected</p>

        {tradesQuery.isLoading ? (
          <p className="mt-3 text-sm text-muted" role="status">Loading recent trades…</p>
        ) : tradesQuery.isError ? (
          <p className="mt-3 text-sm text-negative" role="alert">Trades could not be loaded. Existing selections are preserved.</p>
        ) : availableTrades.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No owned trades match this symbol search.</p>
        ) : (
          <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto" aria-label="Available trades">
            {availableTrades.map((trade) => {
              const selected = selectedTrades.has(trade.id);
              const account = accountLabel(accountsById.get(trade.accountId));
              return (
                <li key={trade.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-sunken">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && selectedTrades.size >= 20}
                      onChange={(event) => toggleTrade(trade, event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-action"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-primary" dir="ltr">{trade.symbol}</span>
                        <span className="capitalize text-secondary">{trade.status}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        <span dir="ltr">{formatDateKey(normalizeDateKey(trade.entryDatetime))}</span>{account ? ` · ${account}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <Button type="submit" variant="primary" size="mobile" className="w-full" loading={loading}>
        {isEdit ? 'Save changes' : 'Create entry'}
      </Button>
    </form>
  );
}
