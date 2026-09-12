import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createRequireAuth } from './auth.js';
const userId = '00000000-0000-4000-8000-000000000001';
function res() { return { cookies: [], status(code) { this.statusCode=code; return this; }, json(value) { this.body=value; return this; }, clearCookie(...args) { this.cookies.push(args); } }; }
test('nonexistent-user sessions stop before protected work and clear stale cookie', async () => {
  process.env.JWT_SECRET='tj02-test-secret';
  const middleware=createRequireAuth({ query:async()=>({ rows:[] }) });
  const response=res(); let called=false;
  await middleware({ headers:{ authorization:`Bearer ${jwt.sign({sub:userId},process.env.JWT_SECRET)}` } },response,()=>{ called=true; });
  assert.equal(response.statusCode,401); assert.equal(response.body.error.code,'SESSION_INVALID'); assert.equal(called,false); assert.equal(response.cookies.length,1);
});
test('database failure reaches error handler without clearing a valid session', async () => {
  process.env.JWT_SECRET='tj02-test-secret';
  const failure=Object.assign(new Error('offline'),{ code:'ECONNRESET' });
  const middleware=createRequireAuth({ query:async()=>{ throw failure; } });
  const response=res(); let forwarded;
  await middleware({ headers:{ authorization:`Bearer ${jwt.sign({sub:userId},process.env.JWT_SECRET)}` } },response,error=>{forwarded=error;});
  assert.equal(forwarded,failure); assert.equal(response.cookies.length,0); assert.equal(response.statusCode,undefined);
});
test('malformed signed subject is rejected before querying PostgreSQL', async () => {
  process.env.JWT_SECRET='tj02-test-secret'; let queried=false;
  const middleware=createRequireAuth({ query:async()=>{ queried=true; } });
  const response=res();
  await middleware({headers:{authorization:`Bearer ${jwt.sign({sub:'not-a-uuid'},process.env.JWT_SECRET)}`}},response,()=>assert.fail());
  assert.equal(queried,false);assert.equal(response.statusCode,401);
});
