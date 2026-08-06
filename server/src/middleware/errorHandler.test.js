import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorHandler } from './errorHandler.js';

test('oversized multipart uploads return a stable bounded 413 response', () => {
  let statusCode;
  let body;
  const response = {
    status(value) { statusCode = value; return this; },
    json(value) { body = value; return this; },
  };

  errorHandler(Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }), {}, response, () => {});

  assert.equal(statusCode, 413);
  assert.deepEqual(body, {
    error: {
      code: 'IMPORT_FILE_TOO_LARGE',
      message: 'CSV files must be 5 MB or smaller.',
    },
  });
});

test('unexpected errors do not expose their original message', () => {
  let body;
  const response = { status() { return this; }, json(value) { body = value; } };
  const original = console.error;
  let logged;
  console.error = (...args) => { logged = args; };
  try {
    errorHandler(new Error('database host and private path'), { method: 'GET', originalUrl: '/api/private' }, response, () => {});
  } finally {
    console.error = original;
  }
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message, 'An unexpected error occurred.');
  assert.doesNotMatch(JSON.stringify(body), /database host|private path/);
  assert.doesNotMatch(JSON.stringify(logged), /database host|private path/);
});
