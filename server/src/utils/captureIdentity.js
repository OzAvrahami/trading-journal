import { createHash } from 'node:crypto';
export const identityHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const pairIdentity = member => JSON.stringify([member.buyFillId, member.sellFillId]);
export const groupIdentity = row => identityHash([row.symbol, row.direction,
  row.direction === 'short' ? row._sourceMembers[0].sellFillId : row._sourceMembers[0].buyFillId]);
export const captureDedupKey = (source, row) => identityHash(['capture-v1', source.provider,
  source.environment, source.account.id, groupIdentity(row)]);
