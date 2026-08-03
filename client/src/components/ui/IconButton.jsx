const variants = {
  secondary: 'border-default bg-surface-raised text-secondary hover:border-strong hover:text-primary',
  tertiary: 'border-transparent bg-transparent text-secondary hover:bg-surface-raised hover:text-primary',
  destructive: 'border-transparent bg-transparent text-negative hover:bg-negative-soft',
};

export function IconButton({ label, variant = 'secondary', size = 'default', className = '', children, ...props }) {
  if (!label) throw new Error('IconButton requires an accessible label.');
  const dimensions = size === 'sm' ? 'h-8 w-8' : size === 'mobile' ? 'h-11 w-11' : 'h-9 w-9';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted ${dimensions} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
