import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/index.js';

vi.mock('../../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { defaults: { market: 'stocks', timeframe: '5m' } } }) }));

import { TradeForm } from './TradeForm.jsx';

const accounts = [
  { id: 'a1', company: 'Broker', accountNumber: '100', accountName: 'Main', status: 'active' },
  { id: 'a2', company: 'Broker', accountNumber: '200', accountName: 'Old', status: 'inactive' },
];
const managedStrategies = [
  { id: 's1', name: 'Opening Range Breakout', isActive: true },
  { id: 's2', name: 'Mean Reversion', isActive: true },
  { id: 's3', name: 'Archived Momentum', isActive: false },
];
const managedSetups = [
  { id: 'u1', strategyId: 's1', name: 'Confirmed breakout', isActive: true },
  { id: 'u2', strategyId: 's2', name: 'Range fade', isActive: true },
  { id: 'u3', strategyId: 's3', name: 'Archived continuation', isActive: false },
];

const validOpen = {
  accountId: 'a1', symbol: 'MNQ', market: 'futures', direction: 'long', status: 'open',
  entryDatetime: '2026-08-04T10:00', exitDatetime: '', entryPrice: 22000, exitPrice: '', quantity: 1, fees: 0,
  strategy: '', setup: '', strategyId: '', setupId: '', timeframe: '5m', riskAmount: '', stopLoss: '', takeProfit: '',
  notes: '', emotionPre: '', emotionDuring: '', emotionPost: '', screenshotLinks: '',
};

function renderForm(props = {}) {
  return render(<TradeForm accounts={accounts} timezone="Asia/Jerusalem" onSubmit={vi.fn()} {...props} />);
}

describe('TradeForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the core responsive form with associated labels and no calculated inputs', () => {
    renderForm();
    expect(screen.getByLabelText(/Account/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Symbol/)).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('group', { name: 'Form detail' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Net PnL/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^R$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('preserves advanced values while switching presentation modes', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    await userEvent.type(screen.getByLabelText('Risk amount'), '125');
    await userEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.queryByLabelText('Risk amount')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByLabelText('Risk amount')).toHaveValue(125);
    expect(localStorage.getItem('trading-log.trade-form.mode')).toBe('advanced');
  });

  it('validates required fields and associates errors with their controls', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save Trade' }));
    expect(await screen.findByText('Select an account.')).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText(/Account/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows exit fields only for closed trades without saving on status change', async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    expect(screen.queryByLabelText(/Exit date and time/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Status/), 'closed');
    expect(screen.getByLabelText(/Exit date and time/)).toHaveAttribute('dir', 'ltr');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the canonical create payload through the shared form boundary', async () => {
    const onSubmit = vi.fn();
    renderForm({
      onSubmit,
      defaultValues: {
        accountId: 'a1', symbol: 'mnq', market: 'futures', direction: 'long', status: 'closed',
        entryDatetime: '2026-08-04T10:00', exitDatetime: '2026-08-04T11:00', entryPrice: 22000, exitPrice: 22010,
        quantity: 2, fees: 4, strategy: '', setup: '', timeframe: '5m', riskAmount: '', stopLoss: '', takeProfit: '',
        notes: '', emotionPre: '', emotionDuring: '', emotionPost: '', screenshotLinks: '',
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save Trade' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'a1', symbol: 'MNQ', market: 'futures', direction: 'long',
      entryDatetime: '2026-08-04T07:00:00.000Z', exitDatetime: '2026-08-04T08:00:00.000Z',
      entryPrice: 22000, exitPrice: 22010, quantity: 2, fees: 4,
    }), 'save', expect.any(Object));
  });

  it('keeps an inactive current account visible and immutable in edit mode', () => {
    renderForm({
      isEdit: true,
      defaultValues: { accountId: 'a2', symbol: 'NQ', market: 'futures', direction: 'short', status: 'open', entryDatetime: '2026-08-04T10:00', entryPrice: 22000, quantity: 1, fees: 0 },
    });
    expect(screen.getByLabelText(/Account/)).toHaveValue('a2');
    expect(screen.getByLabelText(/Account/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save and add another' })).not.toBeInTheDocument();
  });

  it('keeps entered values while switching locale and renders natural Hebrew labels', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Symbol/), 'NQ');
    await i18n.changeLanguage('he');
    expect(await screen.findByRole('button', { name: 'שמירת העסקה' })).toBeInTheDocument();
    expect(screen.getByLabelText(/סימול/)).toHaveValue('NQ');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('selects owned managed classification, filters Setups, and submits IDs with current-name snapshots', async () => {
    const onSubmit = vi.fn();
    renderForm({ defaultValues: validOpen, managedStrategies, managedSetups, onSubmit });
    await userEvent.selectOptions(screen.getByLabelText('Managed Strategy'), 's1');
    expect(screen.getByLabelText('Managed Setup')).toHaveValue('');
    expect(withinOptions(screen.getByLabelText('Managed Setup'))).toEqual(['', 'u1']);
    await userEvent.selectOptions(screen.getByLabelText('Managed Setup'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Trade' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      strategyId: 's1', setupId: 'u1', strategy: 'Opening Range Breakout', setup: 'Confirmed breakout',
    }), 'save', expect.any(Object));
  });

  it('does not auto-match legacy text and clears an incompatible managed Setup when Strategy changes', async () => {
    const legacy = { ...validOpen, strategy: 'Opening Range Breakout', setup: 'Confirmed breakout' };
    const view = renderForm({ defaultValues: legacy, managedStrategies, managedSetups });
    expect(screen.getByLabelText('Managed Strategy')).toHaveValue('');
    expect(screen.getByLabelText('Strategy')).toHaveValue('Opening Range Breakout');
    view.unmount();

    renderForm({
      defaultValues: { ...validOpen, strategyId: 's1', setupId: 'u1', strategy: 'Opening Range Breakout', setup: 'Confirmed breakout' },
      managedStrategies,
      managedSetups,
    });
    await userEvent.selectOptions(screen.getByLabelText('Managed Strategy'), 's2');
    expect(screen.getByLabelText('Managed Setup')).toHaveValue('');
    expect(screen.getByLabelText('Setup')).toHaveValue('');
  });

  it('preserves archived managed links during edit without offering unrelated archived values', () => {
    renderForm({
      isEdit: true,
      defaultValues: { ...validOpen, strategyId: 's3', setupId: 'u3', strategy: 'Archived Momentum', setup: 'Archived continuation' },
      managedStrategies,
      managedSetups,
    });
    const strategy = screen.getByLabelText('Managed Strategy');
    const setup = screen.getByLabelText('Managed Setup');
    expect(strategy).toHaveValue('s3');
    expect(setup).toHaveValue('u3');
    expect(withinOptions(strategy)).toEqual(['', 's1', 's2', 's3']);
    expect(withinOptions(setup)).toEqual(['', 'u3']);
  });
});

function withinOptions(select) {
  return Array.from(select.options, (option) => option.value);
}
