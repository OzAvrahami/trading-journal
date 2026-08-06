import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CurrencyDollar, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../api/investments.js';
import { portfolioApi } from '../api/portfolio.js';
import { InvestmentWorkspaceFrame, PositionSummary } from '../components/portfolio/InvestmentWorkspace.jsx';
import { invalidateInvestmentWorkspace } from '../components/portfolio/investmentQueryInvalidation.js';
import { ManualPriceForm } from '../components/portfolio/ManualPriceForm.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Field, Input, Select } from '../components/ui/FormControls.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';

function HoldingsContent({ accountId, scope, querySuffix }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', assetType: '', priceAvailability: '' });
  const [priceTarget, setPriceTarget] = useState(null);
  const params = useMemo(() => ({ ...(accountId ? { accountId } : {}), ...(filters.search ? { search: filters.search } : {}), ...(filters.assetType ? { assetType: filters.assetType } : {}), ...(filters.priceAvailability ? { priceAvailability: filters.priceAvailability } : {}) }), [accountId, filters]);
  const query = useQuery({ queryKey: ['investments', 'holdings', params], queryFn: () => investmentsApi.holdings(params), retry: false });
  const instruments = useQuery({ queryKey: ['investment-instruments', { includeInactive: true }], queryFn: () => portfolioApi.instruments({ includeInactive: 'true' }) });
  const priceMutation = useMutation({ mutationFn: ({ instrumentId, date, data }) => portfolioApi.upsertPrice(instrumentId, date, data), onSuccess: () => { invalidateInvestmentWorkspace(queryClient, { price: true }); setPriceTarget(null); toast.success(t('portfolio.priceSaved')); }, onError: () => toast.error(t('portfolio.saveFailed')) });
  if (query.isLoading) return <Skeleton className="h-80" label={t('investments.loadingHoldings')} />;
  if (query.isError) return <ErrorState title={t('investments.holdingsFailed')} detail={t('investments.loadFailedDetail')} onRetry={query.refetch} />;
  const rows = query.data.holdings;
  const selectedInstrument = priceTarget ? instruments.data?.instruments?.find((item) => item.id === priceTarget.instrumentId) : null;
  return <>
    <section aria-labelledby="holdings-filters"><h2 id="holdings-filters" className="sr-only">{t('investments.holdingsFilters')}</h2><Card density="compact"><div className="grid gap-3 adaptive:grid-cols-3"><Field id="holding-search" label={t('common.search')}>{(props) => <Input {...props} type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t('investments.searchHoldings')} />}</Field><Field id="holding-asset" label={t('portfolio.assetType')}>{(props) => <Select {...props} value={filters.assetType} onChange={(event) => setFilters((current) => ({ ...current, assetType: event.target.value }))}><option value="">{t('common.any')}</option><option value="stock">{t('portfolio.assetTypes.stock')}</option><option value="etf">{t('portfolio.assetTypes.etf')}</option></Select>}</Field><Field id="holding-price" label={t('investments.priceAvailability')}>{(props) => <Select {...props} value={filters.priceAvailability} onChange={(event) => setFilters((current) => ({ ...current, priceAvailability: event.target.value }))}><option value="">{t('common.any')}</option><option value="available">{t('investments.priceAvailable')}</option><option value="missing">{t('investments.missingPrice')}</option></Select>}</Field></div></Card></section>
    <section aria-labelledby="holdings-list"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="holdings-list" className="text-sm font-semibold text-primary">{t('investments.currentHoldings')}</h2><Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-action px-3 text-sm font-semibold text-on-action" to={`/portfolio/transactions${querySuffix}`}><Plus size={16} aria-hidden="true" />{t('portfolio.addTransaction')}</Link></div>{rows.length ? <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">{rows.map((item) => <PositionSummary key={`${item.accountId}-${item.instrumentId}`} item={item} actions={<><Link className="inline-flex min-h-11 items-center px-2 text-sm text-action" to={`/portfolio/${item.portfolioId}`}>{t('investments.openAccountLedger')}</Link><Button size="sm" leadingIcon={<CurrencyDollar size={15} aria-hidden="true" />} onClick={() => setPriceTarget(item)}>{t('portfolio.updatePrice')}</Button></>} />)}</div> : <EmptyState filtered={Boolean(filters.search || filters.assetType || filters.priceAvailability)} title={t('investments.noHoldings')} detail={t('investments.noHoldingsDetail')} onClear={() => setFilters({ search: '', assetType: '', priceAvailability: '' })} />}</section>
    <Modal open={Boolean(priceTarget)} onClose={() => !priceMutation.isPending && setPriceTarget(null)} title={t('portfolio.updateManualPrice')}><ManualPriceForm key={priceTarget?.instrumentId || 'price'} instruments={selectedInstrument ? [selectedInstrument] : []} initialInstrumentId={priceTarget?.instrumentId || ''} loading={priceMutation.isPending} onSubmit={(data) => priceMutation.mutate(data)} /></Modal>
  </>;
}

export default function InvestmentHoldings() { return <InvestmentWorkspaceFrame>{(props) => <HoldingsContent {...props} />}</InvestmentWorkspaceFrame>; }
