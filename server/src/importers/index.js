import { parseTopstepX } from './topstepxImporter.js';
import { parseTradovate } from './tradovateImporter.js';

/**
 * Registry mapping broker keys to their parse functions.
 * Each function: (csvBuffer: Buffer) => rawRow[]
 */
export const IMPORTERS = {
  topstepx: parseTopstepX,
  tradovate: parseTradovate,
};

export const BROKER_NAMES = {
  topstepx: 'TopstepX',
  tradovate: 'Tradovate',
};

/**
 * Returns the parse function for the given broker key,
 * or throws if the broker is not supported.
 */
export function getImporter(broker) {
  const fn = IMPORTERS[broker];
  if (!fn) {
    const supported = Object.keys(IMPORTERS).join(', ');
    throw new Error(`Unsupported broker "${broker}". Supported: ${supported}`);
  }
  return fn;
}
