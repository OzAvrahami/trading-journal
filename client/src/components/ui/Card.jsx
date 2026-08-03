export function Card({ as: Component = 'section', density = 'default', className = '', children, ...props }) {
  const padding = density === 'compact' ? 'p-3' : density === 'spacious' ? 'p-5' : 'p-4';
  return (
    <Component className={`rounded-lg border border-default bg-surface shadow-flat ${padding} ${className}`} {...props}>
      {children}
    </Component>
  );
}
