import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { accountsApi } from '../../api/accounts.js';
import { tradesApi } from '../../api/trades.js';
import { strategiesApi } from '../../api/strategies.js';
import { useUserTimezone } from '../../hooks/useUserTimezone.js';
import { Modal } from '../ui/Modal.jsx';
import { ErrorState, EmptyState } from '../ui/States.jsx';
import { useToast } from '../ui/Toast.jsx';
import { TradeForm } from './TradeForm.jsx';
import { invalidateTradeQueries } from './tradeQueryInvalidation.js';

export function QuickAddModal({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useUserTimezone();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const submitGuardRef = useRef(false);
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list, enabled: open });
  const strategiesQuery = useQuery({
    queryKey: ['strategies', { includeArchived: false }],
    queryFn: () => strategiesApi.list({ includeArchived: 'false' }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (data) => tradesApi.create(data),
    onSuccess: async (trade) => {
      await invalidateTradeQueries(queryClient, trade.id);
      toast.success(t('trades.tradeCreated'));
      setDirty(false);
      onClose();
    },
    onError: (error) => {
      const code = error.response?.data?.error?.code;
      toast.error(code ? t(`errors.${code}`, { defaultValue: error.response?.data?.error?.message }) : t('trades.createFailed'));
    },
    onSettled: () => { submitGuardRef.current = false; },
  });

  function submitQuick(payload) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    mutation.mutate(payload);
  }

  function requestClose() {
    if (mutation.isPending) return;
    if (dirty && !window.confirm(t('trades.discardQuickAddConfirm'))) return;
    setDirty(false);
    onClose();
  }

  function openFullForm(isFormDirty) {
    if (isFormDirty && !window.confirm(t('trades.openFullFormConfirm'))) return;
    setDirty(false);
    onClose();
    navigate('/trades/new');
  }

  const accounts = accountsQuery.data || [];
  const activeAccounts = accounts.filter((account) => account.status === 'active');

  return (
    <Modal open={open} onClose={requestClose} title={t('trades.quickAdd')} size="lg">
      {accountsQuery.isLoading ? (
        <p role="status" className="py-8 text-center text-sm text-muted">{t('trades.loadingAccounts')}</p>
      ) : accountsQuery.isError ? (
        <ErrorState title={t('trades.accountsLoadFailed')} detail={t('trades.accountsLoadFailedDetail')} onRetry={accountsQuery.refetch} />
      ) : activeAccounts.length === 0 ? (
        <EmptyState title={t('accounts.noAccounts')} detail={t('accounts.noAccountsDetail')} />
      ) : (
        <TradeForm
          accounts={accounts}
          managedStrategies={strategiesQuery.data?.strategies || []}
          timezone={timezone}
          variant="quick"
          loading={mutation.isPending}
          onSubmit={submitQuick}
          onCancel={requestClose}
          onOpenFullForm={openFullForm}
          onDirtyChange={setDirty}
        />
      )}
    </Modal>
  );
}
