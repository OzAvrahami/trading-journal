import { NavLink } from 'react-router-dom';
import { navigationItems } from './navigation.js';

export function MobileNav() {
  return (
    <nav
      aria-label="Primary navigation"
      className="z-30 grid shrink-0 grid-cols-4 border-t border-default bg-surface px-1 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 adaptive:hidden"
    >
      {navigationItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `group relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md text-[10.5px] transition-colors ${isActive ? 'font-semibold text-action' : 'text-muted hover:bg-surface-raised hover:text-primary'}`}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
          <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-3.5 rounded-sm bg-current opacity-0 group-aria-[current=page]:opacity-100" />
        </NavLink>
      ))}
    </nav>
  );
}
