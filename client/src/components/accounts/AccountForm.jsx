import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';

const ACCOUNT_TYPES = ['funded', 'evaluation', 'demo', 'live'];
export const ACCOUNT_GROUPS = ['personal_investment', 'active_trading', 'prop_firm'];
export const GROUP_DEFAULTS = Object.freeze({
  personal_investment: { includeInInvestmentValue: true, includeInNetWorth: true, includeInTradingAnalytics: false },
  active_trading: { includeInInvestmentValue: false, includeInNetWorth: true, includeInTradingAnalytics: true },
  prop_firm: { includeInInvestmentValue: false, includeInNetWorth: false, includeInTradingAnalytics: true },
});

export function normalizeAccountForm(form) {
  return {
    company: form.company.trim(),
    accountNumber: form.accountNumber.trim(),
    accountName: form.accountName.trim() || null,
    accountType: form.accountType || null,
    baseCurrency: form.baseCurrency.trim().toUpperCase(),
    openingBalance: Number(form.openingBalance),
    isDefault: Boolean(form.isDefault),
    accountGroup: form.accountGroup,
    includeInInvestmentValue: Boolean(form.includeInInvestmentValue),
    includeInNetWorth: Boolean(form.includeInNetWorth),
    includeInTradingAnalytics: Boolean(form.includeInTradingAnalytics),
    ...(form.investmentDisplayName?.trim() ? { investmentDisplayName: form.investmentDisplayName.trim() } : {}),
    ...(form.linkPortfolioId ? { linkPortfolioId: form.linkPortfolioId } : {}),
  };
}

