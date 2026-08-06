import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { accountsApi } from '../api/accounts.js';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { activeLocale, SUPPORTED_LOCALES } from '../i18n/index.js';
import { useTheme, THEME_PREFERENCES } from '../hooks/useTheme.js';
import { readTradeFormMode, TRADE_FORM_MODE_EVENT, TRADE_FORM_MODES } from '../components/trades/tradeFormModel.js';
import { isValidTimezone } from '../utils/dateOnly.js';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';

function ChoiceGroup({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${value === option.value ? 'border-action bg-action-soft text-action' : 'border-default bg-surface-raised text-secondary hover:border-strong hover:text-primary'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function timezoneOptions(current) {
  let values = [];
  try { values = Intl.supportedValuesOf?.('timeZone') || []; } catch {}
  return [...new Set(['Asia/Jerusalem', 'UTC', 'America/New_York', 'Europe/London', current, ...values].filter(Boolean))].sort();
}

export default function Settings() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { preferences, isLoading, isError, refetch, syncState, updatePreference, saveTimezone } = usePreferences();
  const { preference: themePreference } = useTheme();
  const [mode, setMode] = useState(readTradeFormMode);
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [timezoneError, setTimezoneError] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const accountsQuery = useQuery({ queryKey: ['accounts', { includeArchived: true }], queryFn: () => accountsApi.list({ includeArchived: 'true' }) });
  const activeAccounts = (accountsQuery.data || []).filter((account) => account.status === 'active');

  useEffect(() => { if (preferences?.timezone) setTimezone(preferences.timezone); }, [preferences?.timezone]);
  useEffect(() => { if (preferences) setDefaultAccountId(preferences.defaultAccount?.id || ''); }, [preferences]);
  useEffect(() => {
    const handler = (event) => setMode(event.detail);
    window.addEventListener(TRADE_FORM_MODE_EVENT, handler);
    return () => window.removeEventListener(TRADE_FORM_MODE_EVENT, handler);
  }, []);

  const zones = useMemo(() => timezoneOptions(preferences?.timezone), [preferences?.timezone]);
  const timezoneMutation = useMutation({
    mutationFn: async () => {
      const normalized = timezone.trim();
      if (!isValidTimezone(normalized)) throw new Error('INVALID_TIMEZONE');
      return saveTimezone(normalized);
    },
    onSuccess: () => { setTimezoneError(''); toast.success(t('settings.timezoneUpdated')); },
    onError: (error) => {
      const message = error.message === 'INVALID_TIMEZONE' ? t('settings.invalidTimezone') : t('settings.timezoneSaveFailed');
      setTimezoneError(message);
      toast.error(message);
    },
  });
  const defaultMutation = useMutation({
    mutationFn: () => accountsApi.update(defaultAccountId, { isDefault: true }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['preferences'] }),
      ]);
      toast.success(t('settings.defaultAccountUpdated'));
    },
    onError: () => toast.error(t('settings.defaultAccountSaveFailed')),
  });

  const changeImmediate = (field, value) => {
    updatePreference(field, value).catch(() => {});
  };

  if (isLoading && !preferences) return <div className="grid gap-4 compact:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (isError && !preferences) return <ErrorState title={t('settings.loadFailed')} detail={t('settings.loadFailedDetail')} onRetry={refetch} />;

  return (
    <div className="grid gap-4 wide:grid-cols-2">
      <Card className="space-y-4" aria-labelledby="settings-language">
        <div><h2 id="settings-language" className="text-base font-semibold text-primary">{t('settings.languageDirection')}</h2><p className="mt-1 text-sm text-secondary">{t('settings.languageHelp')}</p></div>
        <ChoiceGroup label={t('settings.language')} value={activeLocale()} options={SUPPORTED_LOCALES.map((value) => ({ value, label: value === 'he' ? 'עברית' : 'English' }))} onChange={(value) => changeImmediate('locale', value)} />
      </Card>

      <Card className="space-y-4" aria-labelledby="settings-appearance">
        <div><h2 id="settings-appearance" className="text-base font-semibold text-primary">{t('settings.appearance')}</h2><p className="mt-1 text-sm text-secondary">{t('settings.appearanceHelp')}</p></div>
        <ChoiceGroup label={t('settings.theme')} value={themePreference} options={THEME_PREFERENCES.map((value) => ({ value, label: t(`settings.themeOptions.${value}`) }))} onChange={(value) => changeImmediate('theme', value)} />
      </Card>

      <Card className="space-y-4" aria-labelledby="settings-timezone">
        <div><h2 id="settings-timezone" className="text-base font-semibold text-primary">{t('settings.timezone')}</h2><p id="settings-timezone-help" className="mt-1 text-sm text-secondary">{t('settings.timezoneHelp')}</p></div>
        <div>
          <label htmlFor="settings-timezone-input" className="label">{t('settings.timezone')}</label>
          <input id="settings-timezone-input" list="settings-timezones" value={timezone} onChange={(event) => { setTimezone(event.target.value); setTimezoneError(''); }} className="input min-h-11" dir="ltr" aria-describedby={`settings-timezone-help${timezoneError ? ' settings-timezone-error' : ''}`} aria-invalid={Boolean(timezoneError)} />
          <datalist id="settings-timezones">{zones.map((zone) => <option key={zone} value={zone} />)}</datalist>
          {timezoneError && <p id="settings-timezone-error" role="alert" className="mt-1 text-xs text-negative">{timezoneError}</p>}
        </div>
        <Button variant="primary" size="mobile" loading={timezoneMutation.isPending} disabled={timezone.trim() === preferences?.timezone} onClick={() => timezoneMutation.mutate()}>{t('settings.saveTimezone')}</Button>
      </Card>

      <Card className="space-y-5" aria-labelledby="settings-trading-defaults">
        <div><h2 id="settings-trading-defaults" className="text-base font-semibold text-primary">{t('settings.tradingDefaults')}</h2><p className="mt-1 text-sm text-secondary">{t('settings.tradingDefaultsHelp')}</p></div>
        <div className="space-y-3">
          <label htmlFor="settings-default-account" className="label">{t('settings.defaultAccount')}</label>
          {accountsQuery.isLoading ? <Skeleton className="h-11" /> : accountsQuery.isError ? <ErrorState title={t('settings.accountsLoadFailed')} onRetry={accountsQuery.refetch} /> : activeAccounts.length === 0 ? <EmptyState title={t('settings.noActiveAccounts')} detail={t('settings.noActiveAccountsDetail')} action={<Button onClick={() => navigate('/accounts')}>{t('settings.manageAccounts')}</Button>} /> : <>
            <select id="settings-default-account" className="input min-h-11" value={defaultAccountId} onChange={(event) => setDefaultAccountId(event.target.value)} dir="auto">
              <option value="">{t('accounts.noDefault')}</option>
              {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName || account.company} · ⁦{account.accountNumber}⁩ · {account.baseCurrency}</option>)}
            </select>
            <Button type="button" size="mobile" loading={defaultMutation.isPending} disabled={!defaultAccountId || defaultAccountId === preferences?.defaultAccount?.id} onClick={() => defaultMutation.mutate()}>{t('settings.applyDefaultAccount')}</Button>
          </>}
        </div>
        <div className="space-y-3 border-t border-default pt-4">
          <div><h3 className="text-sm font-semibold text-primary">{t('settings.defaultTradeMode')}</h3><p className="mt-1 text-xs text-muted">{t('settings.tradeModeHelp')}</p></div>
          <ChoiceGroup label={t('settings.defaultTradeMode')} value={mode} options={TRADE_FORM_MODES.map((value) => ({ value, label: t(`trades.${value}`) }))} onChange={(value) => changeImmediate('tradeFormMode', value)} />
        </div>
      </Card>

      <Card className="space-y-2 wide:col-span-2" aria-labelledby="settings-sync">
        <h2 id="settings-sync" className="text-sm font-semibold text-primary">{t('settings.syncStatus')}</h2>
        <p className="text-sm text-secondary" role="status" aria-live="polite">{t(`settings.syncStates.${syncState}`)}</p>
      </Card>
    </div>
  );
}
