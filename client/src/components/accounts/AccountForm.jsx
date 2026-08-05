import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';

const ACCOUNT_TYPES = ['funded', 'evaluation', 'demo', 'live'];

export function normalizeAccountForm(form) {
  return {
    company: form.company.trim(),
    accountNumber: form.accountNumber.trim(),
    accountName: form.accountName.trim() || null,
    accountType: form.accountType || null,
    baseCurrency: form.baseCurrency.trim().toUpperCase(),
    openingBalance: Number(form.openingBalance),
    isDefault: Boolean(form.isDefault),
  };
}

export function AccountForm({ account, onSubmit, loading = false }) {
  const { t } = useTranslation();
  const formId = useId().replace(/:/g, '');
  const [form, setForm] = useState({
    company: account?.company || '', accountNumber: account?.accountNumber || '',
    accountName: account?.accountName || '', accountType: account?.accountType || '',
    baseCurrency: account?.baseCurrency || 'USD', openingBalance: String(account?.openingBalance ?? 0),
    isDefault: Boolean(account?.isDefault),
  });
  const [errors, setErrors] = useState({});
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.company.trim()) nextErrors.company = t('accounts.validation.companyRequired');
    if (!form.accountNumber.trim()) nextErrors.accountNumber = t('accounts.validation.numberRequired');
    if (!/^[A-Za-z]{3}$/.test(form.baseCurrency.trim())) nextErrors.baseCurrency = t('accounts.validation.currency');
    if (!Number.isFinite(Number(form.openingBalance))) nextErrors.openingBalance = t('accounts.validation.balance');
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) onSubmit(normalizeAccountForm(form));
  }
  const field = (name, label, control) => <div><label className="label" htmlFor={`${formId}-${name}`}>{label}</label>{control(`${formId}-${name}`)}{errors[name] && <p id={`${formId}-${name}-error`} role="alert" className="mt-1 text-xs text-negative">{errors[name]}</p>}</div>;
  return <form onSubmit={submit} noValidate className="space-y-4">
    <div className="grid gap-4 adaptive:grid-cols-2">
      {field('accountName', t('accounts.accountName'), id => <input id={id} className="input min-h-11" dir="auto" value={form.accountName} onChange={e => set('accountName', e.target.value)} />)}
      {field('company', t('accounts.companyBroker'), id => <input id={id} className="input min-h-11" dir="auto" required aria-invalid={Boolean(errors.company)} value={form.company} onChange={e => set('company', e.target.value)} />)}
      {field('accountNumber', t('common.accountNumber'), id => <input id={id} className="input min-h-11" dir="ltr" required aria-invalid={Boolean(errors.accountNumber)} value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />)}
      {field('accountType', t('common.accountType'), id => <select id={id} className="input min-h-11" value={form.accountType} onChange={e => set('accountType', e.target.value)}><option value="">—</option>{ACCOUNT_TYPES.map(type => <option key={type} value={type}>{t(`status.${type}`)}</option>)}</select>)}
      {field('baseCurrency', t('accounts.baseCurrency'), id => <input id={id} className="input min-h-11 uppercase" dir="ltr" maxLength="3" required aria-invalid={Boolean(errors.baseCurrency)} value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} />)}
      {field('openingBalance', t('accounts.openingBalance'), id => <input id={id} className="input min-h-11" dir="ltr" inputMode="decimal" type="number" step="0.01" aria-invalid={Boolean(errors.openingBalance)} value={form.openingBalance} onChange={e => set('openingBalance', e.target.value)} />)}
    </div>
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-default bg-surface-sunken px-3 text-sm text-primary"><input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />{t('accounts.setDefault')}</label>
    <Button type="submit" variant="primary" size="mobile" className="w-full" disabled={loading}>{loading ? t('common.saving') : t(account ? 'common.saveChanges' : 'accounts.createAccount')}</Button>
  </form>;
}
