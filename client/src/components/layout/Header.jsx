import { CaretLeft, CaretRight, Moon, Sun } from '@phosphor-icons/react';
import { IconButton } from '../ui/IconButton.jsx';
import { useDirection } from '../../hooks/useDirection.js';
import { useTheme } from '../../hooks/useTheme.js';

export function Header({ metadata }) {
  const { isRtl } = useDirection();
  const { theme, toggleTheme } = useTheme();
  const CrumbIcon = isRtl ? CaretLeft : CaretRight;
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Use light theme' : 'Use dark theme';

  return (
    <header className="z-20 shrink-0 border-b border-default bg-surface">
      <div className="flex min-h-14 items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="mb-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted">
            {metadata.breadcrumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
                <span className="truncate">{crumb}</span>
                {index < metadata.breadcrumbs.length - 1 && <CrumbIcon size={9} className="shrink-0" aria-hidden="true" />}
              </span>
            ))}
          </nav>
          <h1 className="truncate text-[19px] font-semibold leading-6 tracking-[-0.015em] text-primary">{metadata.title}</h1>
        </div>
        <IconButton label={themeLabel} onClick={toggleTheme}>
          <ThemeIcon size={17} aria-hidden="true" />
        </IconButton>
      </div>
      {metadata.description && (
        <p className="hidden px-4 pb-2.5 text-xs text-secondary compact:block">{metadata.description}</p>
      )}
    </header>
  );
}
