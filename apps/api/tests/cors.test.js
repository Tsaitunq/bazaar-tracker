import test from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders } from '../src/cors.js';

test('allowed origins are echoed', () => {
  for (const o of ['https://localhost', 'capacitor://localhost', 'http://localhost', 'http://localhost:5173']) {
    const h = corsHeaders(o);
    assert.equal(h['Access-Control-Allow-Origin'], o);
    assert.equal(h.Vary, 'Origin');
  }
});

test('everything else gets no allow-origin', () => {
  for (const o of [null, '', 'https://tsaitunq.github.io', 'http://localhost.evil.com', 'http://localhost:99999x', 'https://localhost:8080', 'null']) {
    const h = corsHeaders(o);
    assert.equal(h['Access-Control-Allow-Origin'], undefined, String(o));
    assert.equal(h.Vary, 'Origin');
  }
});
