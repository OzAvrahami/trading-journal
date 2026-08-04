import { forwardRef, useId } from 'react';

export function Field({ label, helpText, error, required, id: suppliedId, children, className = '' }) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ms-1 text-negative" aria-hidden="true">*</span>}
      </label>
      {typeof children === 'function'
        ? children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })
        : children}
      {helpText && <p id={helpId} className="mt-1 text-xs text-muted">{helpText}</p>}
      {error && <p id={errorId} className="mt-1 text-xs text-negative">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ numeric = false, className = '', dir, ...props }, ref) {
  return <input ref={ref} className={`input ${numeric ? 'numeric font-mono text-end' : ''} ${className}`} dir={numeric ? 'ltr' : dir} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', ...props }, ref) {
  return <select ref={ref} className={`input ${className}`} {...props} />;
});

export const Checkbox = forwardRef(function Checkbox({ label, className = '', ...props }, ref) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <label htmlFor={id} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-secondary ${className}`}>
      <input ref={ref} id={id} type="checkbox" className="h-4 w-4 rounded-sm border-strong accent-action" {...props} />
      <span>{label}</span>
    </label>
  );
});
