/**
 * k6 Performance Test – E-Commerce Checkout Load Test
 *
 * Tests the checkout flow under various load conditions and validates
 * that the application meets the response-time target: <500ms p95.
 *
 * Run with:
 *   k6 run Exercise_4/performance/checkout-load.js
 *   k6 run --out json=Exercise_4/reports/k6-results.json Exercise_4/performance/checkout-load.js
 *
 * Environment variables (pass via k6 --env flag):
 *   APP_URL          Target base URL   (default: http://localhost:3000)
 *   VIRTUAL_USERS    Number of VUs     (default: 10)
 *   DURATION         Test duration     (default: 30s)
 *   RAMP_UP          Ramp-up period    (default: 10s)
 *
 * NOTE: This file uses k6's ES module syntax (import), not Node.js require().
 *       It is NOT a Node.js script – it must be run with the k6 binary.
 */

import http    from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/grafana/k6-libs/main/k6-summary/dist/index.js';

// ── Custom metrics ─────────────────────────────────────────────────────────────

const errorRate        = new Rate('error_rate');
const checkoutDuration = new Trend('checkout_duration', true);
const cartDuration     = new Trend('cart_duration', true);
const paymentDuration  = new Trend('payment_duration', true);
const orderSuccess     = new Counter('order_success_count');
const orderFailure     = new Counter('order_failure_count');

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL     = __ENV.APP_URL       || 'http://localhost:3000';
const VUS          = parseInt(__ENV.VIRTUAL_USERS || '10', 10);
const DURATION     = __ENV.DURATION      || '30s';
const RAMP_UP      = __ENV.RAMP_UP       || '10s';

