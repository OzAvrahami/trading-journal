import { useEffect, useState } from 'react';
import { CaretDown, CaretLeft, CaretRight, ChartLineUp, SignOut } from '@phosphor-icons/react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconButton } from '../ui/IconButton.jsx';
import { navigationGroups, preserveInvestmentScope } from './navigation.js';
import { useDirection } from '../../hooks/useDirection.js';
import { useTranslation } from 'react-i18next';

function getInitials(user) {
  const source = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function Sidebar({ collapsed, onToggle, user, onLogout }) {
  const { t } = useTranslation();
  const { isRtl } = useDirection();
  const CollapseIcon = isRtl
    ? (collapsed ? CaretLeft : CaretRight)
    : (collapsed ? CaretRight : CaretLeft);
  const displayName = user?.displayName?.trim();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState(() => new Set(['/portfolio']));
  useEffect(() => {
    if (location.pathname.startsWith('/portfolio')) {
      setExpandedItems((current) => new Set(current).add('/portfolio'));
    }
  }, [location.pathname]);

  return (
    <aside
      className={`hidden h-dvh shrink-0 flex-col overflow-hidden border-e border-default bg-surface transition-[width] duration-200 adaptive:flex ${collapsed ? 'w-[62px]' : 'w-[244px]'}`}
      aria-label={t('navigation.sidebar')}
    >
      <div className={`flex h-14 shrink-0 items-center border-b border-default ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3.5'}`}>
        {!collapsed && (
          <>
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-action text-white">
              <ChartLineUp size={16} weight="fill" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">TradingLog</span>
          </>
        )}
        <IconButton
          label={collapsed ? t('navigation.expand') : t('navigation.collapse')}
          size="sm"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          <CollapseIcon size={14} aria-hidden="true" />
        </IconButton>
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? 'px-2' : 'px-2.5'}`} aria-label={t('navigation.main')}>
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                {t(group.labelKey)}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map(({ to, labelKey, Icon, children }) => children && !collapsed ? (
                <div key={to}>
                  <button
                    type="button"
                    aria-expanded={expandedItems.has(to)}
                    className={`flex min-h-11 w-full items-center gap-2.5 border-s-2 px-2.5 text-sm transition-colors ${location.pathname.startsWith(to) ? 'border-action bg-action-soft font-medium text-action' : 'border-transparent text-secondary hover:bg-surface-raised hover:text-primary'}`}
                    onClick={() => setExpandedItems((current) => {
                      const next = new Set(current); if (next.has(to)) next.delete(to); else next.add(to); return next;
                    })}
                  >
                    <Icon size={17} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-start">{t(labelKey)}</span>
                    <CaretDown size={14} className={`shrink-0 transition-transform ${expandedItems.has(to) ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expandedItems.has(to) && children.map((child) => (
                    <NavLink key={child.to} to={preserveInvestmentScope(child.to, location)} end className={({ isActive }) => `ms-6 flex min-h-11 items-center border-s px-3 text-sm ${isActive ? 'border-action font-medium text-action' : 'border-default text-secondary hover:text-primary'}`}>
                      {t(child.labelKey)}
                    </NavLink>
                  ))}
                </div>
              ) : children && collapsed ? (
                <div key={to} className="space-y-1" aria-label={t(labelKey)}>
                  {children.map((child) => {
                    const ChildIcon = child.Icon;
                    return <NavLink key={child.to} to={preserveInvestmentScope(child.to, location)} end title={t(child.labelKey)} aria-label={t(child.labelKey)} className={({ isActive }) => `flex min-h-11 items-center justify-center border-s-2 px-2 text-sm ${isActive ? 'border-action bg-action-soft text-action' : 'border-transparent text-secondary hover:bg-surface-raised hover:text-primary'}`}><ChildIcon size={17} aria-hidden="true" /></NavLink>;
                  })}
                </div>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? t(labelKey) : undefined}
                  aria-label={collapsed ? t(labelKey) : undefined}
                  className={({ isActive }) => `flex min-h-11 items-center border-s-2 rounded-e-md rounded-s-none text-sm transition-colors ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'} ${isActive ? 'border-action bg-action-soft font-medium text-action' : 'border-transparent text-secondary hover:bg-surface-raised hover:text-primary'}`}
                >
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{t(labelKey)}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 border-t border-default p-2.5 ${collapsed ? 'space-y-2' : ''}`}>
        <div className={`flex min-h-10 items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-1.5'}`} title={collapsed ? (displayName || user?.email) : undefined}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-default bg-surface-sunken text-[11px] font-semibold text-secondary">
            {getInitials(user)}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              {displayName && <span className="block truncate text-xs font-medium text-primary">{displayName}</span>}
              {user?.email && <span className="block truncate text-[11px] text-muted">{user.email}</span>}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? t('shell.logout') : undefined}
          aria-label={collapsed ? t('shell.logout') : undefined}
          className={`mt-1 flex min-h-9 w-full items-center rounded-md text-xs text-secondary transition-colors hover:bg-surface-raised hover:text-primary ${collapsed ? 'justify-center' : 'gap-2.5 px-2'}`}
        >
          <SignOut size={16} aria-hidden="true" />
          {!collapsed && <span>{t('shell.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
