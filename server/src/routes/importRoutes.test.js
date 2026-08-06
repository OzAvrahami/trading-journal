import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  MAX_PARSE_SESSIONS_PER_USER,
  MAX_PARSE_SESSIONS_TOTAL,
  clearParseSessions,
  getSession,
  storeSession,
} from './importRoutes.js';

afterEach(() => clearParseSessions());

test('parsed imports are bounded per user and remain user-isolated', () => {
  for (let index = 0; index <= MAX_PARSE_SESSIONS_PER_USER; index += 1) {
    storeSession('owner-a', `session-${index}`, { index });
  }
  storeSession('owner-b', 'private', { owner: 'b' });

  assert.equal(getSession('owner-a', 'session-0'), null);
  assert.equal(getSession('owner-a', `session-${MAX_PARSE_SESSIONS_PER_USER}`).index, MAX_PARSE_SESSIONS_PER_USER);
  assert.equal(getSession('owner-a', 'private'), null);
  assert.deepEqual(getSession('owner-b', 'private'), { owner: 'b' });
});

test('parsed imports have a global memory bound with oldest-session eviction', () => {
  for (let index = 0; index <= MAX_PARSE_SESSIONS_TOTAL; index += 1) {
    storeSession(`owner-${index}`, `session-${index}`, { index });
  }

  assert.equal(getSession('owner-0', 'session-0'), null);
  assert.equal(getSession(`owner-${MAX_PARSE_SESSIONS_TOTAL}`, `session-${MAX_PARSE_SESSIONS_TOTAL}`).index, MAX_PARSE_SESSIONS_TOTAL);
});
