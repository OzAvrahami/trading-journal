import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, CaretRight, ListChecks, MagnifyingGlass, Moon, Notebook, Plus, Sun, Target } from '@phosphor-icons/react';
import { IconButton } from '../ui/IconButton.jsx';
import { useDirection } from '../../hooks/useDirection.js';
import { useTheme } from '../../hooks/useTheme.js';
import { navigationItems } from './navigation.js';
import { CommandPalette } from './CommandPalette.jsx';
import { useHeaderControlsRuntime } from './HeaderControls.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import { useOptionalPreferences } from '../../context/PreferencesContext.jsx';

function platformShortcut() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
}

export function Header({ metadata }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRtl } = useDirection();
  const { theme, toggleTheme } = useTheme();
  const preferences = useOptionalPreferences();
  const { setTarget, getRouteCommands } = useHeaderControlsRuntime();
  const [commandOpen, setCommandOpen] = useState(false);
  const CrumbIcon = isRtl ? CaretLeft : CaretRight;
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? t('shell.lightTheme') : t('shell.darkTheme');
  const shortcut = platformShortcut();

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const commands = useMemo(() => [
    ...navigationItems.map(({ to, labelKey, Icon }) => ({
      id: `navigate:${to}`,
      label: t(labelKey),
      description: t('shell.goTo', { label: t(labelKey) }),
      keywords: 'navigation route',
      Icon,
      action: () => navigate(to),
    })),
    {
      id: 'newTrade',
      label: t('trades.newTrade'),
      description: t('trades.newTradeDescription'),
      keywords: 'create trade full form',
      Icon: Plus,
      action: () => navigate('/trades/new'),
    },
    {
      id: 'newJournalEntry',
      label: t('shell.newJournal'),
      description: t('shell.newJournalDescription'),
      keywords: 'create note review',
      Icon: Notebook,
      action: () => navigate('/insights/journal?new=1'),
    },
    {
      id: 'newRule',
      label: t('shell.newRule'),
      description: t('shell.newRuleDescription'),
      keywords: 'rules adherence create',
      Icon: Plus,
      action: () => navigate('/insights/rules?action=new-rule'),
    },
    {
      id: 'recordRuleCheck',
      label: t('shell.recordCheck'),
      description: t('shell.recordCheckDescription'),
      keywords: 'rules adherence followed broken check',
      Icon: ListChecks,
      action: () => navigate('/insights/rules?action=record-check'),
    },
    {
      id: 'newGoal',
      label: t('shell.newGoal'),
      description: t('shell.newGoalDescription'),
      keywords: 'goals target progress create',
      Icon: Target,
      action: () => navigate('/insights/goals?action=new-goal'),
    },
    ...getRouteCommands(),
  ], [getRouteCommands, navigate, commandOpen, t]);

  return (
    <header className="z-20 shrink-0 border-b border-default bg-surface">
      <div className="flex min-h-14 flex-col gap-2 px-4 py-2.5 compact:flex-row compact:items-center">
        <div className="min-w-0 flex-1">
          <nav aria-label={t('shell.breadcrumb')} data-direction={isRtl ? 'rtl' : 'ltr'} className="mb-0.5 text-[11px] text-muted">
            <ol className="flex min-w-0 items-center gap-1">
              {metadata.breadcrumbs.map((crumb, index) => {
                const current = index === metadata.breadcrumbs.length - 1;
                return (
                  <li key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
                    <span className="truncate" aria-current={current ? 'page' : undefined}>{crumb}</span>
                    {!current && <CrumbIcon size={9} className="shrink-0" data-breadcrumb-direction={isRtl ? 'previous' : 'next'} aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
          <h1 className="truncate text-[19px] font-semibold leading-6 tracking-[-0.015em] text-primary">{metadata.title}</h1>
          {metadata.description && <p className="mt-0.5 max-w-[80ch] text-xs text-secondary">{metadata.description}</p>}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 compact:ms-auto compact:w-auto compact:justify-end" aria-label={t('common.pageControls')}>
          <div ref={setTarget} className="contents" />
          <button
            type="button"
            aria-label={t('shell.searchCommand')}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface-raised px-3 text-secondary transition-colors hover:border-strong hover:text-primary adaptive:min-h-9"
            onClick={() => setCommandOpen(true)}
          >
            <MagnifyingGlass size={16} aria-hidden="true" />
            <span className="hidden wide:inline">{t('common.search')}</span>
            <span className="hidden rounded-sm border border-default px-1 py-0.5 font-mono text-[10px] text-muted compact:inline" dir="ltr">{shortcut}</span>
          </button>
          <LanguageSwitcher />
          <IconButton label={themeLabel} size="mobile" className="adaptive:h-9 adaptive:w-9" onClick={() => {
            if (preferences) preferences.updatePreference('theme', theme === 'dark' ? 'light' : 'dark').catch(() => {});
            else toggleTheme();
          }}>
            <ThemeIcon size={17} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} commands={commands} />
    </header>
  );
}
