const variants = {
  neutral: 'bg-surface-sunken text-secondary',
  action: 'bg-action-soft text-action',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  comparison: 'bg-comparison-soft text-comparison',
  information: 'bg-information-soft text-information',
  long: 'bg-action-soft text-action',
  short: 'bg-comparison-soft text-comparison',
};

export function Badge({ variant = 'neutral', className = '', children, ...props }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
