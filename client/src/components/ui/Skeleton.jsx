export function Skeleton({ className = '', label = 'Loading content' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`skeleton-shim block rounded-md bg-surface-sunken ${className}`}
    />
  );
}

export function SkeletonLines({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading content">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`skeleton-shim block h-3 rounded-sm bg-surface-sunken ${index === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
