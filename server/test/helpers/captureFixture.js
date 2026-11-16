import { createHash } from 'node:crypto';
export const HEADER = 'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration';
export function artifact(content, name, representationType, offset = 120) {
  const bytes = Buffer.from(content);
  return { encoding: 'base64', content: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex'), metadata: {
    provider: 'tradovate', environment: 'demo', account: { id: '100', name: 'SYNTHETIC' },
    capturedAt: '2026-11-16T15:00:00.000Z', requestedTimezone: offset ? 'Asia/Jerusalem' : 'UTC', verifiedOffsetMinutes: offset,
    requestedRange: { from: '2026-11-16', to: '2026-11-16', inclusive: true },
    request: { name, representationType, ...(name === 'Performance' ? { template: 'Flex.html' } : {}), timezone: offset,
      params: [{ name: 'account', value: 'SYNTHETIC' }, { name: 'startDate', value: '11/16/2026' }, { name: 'endDate', value: '11/17/2026' }] },
  } };
}
export function fixture() {
  const csv = HEADER + '\n' + [
    'TEST,0,0,0.25,b1,s1,1,90,100,20,11/16/2026 12:01:00,11/16/2026 12:00:00,1min',
    'TEST,0,0,0.25,b2,s1,1,95,100,10,11/16/2026 12:02:00,11/16/2026 12:00:00,2min',
  ].join('\n') + '\n';
  const performance = artifact(csv, 'Performance', 'csv');
  const comparison = artifact(csv.replaceAll(' 12:', ' 10:'), 'Performance', 'csv', 0);
  const metrics = { 'Gross P/L': '$30.00', 'Trade Fees &amp; Comm.': '$(12.00)', 'Total P/L': '$18.00', '# of Trades': '2', '# of Contracts': '4' };
  const html = '<table>' + Object.entries(metrics).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + '</table>';
  let id = 0;
  const cash = ['Account,Transaction ID,Timestamp,Date,Delta,Amount,Cash Change Type,Currency,Contract'];
  for (const time of ['12:00:00', '12:01:00', '12:02:00']) for (const type of ['Exchange Fee', 'Clearing Fee', 'Nfa Fee', 'Commission']) {
    cash.push(`SYNTHETIC,${++id},11/16/2026 ${time},2026-11-16,-1,100,${type},USD,TEST`);
  }
  cash.push(`SYNTHETIC,${++id},11/16/2026 12:01:00,2026-11-16,20,100,Trade Paired,USD,TEST`);
  cash.push(`SYNTHETIC,${++id},11/16/2026 12:02:00,2026-11-16,10,100,Trade Paired,USD,TEST`);
  return { format: 'tradovate-capture', version: 1, performance, timestampEvidence: { method: 'controlled-offset-comparison', comparison },
    financialEvidence: { performanceSha256: performance.sha256, coverage: 'report-calendar-interval', feeAllocation: 'unallocated',
      performanceSummary: artifact(html, 'Performance', 'html'), cashHistory: artifact(cash.join('\n')+'\n', 'Cash History', 'csv') } };
}