export function AccountForm({ account, initialValues, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const formId = useId().replace(/:/g, '');
  const source = account || initialValues || {};
  const initialGroup = source.accountGroup || 'active_trading';
  const defaults = GROUP_DEFAULTS[initialGroup];
  const [form, setForm] = useState({
    company: source.company || '', accountNumber: source.accountNumber || '',
    accountName: source.accountName || '', accountType: source.accountType || '',
    baseCurrency: source.baseCurrency || 'USD', openingBalance: String(source.openingBalance ?? 0),
    isDefault: Boolean(source.isDefault), accountGroup: initialGroup,
    includeInInvestmentValue: source.includeInInvestmentValue ?? defaults.includeInInvestmentValue,
    includeInNetWorth: source.includeInNetWorth ?? defaults.includeInNetWorth,
    includeInTradingAnalytics: source.includeInTradingAnalytics ?? defaults.includeInTradingAnalytics,
    investmentDisplayName: source.investmentDisplayName || '', linkPortfolioId: source.linkPortfolioId || '',
  });
  const [errors, setErrors] = useState({});
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function changeGroup(accountGroup) {
    setForm((current) => account
      ? { ...current, accountGroup }
      : { ...current, accountGroup, ...GROUP_DEFAULTS[accountGroup] });
  }
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.company.trim()) nextErrors.company = t('accounts.validation.companyRequired');
    if (!form.accountNumber.trim()) nextErrors.accountNumber = t('accounts.validation.numberRequired');
    if (!/^[A-Za-z]{3}$/.test(form.baseCurrency.trim())) nextErrors.baseCurrency = t('accounts.validation.currency');
    if (!Number.isFinite(Number(form.openingBalance))) nextErrors.openingBalance = t('accounts.validation.balance');
    if (form.accountGroup === 'prop_firm' && (form.includeInInvestmentValue || form.includeInNetWorth)) nextErrors.accountGroup = t('accounts.validation.propScope');
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) onSubmit(normalizeAccountForm(form));
  }
  const field = (name, label, control, help) => <div><label className="label" htmlFor={`${formId}-${name}`}>{label}</label>{control(`${formId}-${name}`)}{help && <p className="mt-1 text-xs text-muted">{help}</p>}{errors[name] && <p id={`${formId}-${name}-error`} role="alert" className="mt-1 text-xs text-negative">{errors[name]}</p>}</div>;
  const participation = [
    ['includeInInvestmentValue', 'accounts.portfolioValue'],
    ['includeInNetWorth', 'accounts.personalNetWorth'],
    ['includeInTradingAnalytics', 'accounts.tradingAnalytics'],
  ];
  return <form onSubmit={submit} noValidate className="space-y-5">
    <div className="grid gap-4 adaptive:grid-cols-2">
      {field('accountName', t('accounts.accountName'), id => <input id={id} className="input min-h-11" dir="auto" value={form.accountName} onChange={e => set('accountName', e.target.value)} />)}
      {field('company', t('accounts.companyBroker'), id => <input id={id} className="input min-h-11" dir="auto" required aria-invalid={Boolean(errors.company)} aria-describedby={errors.company ? `${id}-error` : undefined} value={form.company} onChange={e => set('company', e.target.value)} />)}
      {field('accountNumber', t('common.accountNumber'), id => <input id={id} className="input min-h-11" dir="ltr" required aria-invalid={Boolean(errors.accountNumber)} value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />)}
      {field('accountType', t('common.accountType'), id => <select id={id} className="input min-h-11" value={form.accountType} onChange={e => set('accountType', e.target.value)}><option value="">—</option>{ACCOUNT_TYPES.map(type => <option key={type} value={type}>{t(`status.${type}`)}</option>)}</select>)}
      {field('accountGroup', t('accounts.accountGroup'), id => <select id={id} className="input min-h-11" value={form.accountGroup} aria-invalid={Boolean(errors.accountGroup)} onChange={e => changeGroup(e.target.value)}>{ACCOUNT_GROUPS.map(group => <option key={group} value={group}>{t(`accounts.groups.${group}`)}</option>)}</select>, t(`accounts.groupHelp.${form.accountGroup}`))}
      {field('baseCurrency', t('accounts.baseCurrency'), id => <input id={id} className="input min-h-11 uppercase" dir="ltr" maxLength="3" required readOnly={Boolean(form.linkPortfolioId)} aria-invalid={Boolean(errors.baseCurrency)} value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} />, form.linkPortfolioId ? t('accounts.linkCurrencyLocked') : null)}
      {field('openingBalance', t('accounts.openingBalance'), id => <input id={id} className="input min-h-11" dir="ltr" inputMode="decimal" type="number" step="0.01" aria-invalid={Boolean(errors.openingBalance)} value={form.openingBalance} onChange={e => set('openingBalance', e.target.value)} />)}
      {form.includeInInvestmentValue && !form.linkPortfolioId && field('investmentDisplayName', t('accounts.investmentDisplayName'), id => <input id={id} className="input min-h-11" dir="auto" value={form.investmentDisplayName} onChange={e => set('investmentDisplayName', e.target.value)} />, t('accounts.investmentDisplayNameHelp'))}
    </div>
    <fieldset className="rounded-lg border border-default bg-surface-sunken p-3">
      <legend className="px-1 text-sm font-semibold text-primary">{t('accounts.participation')}</legend>
      <p className="mb-2 text-xs text-muted">{t('accounts.participationHelp')}</p>
      <div className="grid gap-2 adaptive:grid-cols-3">
        {participation.map(([key, labelKey]) => {
          const blocked = form.accountGroup === 'prop_firm' && key !== 'includeInTradingAnalytics';
          return <label key={key} className="flex min-h-11 items-center gap-3 rounded-md border border-default bg-surface px-3 text-sm text-primary"><input type="checkbox" checked={Boolean(form[key])} disabled={blocked && !form[key]} onChange={e => set(key, e.target.checked)} /><span>{t(labelKey)}</span></label>;
        })}
      </div>
      {form.accountGroup === 'prop_firm' && <p className="mt-2 text-xs text-muted">{t('accounts.propFirmScopeHelp')}</p>}
    </fieldset>
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-default bg-surface-sunken px-3 text-sm text-primary"><input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />{t('accounts.setDefault')}</label>
    <Button type="submit" variant="primary" size="mobile" className="w-full" disabled={loading}>{loading ? t('common.saving') : t(account ? 'common.saveChanges' : 'accounts.createAccount')}</Button>
  </form>;
}
