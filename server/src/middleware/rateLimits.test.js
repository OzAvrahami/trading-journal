import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { addressKey, clientKey, createRateLimiters, usesRailwayIngress } from './rateLimits.js';

const railway = {
  NODE_ENV: 'production', RAILWAY_PROJECT_ID: 'test-project',
  RAILWAY_ENVIRONMENT_ID: 'test-environment', RAILWAY_SERVICE_ID: 'test-service',
};

async function serve(app, action) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function limitedApp(env, edgeAddress) {
  const app = express();
  if (edgeAddress) {
    // Model the documented edge overwrite. This is NOT a live Railway test.
    app.use((req, _res, next) => { req.headers['x-real-ip'] = edgeAddress; next(); });
  }
  const { globalLimiter, authLimiter } = createRateLimiters(env);
  app.use('/api', globalLimiter);
  app.use('/api/auth', authLimiter);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/probe', (_req, res) => res.sendStatus(401));
  return app;
}

test('canonical IPv4/mapped IPv4 and IPv6 /64 identities; reject non-IP inputs', () => {
  assert.equal(addressKey('::ffff:192.0.2.10'), addressKey('192.0.2.10'));
  assert.equal(addressKey('::ffff:c000:20a'), addressKey('192.0.2.10'));
  assert.equal(addressKey('2001:DB8:0:1::1'), addressKey('2001:db8:0000:0001::ffff'));
  assert.notEqual(addressKey('2001:db8:0:1::1'), addressKey('2001:db8:0:2::1'));
  for (const bad of [undefined, [], 'unknown', '192.0.2.10:1234', '1.2.3.4, 5.6.7.8', 'fe80::1%eth0', '[::1]', ' 1.2.3.4', '0xc000020a']) {
    assert.equal(addressKey(bad), null);
  }
});

test('Railway identity requires production deployment metadata, not request headers', () => {
  assert.equal(usesRailwayIngress(railway), true);
  for (const field of Object.keys(railway)) {
    const env = { ...railway }; delete env[field]; assert.equal(usesRailwayIngress(env), false);
  }
  const req = { socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '198.51.100.1' } };
  assert.equal(clientKey(req, false), 'ipv4:127.0.0.1');
  for (const bad of [undefined, 'bad', ['192.0.2.1', '198.51.100.1'], '192.0.2.1,198.51.100.1']) {
    req.headers['x-real-ip'] = bad; assert.equal(clientKey(req, true), 'ipv4:127.0.0.1');
  }
});

test('original regression: distinct trusted ingress IPv4 clients have independent buckets', async () => {
  await serve(limitedApp(railway), async base => {
    for (const ip of ['192.0.2.1', '198.51.100.1']) {
      const res = await fetch(`${base}/api/health`, { headers: { 'x-real-ip': ip } });
      assert.equal(res.status, 200); assert.equal(res.headers.get('ratelimit-remaining'), '299');
    }
  });
});

test('global limit still allows 300 and rejects 301; forged alternate headers do not reset it', async () => {
  await serve(limitedApp(railway, '192.0.2.1'), async base => {
    for (let i = 0; i < 301; i++) {
      const res = await fetch(`${base}/api/health`, { headers: {
        'x-real-ip': `198.51.100.${i % 250 + 1}`, 'x-forwarded-for': `203.0.113.${i % 250 + 1}`,
        forwarded: `for=203.0.113.${i % 250 + 1}`, 'cf-connecting-ip': `203.0.113.${i % 250 + 1}`,
      } });
      assert.equal(res.status, i < 300 ? 200 : 429);
      if (i === 300) { assert.equal((await res.json()).error.code, 'RATE_LIMIT'); assert.ok(Number(res.headers.get('retry-after')) > 0); }
    }
  });
});

test('auth limit is 20; client B remains independent after client A exhausts it', async () => {
  await serve(limitedApp(railway), async base => {
    for (let i = 0; i < 21; i++) {
      const res = await fetch(`${base}/api/auth/probe`, { method: 'POST', headers: { 'x-real-ip': '192.0.2.2' } });
      assert.equal(res.status, i < 20 ? 401 : 429);
    }
    const other = await fetch(`${base}/api/auth/probe`, { method: 'POST', headers: { 'x-real-ip': '198.51.100.2' } });
    assert.equal(other.status, 401);
  });
});

test('IPv6 spellings and rotating interface IDs cannot evade auth /64 bucket', async () => {
  await serve(limitedApp(railway), async base => {
    for (let i = 0; i < 21; i++) {
      const res = await fetch(`${base}/api/auth/probe`, { method: 'POST', headers: { 'x-real-ip': `2001:db8:0:1::${(i + 1).toString(16)}` } });
      assert.equal(res.status, i < 20 ? 401 : 429);
    }
    const other = await fetch(`${base}/api/auth/probe`, { method: 'POST', headers: { 'x-real-ip': '2001:db8:0:2::1' } });
    assert.equal(other.status, 401);
  });
});

test('non-Railway direct clients cannot rotate any forwarding header to evade auth limit', async () => {
  await serve(limitedApp({ NODE_ENV: 'production' }), async base => {
    for (let i = 0; i < 21; i++) {
      const res = await fetch(`${base}/api/auth/probe`, { method: 'POST', headers: {
        'x-real-ip': `192.0.2.${i + 1}`, 'x-forwarded-for': `192.0.2.${i + 1}`, 'x-railway-edge': 'spoof',
      } });
      assert.equal(res.status, i < 20 ? 401 : 429);
    }
  });
});

test('actual application middleware preserves CORS and production refresh-cookie clearing', async () => {
  const names = [...Object.keys(railway), 'CLIENT_URL'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, railway, { CLIENT_URL: 'https://client.example.test' });
  try {
    const { default: app } = await import('../app.js');
    assert.equal(app.get('trust proxy'), false);
    await serve(app, async base => {
      const headers = { Origin: 'https://client.example.test', 'x-real-ip': '192.0.2.40', 'x-forwarded-proto': 'http' };
      const preflight = await fetch(`${base}/api/auth/refresh`, { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Method': 'POST' } });
      assert.equal(preflight.status, 204);
      for (let i = 0; i < 21; i++) {
        const res = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers });
        assert.equal(res.status, i < 20 ? 401 : 429);
        assert.equal(res.headers.get('access-control-allow-origin'), 'https://client.example.test');
        assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
        if (i < 20) {
          const cookie = res.headers.get('set-cookie');
          for (const value of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/']) assert.ok(cookie.includes(value));
        }
      }
      const other = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { ...headers, 'x-real-ip': '198.51.100.40' } });
      assert.equal(other.status, 401);
    });
  } finally {
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});
