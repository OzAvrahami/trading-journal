import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Select } from '../ui/FormControls.jsx';

export function InvestmentInstrumentForm({ instrument, portfolioCurrency='USD', onSubmit, loading=false }) {
  const {t}=useTranslation();const prefix=useId();const [form,setForm]=useState({symbol:instrument?.symbol||'',name:instrument?.name||'',exchange:instrument?.exchange||'',assetType:instrument?.assetType||'stock',currency:instrument?.currency||portfolioCurrency});const [errors,setErrors]=useState({});const set=(key,value)=>setForm((current)=>({...current,[key]:value}));
  function submit(e){e.preventDefault();const next={};if(!/^[A-Za-z0-9.-]{1,24}$/.test(form.symbol.trim()))next.symbol=t('portfolio.validation.symbol');if(!/^[A-Za-z]{3}$/.test(form.currency.trim()))next.currency=t('portfolio.validation.currency');setErrors(next);if(!Object.keys(next).length)onSubmit(instrument?{name:form.name.trim()||null,exchange:form.exchange.trim()||null}:{symbol:form.symbol.trim().toUpperCase(),name:form.name.trim()||null,exchange:form.exchange.trim()||null,assetType:form.assetType,currency:form.currency.trim().toUpperCase()});}
  return <form onSubmit={submit} className="space-y-4" noValidate><div className="grid gap-4 adaptive:grid-cols-2">
    <Field id={`${prefix}-symbol`} label={t('common.symbol')} required error={errors.symbol}>{(props)=><Input {...props} dir="ltr" disabled={Boolean(instrument)} value={form.symbol} onChange={(e)=>set('symbol',e.target.value)} />}</Field>
    <Field id={`${prefix}-name`} label={t('portfolio.instrumentName')}>{(props)=><Input {...props} dir="auto" value={form.name} onChange={(e)=>set('name',e.target.value)} />}</Field>
    <Field id={`${prefix}-exchange`} label={t('portfolio.exchange')}>{(props)=><Input {...props} dir="ltr" value={form.exchange} onChange={(e)=>set('exchange',e.target.value)} />}</Field>
    <Field id={`${prefix}-asset`} label={t('portfolio.assetType')} required>{(props)=><Select {...props} disabled={Boolean(instrument)} value={form.assetType} onChange={(e)=>set('assetType',e.target.value)}><option value="stock">{t('portfolio.assetTypes.stock')}</option><option value="etf">{t('portfolio.assetTypes.etf')}</option></Select>}</Field>
    <Field id={`${prefix}-currency`} label={t('portfolio.currency')} required error={errors.currency} helpText={t('portfolio.instrumentCurrencyHelp')}>{(props)=><Input {...props} dir="ltr" disabled={Boolean(instrument)} value={form.currency} onChange={(e)=>set('currency',e.target.value)} />}</Field>
  </div><Button type="submit" variant="primary" size="mobile" className="w-full" disabled={loading}>{loading?t('common.saving'):t(instrument?'common.saveChanges':'portfolio.createInstrument')}</Button></form>;
}
