import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tradesApi } from '../../api/trades.js';
import { Modal } from '../ui/Modal.jsx';
import { TradeForm } from './TradeForm.jsx';
import { useToast } from '../ui/Toast.jsx';

export function QuickAddModal({ open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (data) => tradesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Trade added successfully!');
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || 'Failed to add trade.';
      toast.error(msg);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Quick Add Trade" size="lg">
      <TradeForm
        onSubmit={mutation.mutate}
        loading={mutation.isPending}
      />
    </Modal>
  );
}
