import test from 'node:test';
import assert from 'node:assert/strict';
import { call } from './helpers.js';

test('CORS on responses: allowed origin echoed, also on errors; foreign none; cached body is origin-free', async () => {
  const ok = (await call('/v1/profiles/Some_Name', { headers: { Origin: 'capacitor://localhost' } })).res;
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
  assert.equal(ok.headers.get('Vary'), 'Origin');
  const err = (await call('/v1/profiles/ab', { headers: { Origin: 'http://localhost:5173' } })).res;
  assert.equal(err.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  const foreign = (await call('/v1/profiles/Some_Name', { headers: { Origin: 'https://evil.example' } })).res;
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(foreign.headers.get('Vary'), 'Origin');
});
