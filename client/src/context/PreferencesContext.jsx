import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { preferencesApi } from '../api/preferences.js';
import { applyDocumentLocale } from '../i18n/index.js';
import i18n from '../i18n/index.js';
import { applyTheme } from '../hooks/useTheme.js';
import { applyTradeFormMode } from '../components/trades/tradeFormModel.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';

export const PREFERENCES_QUERY_KEY = ['preferences'];
const PreferencesContext = createContext(null);

export function applyLocalPreference(field, value) {
  if (field === 'locale') {
    applyDocumentLocale(value);
    void i18n.changeLanguage(value);
  } else if (field === 'theme') {
    applyTheme(value);
  } else if (field === 'tradeFormMode') {
    applyTradeFormMode(value);
  }
}

const timezoneQueryRoots = [
  'analytics', 'dashboard', 'trades', 'journal', 'rules', 'goals', 'daily-review', 'import-runs',
  'portfolios', 'portfolio',
];

export function PreferencesProvider({ children }) {
  const { user, applyUserUpdate } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [syncState, setSyncState] = useState('local');
  const query = useQuery({
    queryKey: [...PREFERENCES_QUERY_KEY, user?.id],
    queryFn: preferencesApi.get,
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!query.data) return;
    ['locale', 'theme', 'tradeFormMode'].forEach((field) => {
      if (query.data[field] != null) applyLocalPreference(field, query.data[field]);
    });
    const hasServerPreference = ['locale', 'theme', 'tradeFormMode'].some((field) => query.data[field] != null);
    setSyncState(hasServerPreference ? 'synced' : 'local');
  }, [query.data]);

  const updatePreference = useCallback((field, value) => {
    applyLocalPreference(field, value);
    if (!user) {
      setSyncState('local');
      return Promise.resolve(null);
    }
    setSyncState('saving');
    return preferencesApi.update({ [field]: value })
      .then((resolved) => {
        queryClient.setQueryData([...PREFERENCES_QUERY_KEY, user.id], resolved);
        setSyncState('synced');
        return resolved;
      })
      .catch((error) => {
        setSyncState('local-only');
        toast.error(t('settings.syncFailedDeviceOnly'));
        throw error;
      });
  }, [queryClient, t, toast, user]);

  const saveTimezone = useCallback(async (timezone) => {
    const resolved = await preferencesApi.update({ timezone });
    queryClient.setQueryData([...PREFERENCES_QUERY_KEY, user?.id], resolved);
    applyUserUpdate?.({ timezone: resolved.timezone });
    await Promise.all(timezoneQueryRoots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
    return resolved;
  }, [applyUserUpdate, queryClient, user?.id]);

  const value = useMemo(() => ({
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    syncState,
    updatePreference,
    saveTimezone,
  }), [query.data, query.isError, query.isLoading, query.refetch, saveTimezone, syncState, updatePreference]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}

export function useOptionalPreferences() {
  return useContext(PreferencesContext);
}
