import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tradesApi } from '../../api/trades.js';
import { Modal } from '../ui/Modal.jsx';
import { TradeForm } from './TradeForm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { useTranslation } from 'react-i18next';

export function QuickAddModal({ open, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (data) => tradesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(t('trades.tradeAdded', { defaultValue: 'Trade added successfully!' }));
      onClose();
    },
    onError: (err) => {
      const code = err.response?.data?.error?.code;
      const msg = code ? t(`errors.${code}`, { defaultValue: err.response?.data?.error?.message }) : t('trades.createFailed');
      toast.error(msg);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t('trades.addTrade')} size="lg">
      <TradeForm
        onSubmit={mutation.mutate}
        loading={mutation.isPending}
      />
    </Modal>
  );
}