export const options = {
  stages: [
    { duration: RAMP_UP,   target: VUs },     // Ramp up
    { duration: DURATION,  target: VUs },     // Steady state
    { duration: '10s',     target: 0 },       // Ramp down
  ],
  thresholds: {
    // Quality target: p95 response time < 500ms
    'http_req_duration':              ['p(95)<500'],
    'checkout_duration':              ['p(95)<500'],
    'cart_duration':                  ['p(95)<500'],
    'payment_duration':               ['p(95)<500'],
    // Error rate target: < 1%
    'error_rate':                     ['rate<0.01'],
    // 99% of requests must complete successfully
    'http_req_failed':                ['rate<0.01'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ── Test data helpers ─────────────────────────────────────────────────────────

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PRODUCTS = ['PROD-001', 'PROD-002', 'PROD-003', 'PROD-004'];
const DISCOUNT_CODES = ['SAVE10', 'SUMMER20', ''];  // empty = no discount

const VALID_CARD = {
  number:  '4242424242424242',
  expiry:  '12/28',
  cvv:     '123',
};

const SHIPPING_ADDRESSES = [
  { firstName: 'Alice', lastName: 'Smith',  email: 'alice@test.com', address: '100 Main St', city: 'Austin',   state: 'TX', zip: '78701', country: 'US' },
  { firstName: 'Bob',   lastName: 'Jones',  email: 'bob@test.com',   address: '200 Oak Ave', city: 'Seattle',  state: 'WA', zip: '98101', country: 'US' },
  { firstName: 'Carol', lastName: 'Taylor', email: 'carol@test.com', address: '300 Elm Rd',  city: 'New York', state: 'NY', zip: '10001', country: 'US' },
];

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept':       'application/json',
};

// ── Scenario helpers ──────────────────────────────────────────────────────────

function addToCart(sessionToken, productId, quantity = 1) {
  const start = Date.now();
  const res   = http.post(
    `${BASE_URL}/api/cart/items`,
    JSON.stringify({ productId, quantity }),
    { headers: { ...HEADERS, 'Authorization': `Bearer ${sessionToken}` } },
  );
  cartDuration.add(Date.now() - start);
  return res;
}

function applyDiscount(sessionToken, code) {
  return http.post(
    `${BASE_URL}/api/cart/discount`,
    JSON.stringify({ code }),
    { headers: { ...HEADERS, 'Authorization': `Bearer ${sessionToken}` } },
  );
}

function processPayment(sessionToken, shipping, card) {
  const start = Date.now();
  const res   = http.post(
    `${BASE_URL}/api/checkout/payment`,
    JSON.stringify({ shipping, card }),
    { headers: { ...HEADERS, 'Authorization': `Bearer ${sessionToken}` } },
  );
  paymentDuration.add(Date.now() - start);
  return res;
}

function placeOrder(sessionToken) {
  const start = Date.now();
  const res   = http.post(
    `${BASE_URL}/api/checkout/order`,
    '{}',
    { headers: { ...HEADERS, 'Authorization': `Bearer ${sessionToken}` } },
  );
  checkoutDuration.add(Date.now() - start);
  return res;
}

function getCart(sessionToken) {
  return http.get(
    `${BASE_URL}/api/cart`,
    { headers: { ...HEADERS, 'Authorization': `Bearer ${sessionToken}` } },
  );
}

function createGuestSession() {
  const res = http.post(
    `${BASE_URL}/api/auth/guest`,
    '{}',
    { headers: HEADERS },
  );
  try {
    return JSON.parse(res.body).sessionToken || `guest-${__VU}-${Date.now()}`;
  } catch {
    return `guest-${__VU}-${Date.now()}`;
  }
}

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function () {
  const sessionToken = createGuestSession();
  const product      = randomItem(PRODUCTS);
  const discountCode = randomItem(DISCOUNT_CODES);
  const shipping     = randomItem(SHIPPING_ADDRESSES);

  // ── Group 1: Browse and add to cart ────────────────────────────────────────
  group('Browse and Add to Cart', () => {
    const homeRes = http.get(`${BASE_URL}/`, { headers: HEADERS });
    const homeOk  = check(homeRes, {
      'Home page status 200':           r => r.status === 200,
      'Home page responds within 500ms': r => r.timings.duration < 500,
    });
    errorRate.add(!homeOk);

    sleep(0.5);

    const cartRes = addToCart(sessionToken, product);
    const cartOk  = check(cartRes, {
      'Add to cart status 200/201':      r => r.status === 200 || r.status === 201,
      'Add to cart within 500ms':        r => r.timings.duration < 500,
      'Cart response has item':          r => {
        try { return !!JSON.parse(r.body).success; } catch { return false; }
      },
    });
    errorRate.add(!cartOk);
  });

  sleep(0.3);

  // ── Group 2: View and update cart ──────────────────────────────────────────
  group('View Cart', () => {
    const viewRes = getCart(sessionToken);
    const viewOk  = check(viewRes, {
      'Get cart status 200':            r => r.status === 200,
      'Get cart within 500ms':          r => r.timings.duration < 500,
    });
    errorRate.add(!viewOk);

    if (discountCode) {
      const discountRes = applyDiscount(sessionToken, discountCode);
      check(discountRes, {
        'Discount applied or rejected gracefully': r => r.status === 200 || r.status === 400,
        'Discount response within 500ms':          r => r.timings.duration < 500,
      });
    }
  });

  sleep(0.5);

  // ── Group 3: Checkout ──────────────────────────────────────────────────────
  group('Checkout', () => {
    const payRes = processPayment(sessionToken, shipping, VALID_CARD);
    const payOk  = check(payRes, {
      'Payment response 200/202':      r => r.status === 200 || r.status === 202,
      'Payment within 500ms':          r => r.timings.duration < 500,
    });
    errorRate.add(!payOk);

    if (payOk) {
      const orderRes = placeOrder(sessionToken);
      const orderOk  = check(orderRes, {
        'Order placed 200/201':          r => r.status === 200 || r.status === 201,
        'Order response within 500ms':   r => r.timings.duration < 500,
        'Order has confirmation number': r => {
          try { return !!JSON.parse(r.body).orderNumber; } catch { return false; }
        },
      });
      errorRate.add(!orderOk);
      if (orderOk) orderSuccess.add(1);
      else         orderFailure.add(1);
    }
  });

  sleep(1);
}

// ── Smoke test scenario (1 VU, quick validation) ──────────────────────────────

export function smokeTest() {
  const res = http.get(BASE_URL);
  check(res, {
    'Smoke: status is 200':       r => r.status === 200,
    'Smoke: response under 500ms':r => r.timings.duration < 500,
  });
}

// ── Spike test scenario ───────────────────────────────────────────────────────

export const spikeOptions = {
  stages: [
    { duration: '5s',  target: 1   },
    { duration: '5s',  target: 50  },   // sudden spike
    { duration: '10s', target: 50  },
    { duration: '5s',  target: 1   },   // recovery
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],  // relaxed for spike
    'error_rate':        ['rate<0.05'],
  },
};

// ── Summary report ────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const thresholdsPassed = Object.values(data.metrics)
    .every(m => !m.thresholds || Object.values(m.thresholds).every(t => !t.ok === false));

  return {
    'Exercise_4/reports/k6-summary.html': htmlReport(data),
    'Exercise_4/reports/k6-summary.json': JSON.stringify({
      timestamp:         new Date().toISOString(),
      thresholdsPassed,
      responseTimeP95:   data.metrics['http_req_duration']?.values['p(95)'],
      errorRate:         data.metrics['http_req_failed']?.values['rate'],
      checkoutDurationP95: data.metrics['checkout_duration']?.values['p(95)'],
      vus:               data.metrics['vus']?.values['max'],
      iterations:        data.metrics['iterations']?.values['count'],
      qualityTargets: {
        responseTimeTarget: 500,
        errorRateTarget:    0.01,
        met: (data.metrics['http_req_duration']?.values['p(95)'] || 0) < 500
          && (data.metrics['http_req_failed']?.values['rate'] || 0) < 0.01,
      },
    }, null, 2),
    stdout: `
========================================
  k6 PERFORMANCE TEST SUMMARY
========================================
  p95 Response Time:  ${(data.metrics['http_req_duration']?.values['p(95)'] || 0).toFixed(0)}ms  (target: <500ms)
  Error Rate:         ${((data.metrics['http_req_failed']?.values['rate'] || 0) * 100).toFixed(2)}%  (target: <1%)
  VUs:                ${data.metrics['vus']?.values['max'] || 0}
  Iterations:         ${data.metrics['iterations']?.values['count'] || 0}
========================================
`,
  };
}
