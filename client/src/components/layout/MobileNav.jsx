import { useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Modal } from '../ui/Modal.jsx';
import { mobileMoreItems, mobileNavigationItems } from './navigation.js';

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMoreItems.some((item) => item.to === location.pathname);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="z-30 grid shrink-0 grid-cols-4 border-t border-default bg-surface px-1 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 adaptive:hidden"
      >
        {mobileNavigationItems.map(({ to, label, Icon }) => (
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
        <button
          type="button"
          aria-current={moreActive ? 'page' : undefined}
          aria-haspopup="dialog"
          className={`group relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md text-[10.5px] transition-colors ${moreActive ? 'font-semibold text-action' : 'text-muted hover:bg-surface-raised hover:text-primary'}`}
          onClick={() => setMoreOpen(true)}
        >
          <DotsThree size={20} weight="bold" aria-hidden="true" />
          <span>More</span>
          <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-3.5 rounded-sm bg-current opacity-0 group-aria-[current=page]:opacity-100" />
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More destinations" size="sm">
        <nav aria-label="More navigation" className="space-y-2">
          {mobileMoreItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm transition-colors ${isActive ? 'border-action bg-action-soft font-semibold text-action' : 'border-default bg-surface-raised text-secondary hover:border-strong hover:text-primary'}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </Modal>
    </>
  );
}
