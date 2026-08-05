import { currentLocalDateTime, instantToLocalDateTime, localDateTimeToInstant } from '../../utils/zonedDateTime.js';

export const TRADE_FORM_MODE_KEY = 'trading-log.trade-form.mode';
export const MARKETS = ['stocks', 'crypto', 'futures', 'forex'];
export const DIRECTIONS = ['long', 'short'];
export const TIMEFRAMES = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'];

const optionalNumbers = ['exitPrice', 'riskAmount', 'stopLoss', 'takeProfit'];
const mutableFields = ['exitDatetime', 'exitPrice', 'quantity', 'fees', 'strategy', 'setup', 'strategyId', 'setupId', 'timeframe', 'riskAmount', 'stopLoss', 'takeProfit', 'notes', 'emotions', 'screenshotLinks'];

function text(value) { return typeof value === 'string' ? value : ''; }
function optionalText(value) { const next = text(value).trim(); return next || null; }
function numeric(value) { return value === '' || value == null ? null : Number(value); }

export function createTradeFormValues({ user, timezone, accountId = '' } = {}) {
  return {
    accountId,
    symbol: '',
    market: user?.defaults?.market || 'stocks',
    direction: 'long',
    status: 'open',
    entryDatetime: currentLocalDateTime(timezone),
    exitDatetime: '',
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    fees: '0',
    strategy: '',
    setup: '',
    strategyId: '',
    setupId: '',
    timeframe: user?.defaults?.timeframe || '5m',
    riskAmount: '',
    stopLoss: '',
    takeProfit: '',
    notes: '',
    emotionPre: '',
    emotionDuring: '',
    emotionPost: '',
    screenshotLinks: '',
  };
}

export function mapTradeToFormValues(trade, timezone) {
  const emotions = trade?.emotions && typeof trade.emotions === 'object' && !Array.isArray(trade.emotions) ? trade.emotions : {};
  return {
    accountId: trade?.accountId || '', symbol: text(trade?.symbol), market: trade?.market || 'stocks',
    direction: trade?.direction || 'long', status: trade?.status || (trade?.exitDatetime ? 'closed' : 'open'),
    entryDatetime: instantToLocalDateTime(trade?.entryDatetime, timezone),
    exitDatetime: instantToLocalDateTime(trade?.exitDatetime, timezone),
    entryPrice: trade?.entryPrice ?? '', exitPrice: trade?.exitPrice ?? '', quantity: trade?.quantity ?? '', fees: trade?.fees ?? 0,
    strategy: text(trade?.strategy), setup: text(trade?.setup), strategyId: trade?.strategyId || '', setupId: trade?.setupId || '', timeframe: text(trade?.timeframe),
    riskAmount: trade?.riskAmount ?? '', stopLoss: trade?.stopLoss ?? '', takeProfit: trade?.takeProfit ?? '', notes: text(trade?.notes),
    emotionPre: text(emotions.pre), emotionDuring: text(emotions.during), emotionPost: text(emotions.post),
    screenshotLinks: Array.isArray(trade?.screenshotLinks) ? trade.screenshotLinks.join('\n') : '',
  };
}

export function validateTradeForm(values, { timezone, isEdit = false, t = (key) => key } = {}) {
  const errors = {};
  if (!isEdit && !text(values.accountId).trim()) errors.accountId = t('trades.validation.accountRequired');
  if (!text(values.symbol).trim()) errors.symbol = t('trades.validation.symbolRequired');
  if (!MARKETS.includes(values.market)) errors.market = t('trades.validation.marketRequired');
  if (!DIRECTIONS.includes(values.direction)) errors.direction = t('trades.validation.directionRequired');
  if (!localDateTimeToInstant(values.entryDatetime, timezone)) errors.entryDatetime = t('trades.validation.entryRequired');
  if (!(numeric(values.entryPrice) > 0)) errors.entryPrice = t('trades.validation.positiveNumber');
  if (!(numeric(values.quantity) > 0)) errors.quantity = t('trades.validation.positiveNumber');
  if (numeric(values.fees) == null || numeric(values.fees) < 0) errors.fees = t('trades.validation.nonnegativeNumber');

  optionalNumbers.forEach((field) => {
    if (values[field] !== '' && values[field] != null && !(numeric(values[field]) > 0)) errors[field] = t('trades.validation.positiveNumber');
  });

  if (values.status === 'closed') {
    const entry = localDateTimeToInstant(values.entryDatetime, timezone);
    const exit = localDateTimeToInstant(values.exitDatetime, timezone);
    if (!exit) errors.exitDatetime = t('trades.validation.closedExitRequired');
    if (!(numeric(values.exitPrice) > 0)) errors.exitPrice = t('trades.validation.closedExitPriceRequired');
    if (entry && exit && new Date(exit) < new Date(entry)) errors.exitDatetime = t('trades.validation.exitBeforeEntry');
  }
  if (values.setupId && !values.strategyId) errors.setupId = t('trades.validation.setupRequiresStrategy');

  const links = text(values.screenshotLinks).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (links.length > 10) errors.screenshotLinks = t('trades.validation.screenshotLimit');
  else if (links.some((link) => { try { const url = new URL(link); return !['http:', 'https:'].includes(url.protocol); } catch { return true; } })) {
    errors.screenshotLinks = t('trades.validation.screenshotUrl');
  }
  return errors;
}

export function normalizeTradePayload(values, { timezone, isEdit = false } = {}) {
  const emotions = {
    pre: optionalText(values.emotionPre), during: optionalText(values.emotionDuring), post: optionalText(values.emotionPost),
  };
  Object.keys(emotions).forEach((key) => { if (emotions[key] == null) delete emotions[key]; });
  const links = [...new Set(text(values.screenshotLinks).split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
  const payload = {
    accountId: text(values.accountId).trim(), symbol: text(values.symbol).trim().toUpperCase(), market: values.market,
    direction: values.direction, entryDatetime: localDateTimeToInstant(values.entryDatetime, timezone),
    entryPrice: numeric(values.entryPrice), quantity: numeric(values.quantity), fees: numeric(values.fees) ?? 0,
    exitDatetime: values.status === 'closed' ? localDateTimeToInstant(values.exitDatetime, timezone) : null,
    exitPrice: values.status === 'closed' ? numeric(values.exitPrice) : null,
    strategy: optionalText(values.strategy), setup: optionalText(values.setup), strategyId: optionalText(values.strategyId), setupId: optionalText(values.setupId), timeframe: optionalText(values.timeframe),
    riskAmount: numeric(values.riskAmount), stopLoss: numeric(values.stopLoss), takeProfit: numeric(values.takeProfit), notes: optionalText(values.notes),
    emotions: Object.keys(emotions).length ? emotions : null, screenshotLinks: links.length ? links : null,
  };
  if (!isEdit) return payload;
  return Object.fromEntries(mutableFields.map((key) => [key, payload[key]]));
}

export function accountDisplayLabel(account) {
  const isolatedNumber = account?.accountNumber ? `\u2066${account.accountNumber}\u2069` : '';
  const identity = [account?.company, isolatedNumber].filter(Boolean).join(' — ');
  return account?.accountName ? `${account.accountName} · ${identity}` : identity;
}
