import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { formatCurrency } from '../../utils/formatters.js';

export function ValueIndicator({ value, children, className = '' }) {
  const normalizedValue = value === 0 ? 0 : value;
  const state = normalizedValue > 0 ? 'positive' : normalizedValue < 0 ? 'negative' : 'neutral';
  const Icon = state === 'positive' ? CaretUp : state === 'negative' ? CaretDown : null;
  const text = state === 'positive' ? 'Gain' : state === 'negative' ? 'Loss' : 'No change';
  const color = state === 'positive' ? 'text-positive' : state === 'negative' ? 'text-negative' : 'text-secondary';

  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${color} ${className}`} dir="ltr">
      {Icon && <Icon size={12} weight="bold" aria-hidden="true" />}
      <span className="sr-only">{text}: </span>
      {children ?? value}
    </span>
  );
}

export function Money({ value, className = '', ...props }) {
  return <span className={`numeric font-mono ${className}`} dir="ltr" {...props}>{formatCurrency(value)}</span>;
}
