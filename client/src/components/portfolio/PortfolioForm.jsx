import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { Field, Input } from '../ui/FormControls.jsx';

export function PortfolioForm({ portfolio, onSubmit, loading = false }) {
  const { t } = useTranslation(); const prefix = useId();
  const [form, setForm] = useState({ name: portfolio?.name || '', description: portfolio?.description || '', baseCurrency: portfolio?.baseCurrency || 'USD', isDefault: Boolean(portfolio?.isDefault) });
  const [errors, setErrors] = useState({}); const set = (key,value)=>setForm((current)=>({...current,[key]:value}));
  function submit(event){event.preventDefault();const next={};if(!form.name.trim())next.name=t('portfolio.validation.nameRequired');if(!/^[A-Za-z]{3}$/.test(form.baseCurrency.trim()))next.baseCurrency=t('portfolio.validation.currency');setErrors(next);if(!Object.keys(next).length)onSubmit({name:form.name.trim(),description:form.description.trim()||null,baseCurrency:form.baseCurrency.trim().toUpperCase(),isDefault:form.isDefault});}
  return <form onSubmit={submit} className="space-y-4" noValidate>
    <Field id={`${prefix}-name`} label={t('portfolio.name')} required error={errors.name}>{(props)=><Input {...props} dir="auto" value={form.name} maxLength={120} onChange={(e)=>set('name',e.target.value)} />}</Field>
    <Field id={`${prefix}-description`} label={t('common.description')}><textarea id={`${prefix}-description`} className="input min-h-24 resize-y" dir="auto" maxLength={2000} value={form.description} onChange={(e)=>set('description',e.target.value)} /></Field>
    <Field id={`${prefix}-currency`} label={t('portfolio.baseCurrency')} required error={errors.baseCurrency} helpText={portfolio ? t('portfolio.currencyLockedHelp') : t('portfolio.currencyHelp')}>{(props)=><Input {...props} dir="ltr" maxLength={3} disabled={Boolean(portfolio?.lastTransactionDate)} value={form.baseCurrency} onChange={(e)=>set('baseCurrency',e.target.value)} />}</Field>
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-default bg-surface-raised px-3 text-sm text-primary"><input type="checkbox" checked={form.isDefault} onChange={(e)=>set('isDefault',e.target.checked)} />{t('portfolio.setDefault')}</label>
    <Button type="submit" variant="primary" size="mobile" className="w-full" disabled={loading}>{loading?t('common.saving'):t(portfolio?'common.saveChanges':'portfolio.createPortfolio')}</Button>
  </form>;
}
