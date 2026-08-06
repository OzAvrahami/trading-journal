import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/index.js';
import { navigationGroups, mobileMoreItems } from '../layout/navigation.js';
import { PortfolioForm } from './PortfolioForm.jsx';
import { InvestmentInstrumentForm } from './InvestmentInstrumentForm.jsx';
import { PortfolioTransactionForm, normalizePortfolioTransaction } from './PortfolioTransactionForm.jsx';

const portfolio = { id: '11111111-1111-4111-8111-111111111111', baseCurrency: 'USD' };
const instrument = { id: '22222222-2222-4222-8222-222222222222', symbol: 'VOO', name: 'Vanguard ETF', assetType: 'etf' };

describe('Portfolio foundation client contracts', () => {
  it('keeps exact dates and internal transaction keys while normalizing type-specific payloads', () => {
    expect(normalizePortfolioTransaction({ transactionType: 'buy', transactionDate: '2026-08-06', instrumentId: instrument.id, quantity: '1.25', price: '500.50', amount: '999', fees: '2.50', notes: '  monthly buy  ' }, portfolio.id)).toEqual({
      portfolioId: portfolio.id, instrumentId: instrument.id, transactionType: 'buy', transactionDate: '2026-08-06', quantity: 1.25, price: 500.5, amount: null, fees: 2.5, notes: 'monthly buy',
    });
    expect(normalizePortfolioTransaction({ transactionType: 'deposit', transactionDate: '2026-08-06', instrumentId: instrument.id, quantity: '3', price: '4', amount: '1000', fees: '9', notes: '' }, portfolio.id)).toMatchObject({
      instrumentId: null, transactionType: 'deposit', transactionDate: '2026-08-06', quantity: null, price: null, amount: 1000, fees: 0,
    });
    expect(normalizePortfolioTransaction({ transactionType: 'fee', transactionDate: '2026-08-06', instrumentId: instrument.id, amount: '8', fees: '0', notes: '' }, portfolio.id)).toMatchObject({
      instrumentId: instrument.id, transactionType: 'fee', amount: 8, fees: 0,
    });
  });

  it('adapts transaction fields without exposing calculated or tax-lot inputs', async () => {
    render(<PortfolioTransactionForm portfolio={portfolio} instruments={[instrument]} onSubmit={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /Transaction type/i })).toHaveValue('buy');
    expect(screen.getByRole('spinbutton', { name: /Quantity/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/realized/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tax lot/i)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Transaction type/i }), 'dividend');
    expect(screen.getByRole('spinbutton', { name: /Amount/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /Quantity/i })).not.toBeInTheDocument();
  });

  it('normalizes currency and preserves entered values after validation failure', async () => {
    const onSubmit = vi.fn();
    render(<PortfolioForm onSubmit={onSubmit} />);
    const name = screen.getByRole('textbox', { name: /Portfolio name/i });
    const currency = screen.getByRole('textbox', { name: /Base currency/i });
    await userEvent.type(name, '  Retirement  ');
    await userEvent.clear(currency);
    await userEvent.type(currency, 'us');
    await userEvent.click(screen.getByRole('button', { name: /Create portfolio/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(name).toHaveValue('  Retirement  ');
    await userEvent.type(currency, 'd');
    await userEvent.click(screen.getByRole('button', { name: /Create portfolio/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Retirement', baseCurrency: 'USD' }));
  });

  it('normalizes a Stock or ETF identity without translating internal keys', async () => {
    const onSubmit=vi.fn();
    render(<InvestmentInstrumentForm portfolioCurrency="USD" onSubmit={onSubmit}/>);
    await userEvent.type(screen.getByRole('textbox',{name:/Symbol/i}),'voo');
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Asset type/i}),'etf');
    await userEvent.click(screen.getByRole('button',{name:/Create Instrument/i}));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({symbol:'VOO',assetType:'etf',currency:'USD'}));
  });

  it('provides one bilingual Investments destination through mobile More', async () => {
    const group = navigationGroups.find((item) => item.labelKey === 'navigation.investments');
    expect(group.items.map((item) => item.to)).toEqual(['/portfolio']);
    expect(mobileMoreItems.some((item) => item.to === '/portfolio')).toBe(true);
    await i18n.changeLanguage('he');
    expect(i18n.t('navigation.investments')).toBe('השקעות');
    expect(i18n.t('navigation.portfolio')).toBe('תיק השקעות');
    expect(i18n.t('portfolio.transactionTypes.buy')).toBe('קנייה');
  });
});
