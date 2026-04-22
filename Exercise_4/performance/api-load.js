/**
 * k6 Performance Test – REST API Load Test
 * Tests all API endpoints under load with quality targets:
 *   - p95 response time < 500ms
 *   - Error rate < 1%
 *
 * Run:
 *   k6 run Exercise_4/performance/api-load.js
 *   k6 run --env APP_URL=http://api.example.com Exercise_4/performance/api-load.js
 *
 * NOTE: This file uses k6's ES module import syntax – run with k6 binary, not Node.js.
 */

import http  from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────

const errorRate    = new Rate('error_rate');
const authDuration = new Trend('auth_duration', true);
const readDuration = new Trend('read_duration', true);
const writeDuration= new Trend('write_duration', true);

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.APP_URL || 'http://localhost:3000/api/v1';
const VUS      = parseInt(__ENV.VIRTUAL_USERS || '20', 10);

export const options = {
  stages: [
    { duration: '10s', target: VUs },
    { duration: '30s', target: VUs },
    { duration: '10s', target: 0  },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'auth_duration':     ['p(95)<500'],
    'read_duration':     ['p(95)<300'],
    'write_duration':    ['p(95)<500'],
    'error_rate':        ['rate<0.01'],
    'http_req_failed':   ['rate<0.01'],
  },
};

// ── Auth helper ───────────────────────────────────────────────────────────────

function authenticate() {
  const start = Date.now();
  const res   = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email:    __ENV.TEST_EMAIL    || 'test@example.com',
    password: __ENV.TEST_PASSWORD || 'Test1234!',
  }), { headers: { 'Content-Type': 'application/json' } });

  authDuration.add(Date.now() - start);
  try {
    return JSON.parse(res.body).token || null;
  } catch {
    return null;
  }
}

function authHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function () {
  const token = authenticate();

  // ── Users ─────────────────────────────────────────────────────────────────
  group('Users API', () => {
    const start = Date.now();
    const res   = http.get(`${BASE_URL}/users`, { headers: authHeaders(token) });
    readDuration.add(Date.now() - start);

    const ok = check(res, {
      'GET /users status 200':      r => r.status === 200,
      'GET /users within 500ms':    r => r.timings.duration < 500,
      'GET /users returns array':   r => {
        try { return Array.isArray(JSON.parse(r.body)); } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.2);

  // ── Products ──────────────────────────────────────────────────────────────
  group('Products API', () => {
    const listStart = Date.now();
    const listRes   = http.get(`${BASE_URL}/products`, { headers: authHeaders(token) });
    readDuration.add(Date.now() - listStart);

    const listOk = check(listRes, {
      'GET /products status 200':   r => r.status === 200,
      'GET /products within 500ms': r => r.timings.duration < 500,
    });
    errorRate.add(!listOk);

    const createStart = Date.now();
    const createRes   = http.post(`${BASE_URL}/products`, JSON.stringify({
      name:     `Load Test Product ${__VU}-${Date.now()}`,
      price:    9.99,
      category: 'test',
      stock:    100,
    }), { headers: authHeaders(token) });
    writeDuration.add(Date.now() - createStart);

    const createOk = check(createRes, {
      'POST /products status 201':  r => r.status === 201 || r.status === 200,
      'POST /products within 500ms':r => r.timings.duration < 500,
    });
    errorRate.add(!createOk);
  });

  sleep(0.3);

  // ── Orders ────────────────────────────────────────────────────────────────
  group('Orders API', () => {
    const listStart = Date.now();
    const listRes   = http.get(`${BASE_URL}/orders`, { headers: authHeaders(token) });
    readDuration.add(Date.now() - listStart);

    const listOk = check(listRes, {
      'GET /orders status 200':   r => r.status === 200,
      'GET /orders within 500ms': r => r.timings.duration < 500,
    });
    errorRate.add(!listOk);
  });

  sleep(0.2);

  // ── Error handling ────────────────────────────────────────────────────────
  group('Error Handling', () => {
    const notFoundRes = http.get(`${BASE_URL}/products/nonexistent-id-999`, { headers: authHeaders(token) });
    check(notFoundRes, {
      '404 for missing resource':       r => r.status === 404,
      '404 responds within 200ms':      r => r.timings.duration < 200,
    });

    const badReqRes = http.post(`${BASE_URL}/products`, JSON.stringify({ invalid: true }), {
      headers: authHeaders(token),
    });
    check(badReqRes, {
      '400 for invalid payload':        r => r.status === 400 || r.status === 422,
      '400 responds within 200ms':      r => r.timings.duration < 200,
    });
  });

  sleep(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const p95 = data.metrics['http_req_duration']?.values['p(95)'] || 0;
  const errRate = data.metrics['http_req_failed']?.values['rate'] || 0;

  return {
    'Exercise_4/reports/k6-api-summary.json': JSON.stringify({
      timestamp:        new Date().toISOString(),
      p95ResponseTime:  p95,
      errorRate:        errRate,
      qualityTargets: {
        responseTime: { target: 500, actual: p95,          met: p95 < 500 },
        errorRate:    { target: 0.01, actual: errRate,     met: errRate < 0.01 },
      },
    }, null, 2),
    stdout: `
========================================
  k6 API PERFORMANCE SUMMARY
========================================
  p95 Response Time:  ${p95.toFixed(0)}ms (target: <500ms)  ${p95 < 500 ? '✔' : '✘'}
  Error Rate:         ${(errRate * 100).toFixed(2)}% (target: <1%)    ${errRate < 0.01 ? '✔' : '✘'}
========================================
`,
  };
}
