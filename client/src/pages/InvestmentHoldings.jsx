import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CurrencyDollar, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { investmentsApi } from '../api/investments.js';
import { MARKET_DATA_BATCH_SIZE, marketDataApi } from '../api/marketData.js';
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

const MARKET_SYMBOL_PATTERN = /^[A-Z0-9.-]{1,20}$/;
const EMPTY_HOLDINGS = Object.freeze([]);

function normalizeMarketSymbol(symbol) {
  if (typeof symbol !== 'string') return null;
  const normalized = symbol.trim().toUpperCase();
  return MARKET_SYMBOL_PATTERN.test(normalized) ? normalized : null;
}

export function quoteSymbolsForHoldings(holdings = []) {
  return [...new Set(
    holdings
      .map((item) => normalizeMarketSymbol(item.symbol))
      .filter(Boolean),
  )].sort();
}

async function loadQuoteBatches(symbols) {
  const batches = [];
  for (let index = 0; index < symbols.length; index += MARKET_DATA_BATCH_SIZE) {
    batches.push(symbols.slice(index, index + MARKET_DATA_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((batch) => marketDataApi.quotes(batch)));
  return {
    quotes: results.flatMap((result) => Array.isArray(result?.quotes) ? result.quotes : []),
  };
}

function usableQuote(quote) {
  return Boolean(
    quote
    && normalizeMarketSymbol(quote.symbol)
    && Number.isFinite(Number(quote.price))
    && Number(quote.price) > 0,
  );
}

export function HoldingsContent({ accountId, querySuffix }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', assetType: '', priceAvailability: '' });
  const [priceTarget, setPriceTarget] = useState(null);
  const params = useMemo(() => ({
    ...(accountId ? { accountId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.assetType ? { assetType: filters.assetType } : {}),
    ...(filters.priceAvailability ? { priceAvailability: filters.priceAvailability } : {}),
  }), [accountId, filters]);
  const query = useQuery({
    queryKey: ['investments', 'holdings', params],
    queryFn: () => investmentsApi.holdings(params),
    retry: false,
  });
  const rows = query.data?.holdings ?? EMPTY_HOLDINGS;
  const quoteSymbols = useMemo(() => quoteSymbolsForHoldings(rows), [rows]);
  const quotesQuery = useQuery({
    queryKey: ['market-data', 'quotes', quoteSymbols],
    queryFn: () => loadQuoteBatches(quoteSymbols),
    enabled: query.isSuccess && quoteSymbols.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const quotesBySymbol = useMemo(() => {
    const lookup = {};
    for (const quote of quotesQuery.data?.quotes ?? []) {
      if (usableQuote(quote)) lookup[normalizeMarketSymbol(quote.symbol)] = quote;
    }
    return lookup;
  }, [quotesQuery.data]);
  const instruments = useQuery({
    queryKey: ['investment-instruments', { includeInactive: true }],
    queryFn: () => portfolioApi.instruments({ includeInactive: 'true' }),
  });
  const priceMutation = useMutation({
    mutationFn: ({ instrumentId, date, data }) => portfolioApi.upsertPrice(instrumentId, date, data),
    onSuccess: () => {
      invalidateInvestmentWorkspace(queryClient, { price: true });
      setPriceTarget(null);
      toast.success(t('portfolio.priceSaved'));
    },
    onError: () => toast.error(t('portfolio.saveFailed')),
  });

  if (query.isLoading) return <Skeleton className="h-80" label={t('investments.loadingHoldings')} />;
  if (query.isError) return <ErrorState title={t('investments.holdingsFailed')} detail={t('investments.loadFailedDetail')} onRetry={query.refetch} />;

  const selectedInstrument = priceTarget
    ? instruments.data?.instruments?.find((item) => item.id === priceTarget.instrumentId)
    : null;

  return <>
    <section aria-labelledby="holdings-filters">
      <h2 id="holdings-filters" className="sr-only">{t('investments.holdingsFilters')}</h2>
      <Card density="compact">
        <div className="grid gap-3 adaptive:grid-cols-3">
          <Field id="holding-search" label={t('common.search')}>{(props) => <Input {...props} type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t('investments.searchHoldings')} />}</Field>
          <Field id="holding-asset" label={t('portfolio.assetType')}>{(props) => <Select {...props} value={filters.assetType} onChange={(event) => setFilters((current) => ({ ...current, assetType: event.target.value }))}><option value="">{t('common.any')}</option><option value="stock">{t('portfolio.assetTypes.stock')}</option><option value="etf">{t('portfolio.assetTypes.etf')}</option></Select>}</Field>
          <Field id="holding-price" label={t('investments.priceAvailability')}>{(props) => <Select {...props} value={filters.priceAvailability} onChange={(event) => setFilters((current) => ({ ...current, priceAvailability: event.target.value }))}><option value="">{t('common.any')}</option><option value="available">{t('investments.priceAvailable')}</option><option value="missing">{t('investments.missingPrice')}</option></Select>}</Field>
        </div>
      </Card>
    </section>
    <section aria-labelledby="holdings-list">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="holdings-list" className="text-sm font-semibold text-primary">{t('investments.currentHoldings')}</h2>
          {quotesQuery.isLoading && <p className="mt-1 text-xs text-muted" role="status">{t('investments.loadingLiveQuotes')}</p>}
          {quotesQuery.isError && <p className="mt-1 text-xs text-warning" role="status">{t('investments.liveQuotesUnavailable')}</p>}
        </div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-action px-3 text-sm font-semibold text-on-action" to={`/portfolio/transactions${querySuffix}`}><Plus size={16} aria-hidden="true" />{t('portfolio.addTransaction')}</Link>
      </div>
      {rows.length ? <div className="grid gap-3 adaptive:grid-cols-2 wide:grid-cols-3">
        {rows.map((item) => {
          const symbol = normalizeMarketSymbol(item.symbol);
          const quote = symbol ? quotesBySymbol[symbol] : null;
          return <PositionSummary
            key={`${item.accountId}-${item.instrumentId}`}
            item={item}
            quote={quote}
            quoteStatus={quotesQuery.isSuccess && symbol && !quote ? 'missing' : null}
            actions={<>
              <Link className="inline-flex min-h-11 items-center px-2 text-sm text-action" to={`/portfolio/${item.portfolioId}`}>{t('investments.openAccountLedger')}</Link>
              <Button size="sm" leadingIcon={<CurrencyDollar size={15} aria-hidden="true" />} onClick={() => setPriceTarget(item)}>{t('portfolio.updatePrice')}</Button>
            </>}
          />;
        })}
      </div> : <EmptyState filtered={Boolean(filters.search || filters.assetType || filters.priceAvailability)} title={t('investments.noHoldings')} detail={t('investments.noHoldingsDetail')} onClear={() => setFilters({ search: '', assetType: '', priceAvailability: '' })} />}
    </section>
    <Modal open={Boolean(priceTarget)} onClose={() => !priceMutation.isPending && setPriceTarget(null)} title={t('portfolio.updateManualPrice')}>
      <ManualPriceForm key={priceTarget?.instrumentId || 'price'} instruments={selectedInstrument ? [selectedInstrument] : []} initialInstrumentId={priceTarget?.instrumentId || ''} loading={priceMutation.isPending} onSubmit={(data) => priceMutation.mutate(data)} />
    </Modal>
  </>;
}

export default function InvestmentHoldings() {
  return <InvestmentWorkspaceFrame>{(props) => <HoldingsContent {...props} />}</InvestmentWorkspaceFrame>;
}
