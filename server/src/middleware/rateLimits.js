import { isIP } from 'node:net';
import { rateLimit } from 'express-rate-limit';

// Railway HTTP edge overwrites X-Real-IP. Its private project network is part
// of the trusted deployment boundary; do not expose a raw TCP ingress or admit
// untrusted private-network callers. Request headers cannot enable this mode.
export function usesRailwayIngress(env = process.env) {
  return env.NODE_ENV === 'production' &&
    ['RAILWAY_PROJECT_ID', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_SERVICE_ID']
      .every(name => typeof env[name] === 'string' && env[name].length > 0);
}

export function addressKey(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return `ipv4:${value}`;
  // WHATWG URL canonicalizes IPv6 spellings (including embedded IPv4).
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const words = right !== undefined
    ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
    : head;
  const bytes = words.map(word => Number.parseInt(word, 16));
  if (bytes.slice(0, 5).every(word => word === 0) && bytes[5] === 0xffff) {
    return `ipv4:${bytes[6] >> 8}.${bytes[6] & 255}.${bytes[7] >> 8}.${bytes[7] & 255}`;
  }
  // Installed express-rate-limit 7 has no subnet key helper. Aggregate /64
  // explicitly so rotating IPv6 interface identifiers does not reset a bucket.
  return `ipv6:${bytes.slice(0, 4).map(word => word.toString(16)).join(':')}::/64`;
}

export function clientKey(req, railwayIngress) {
  const socketKey = addressKey(req.socket.remoteAddress) || 'unknown-peer';
  if (!railwayIngress) return socketKey; // Ignore every forwarded header locally.
  // Duplicate/list/port/zone/malformed values fail into the bounded peer bucket.
  // Never fall back to X-Forwarded-For, Forwarded or CF-Connecting-IP.
  return addressKey(req.headers['x-real-ip']) || socketKey;
}

export function createRateLimiters(env = process.env) {
  const railwayIngress = usesRailwayIngress(env);
  const keyGenerator = req => clientKey(req, railwayIngress);
  return {
    globalLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      keyGenerator,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later.' } },
    }),
    authLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      keyGenerator,
      message: { error: { code: 'RATE_LIMIT', message: 'Too many auth attempts, please try again later.' } },
    }),
  };
}
