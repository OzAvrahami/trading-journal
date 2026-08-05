import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Wallet } from '@phosphor-icons/react';
import { accountsApi } from '../api/accounts.js';
import { tradesApi } from '../api/trades.js';
import { TradeForm } from '../components/trades/TradeForm.jsx';
import { invalidateTradeQueries } from '../components/trades/tradeQueryInvalidation.js';
import { mapTradeToFormValues } from '../components/trades/tradeFormModel.js';
import { Button } from '../components/ui/Button.jsx';
import { ErrorState, EmptyState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useDirection } from '../hooks/useDirection.js';
import { useUserTimezone } from '../hooks/useUserTimezone.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function EditorSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-label={t('trades.editorLoading')}>
      <Skeleton className="h-16" />
      <Skeleton className="h-52" />
      <Skeleton className="h-44" />
    </div>
  );
}

function mutationMessage(error, fallback, t) {
  const code = error?.response?.data?.error?.code;
  if (code) return t(`errors.${code}`, { defaultValue: error.response?.data?.error?.message || fallback });
  return error?.response?.data?.error?.message || fallback;
}

export default function TradeEditor() {
  const { tradeId } = useParams();
  const isEdit = Boolean(tradeId);
  const validTradeId = !isEdit || UUID.test(tradeId);
  const { t } = useTranslation();
  const { isRtl } = useDirection();
  const timezone = useUserTimezone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resetVersion, setResetVersion] = useState(0);
  const [preservedAccountId, setPreservedAccountId] = useState('');
  const submitGuardRef = useRef(false);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const tradeQuery = useQuery({
    queryKey: ['trade', tradeId],
    queryFn: () => tradesApi.get(tradeId),
    enabled: isEdit && validTradeId,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: ({ payload }) => isEdit ? tradesApi.update(tradeId, payload) : tradesApi.create(payload),
  });

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const confirmDiscard = useCallback(() => !dirty || window.confirm(t('trades.discardConfirm')), [dirty, t]);
  const cancel = useCallback(() => { if (confirmDiscard()) navigate(isEdit ? `/trades/${tradeId}` : '/trades'); }, [confirmDiscard, isEdit, navigate, tradeId]);

  async function save(payload, intent, rawValues) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setServerError('');
    try {
      const trade = await mutation.mutateAsync({ payload });
      await invalidateTradeQueries(queryClient, trade.id || tradeId);
      toast.success(isEdit ? t('trades.tradeUpdated') : t('trades.tradeCreated'));
      setDirty(false);
      if (!isEdit && intent === 'addAnother') {
        setPreservedAccountId(rawValues.accountId);
        setResetVersion((value) => value + 1);
        submitGuardRef.current = false;
        return;
      }
      navigate(`/trades/${trade.id || tradeId}`);
    } catch (error) {
      const message = mutationMessage(error, t(isEdit ? 'trades.updateFailed' : 'trades.createFailed'), t);
      setServerError(message);
      toast.error(message);
      submitGuardRef.current = false;
    }
  }

  const tradeMissing = isEdit && (
    (tradeQuery.isSuccess && !tradeQuery.data)
    || tradeQuery.error?.response?.status === 404
    || tradeQuery.error?.response?.data?.error?.code === 'TRADE_NOT_FOUND'
  );
  const defaults = useMemo(() => isEdit && tradeQuery.data ? mapTradeToFormValues(tradeQuery.data, timezone) : undefined, [isEdit, timezone, tradeQuery.data]);

  if (!validTradeId) {
    return <ErrorState title={t('trades.invalidTrade')} detail={t('trades.invalidTradeDetail')} />;
  }
  if (tradeMissing) {
    return <EmptyState title={t('trades.notFound')} detail={t('trades.notFoundDetail')} action={<Button onClick={() => navigate('/trades')}>{t('trades.back')}</Button>} />;
  }
  if (tradeQuery.isError) return <ErrorState title={t('trades.loadError')} detail={t('trades.unavailableRecord')} onRetry={tradeQuery.refetch} />;
  if (accountsQuery.isError) return <ErrorState title={t('trades.accountsLoadFailed')} detail={t('trades.accountsLoadFailedDetail')} onRetry={accountsQuery.refetch} />;
  if (accountsQuery.isLoading || (isEdit && tradeQuery.isLoading)) return <EditorSkeleton />;
  if (!isEdit && (accountsQuery.data?.length ?? 0) === 0) {
    return <EmptyState title={t('accounts.noAccounts')} detail={t('accounts.noAccountsDetail')} action={<Button variant="primary" leadingIcon={<Wallet size={17} aria-hidden="true" />} onClick={() => navigate('/accounts')}>{t('trades.openAccounts')}</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-4 py-3">
        <Button type="button" variant="tertiary" size="mobile" leadingIcon={<BackIcon size={17} aria-hidden="true" />} onClick={cancel}>
          {isEdit ? t('trades.backToTrade') : t('trades.backToTrades')}
        </Button>
        <p className="text-xs text-muted">{t('trades.timezoneHelp', { timezone })}</p>
      </div>
      {(accountsQuery.isFetching || (isEdit && tradeQuery.isFetching)) && !accountsQuery.isLoading && !tradeQuery.isLoading && (
        <p role="status" className="text-xs text-muted">{t('trades.refreshingEditor')}</p>
      )}
      {serverError && <div role="alert" className="rounded-lg border border-negative bg-negative-soft p-4 text-sm text-primary">{serverError}</div>}
      <TradeForm
        key={isEdit ? tradeId : 'new-trade'}
        defaultValues={defaults}
        accounts={accountsQuery.data || []}
        timezone={timezone}
        isEdit={isEdit}
        loading={mutation.isPending}
        resetVersion={resetVersion}
        preservedAccountId={preservedAccountId}
        onSubmit={save}
        onCancel={cancel}
        onDirtyChange={setDirty}
      />
    </div>
  );
}
