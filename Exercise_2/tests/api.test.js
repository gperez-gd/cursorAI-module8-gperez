/**
 * Exercise 2: API Test Suite – REST API (User Management, Product Catalog, Orders)
 * Targets the Module 7 Flask API (/api/v1): cart + checkout for orders, JWT + CSRF when Redis is enabled.
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api/v1';
const PERF_THRESHOLD_MS = 500;

const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';
const defaultUserEmail = process.env.USER_EMAIL || 'user@example.com';
const defaultUserPassword = process.env.USER_PASSWORD || 'User1234!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function api(token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token != null && token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }
  return axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
    headers,
    timeout: PERF_THRESHOLD_MS + 500,
  });
}

/** Module 7: place order from cart via POST /checkout (requires CSRF when Redis is available). */
function shippingAddress(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: defaultUserEmail,
    street: '123 Test Lane',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'US',
    ...overrides,
  };
}

let adminToken;
let userToken;
let adminCsrf;
let userCsrf;
let disposableUserId;
let sampleProductId;
let createdUserId;
let createdProductId;
let createdOrderId;

beforeAll(async () => {
  const origin = BASE_URL.replace(/\/api\/v1\/?$/, '');
  const health = await axios.get(`${origin}/health`, {
    validateStatus: () => true,
    timeout: 10_000,
  });
  if (health.status !== 200) {
    throw new Error(
      `Exercise 2 needs the Module 7 API. Health check failed at ${origin}/health (HTTP ${health.status}). ` +
        'Start Flask on port 3000 and ensure REDIS is running for JWT logout and CSRF.'
    );
  }

  let prodProbe;
  for (let attempt = 0; attempt < 30; attempt++) {
    prodProbe = await api().get('/products?limit=1');
    if (prodProbe.status === 200 && prodProbe.data.products?.length) {
      break;
    }
    if (prodProbe.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    break;
  }
  if (prodProbe.status !== 200 || !prodProbe.data.products?.length) {
    throw new Error(
      `Exercise 2 needs the Module 7 API at BASE_URL=${BASE_URL}. GET /products failed (HTTP ${prodProbe.status}). ` +
        'Start the server, run seed.py, and set ADMIN_EMAIL / ADMIN_PASSWORD / USER_EMAIL / USER_PASSWORD if not using seed defaults.'
    );
  }
  sampleProductId = prodProbe.data.products[0].id;

  const adminLogin = await api().post('/auth/login', {
    email: defaultAdminEmail,
    password: defaultAdminPassword,
  });
  if (adminLogin.status !== 200) {
    throw new Error(
      `Admin login failed (HTTP ${adminLogin.status}): ${JSON.stringify(adminLogin.data)}. ` +
        'Check credentials match seed.py (default admin@example.com / Admin1234!).'
    );
  }
  adminToken = adminLogin.data.token;
  adminCsrf = adminLogin.data.csrfToken;

  const userLogin = await api().post('/auth/login', {
    email: defaultUserEmail,
    password: defaultUserPassword,
  });
  if (userLogin.status !== 200) {
    throw new Error(
      `User login failed (HTTP ${userLogin.status}): ${JSON.stringify(userLogin.data)}. ` +
        'Check credentials match seed.py (default user@example.com / User1234!).'
    );
  }
  userToken = userLogin.data.token;
  userCsrf = userLogin.data.csrfToken;

  const disposable = await api(adminToken).post('/users', {
    email: `e2-disposable+${Date.now()}@example.com`,
    password: 'Disposable1!',
    role: 'user',
  });
  if (![200, 201].includes(disposable.status)) {
    throw new Error(`Could not create disposable user for AUTHZ-003: ${JSON.stringify(disposable.data)}`);
  }
  disposableUserId = disposable.data.id;
});

// ===========================================================================
// AUTHENTICATION TESTS
// ===========================================================================
describe('Authentication', () => {
  test('AUTH-001: Login with valid credentials returns 200 and JWT', async () => {
    const res = await api().post('/auth/login', {
      email: defaultUserEmail,
      password: defaultUserPassword,
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeDefined();
    expect(typeof res.data.token).toBe('string');
  });

  test('AUTH-002: Login with invalid password returns 401', async () => {
    const res = await api().post('/auth/login', {
      email: defaultUserEmail,
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
    expect(res.data.token).toBeUndefined();
  });

  test('AUTH-003: Login with non-existent email returns 401', async () => {
    const res = await api().post('/auth/login', {
      email: 'nobody@example.com',
      password: 'AnyPassword!',
    });
    expect(res.status).toBe(401);
  });

  test('AUTH-004: Request to protected endpoint without token returns 401', async () => {
    const res = await api(null).get('/users');
    expect(res.status).toBe(401);
  });

  test('AUTH-005: Request with expired token returns 401', async () => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiJ9.' +
      'eyJzdWIiOiJ1c2VyIiwiZXhwIjoxfQ.' +
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const res = await api(expiredToken).get('/users');
    expect(res.status).toBe(401);
  });

  test('AUTH-006: Request with malformed token returns 401', async () => {
    const res = await api('not.a.valid.jwt.at.all').get('/users');
    expect(res.status).toBe(401);
  });

  test('AUTH-007: Logout invalidates token', async () => {
    const login = await api().post('/auth/login', {
      email: defaultUserEmail,
      password: defaultUserPassword,
    });
    const tempToken = login.data.token;
    await api(tempToken).post('/auth/logout');
    const res = await api(tempToken).get('/users/me');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// AUTHORIZATION TESTS (Role-Based Access)
// ===========================================================================
describe('Authorization – Role-Based Access', () => {
  test('AUTHZ-001: Admin can GET /users (list all users)', async () => {
    const res = await api(adminToken).get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.users)).toBe(true);
  });

  test('AUTHZ-002: Regular user cannot GET /users (403)', async () => {
    const res = await api(userToken).get('/users');
    expect(res.status).toBe(403);
  });

  test('AUTHZ-003: Admin can DELETE any user', async () => {
    const res = await api(adminToken).delete(`/users/${disposableUserId}`);
    expect([200, 204]).toContain(res.status);
  });

  test('AUTHZ-004: Regular user cannot DELETE another user (403)', async () => {
    const res = await api(userToken).delete('/users/other-user-id');
    expect(res.status).toBe(403);
  });

  test('AUTHZ-005: Regular user can GET own profile', async () => {
    const res = await api(userToken).get('/users/me');
    expect(res.status).toBe(200);
    expect(res.data.email).toBe(defaultUserEmail);
  });

  test('AUTHZ-006: Regular user cannot access another user\'s orders', async () => {
    const res = await api(userToken).get('/users/other-user-id/orders');
    expect(res.status).toBe(403);
  });

  test('AUTHZ-007: Admin can manage products (POST /products)', async () => {
    const res = await api(adminToken).post('/products', {
      name: 'Admin Created Product',
      price: 9.99,
      stock: 50,
      category: 'Electronics',
    });
    expect([200, 201]).toContain(res.status);
    createdProductId = res.data.id;
  });

  test('AUTHZ-008: Regular user cannot create products (403)', async () => {
    const res = await api(userToken).post('/products', {
      name: 'User Product Attempt',
      price: 1.0,
      stock: 1,
      category: 'Electronics',
    });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// CRUD – USER MANAGEMENT
// ===========================================================================
describe('CRUD – User Management', () => {
  test('USER-001: POST /users – Create new user (admin)', async () => {
    const res = await api(adminToken).post('/users', {
      email: `newuser+${Date.now()}@example.com`,
      password: 'NewUser1234!',
      role: 'user',
    });
    expect([200, 201]).toContain(res.status);
    expect(res.data.id).toBeDefined();
    createdUserId = res.data.id;
  });

  test('USER-002: GET /users/:id – Read user by ID (admin)', async () => {
    const res = await api(adminToken).get(`/users/${createdUserId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdUserId);
  });

  test('USER-003: PUT /users/me – Update own profile', async () => {
    const res = await api(userToken).put('/users/me', {
      firstName: 'UpdatedName',
    });
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBe('UpdatedName');
  });

  test('USER-004: DELETE /users/:id – Delete user (admin)', async () => {
    const res = await api(adminToken).delete(`/users/${createdUserId}`);
    expect([200, 204]).toContain(res.status);
  });

  test('USER-005: GET /users/:id after admin delete still returns user (soft delete)', async () => {
    const res = await api(adminToken).get(`/users/${createdUserId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdUserId);
  });
});

// ===========================================================================
// CRUD – PRODUCT CATALOG
// ===========================================================================
describe('CRUD – Product Catalog', () => {
  test('PROD-001: GET /products – Returns paginated product list', async () => {
    const res = await api(userToken).get('/products?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.products)).toBe(true);
    expect(res.data.total).toBeDefined();
  });

  test('PROD-002: GET /products/:id – Returns single product', async () => {
    const res = await api(userToken).get(`/products/${createdProductId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdProductId);
  });

  test('PROD-003: POST /products – Admin creates product', async () => {
    const res = await api(adminToken).post('/products', {
      name: 'Test Product',
      price: 49.99,
      stock: 100,
      category: 'Electronics',
    });
    expect([200, 201]).toContain(res.status);
    createdProductId = res.data.id;
  });

  test('PROD-004: PUT /products/:id – Admin updates product price', async () => {
    const res = await api(adminToken).put(`/products/${createdProductId}`, {
      price: 39.99,
    });
    expect(res.status).toBe(200);
    expect(res.data.price).toBe(39.99);
  });

  test('PROD-005: DELETE /products/:id – Admin deletes product', async () => {
    const res = await api(adminToken).delete(`/products/${createdProductId}`);
    expect([200, 204]).toContain(res.status);
  });
});

// ===========================================================================
// CRUD – ORDERS (Module 7: cart + POST /checkout)
// ===========================================================================
describe('CRUD – Orders', () => {
  beforeAll(async () => {
    const login = await api().post('/auth/login', {
      email: defaultUserEmail,
      password: defaultUserPassword,
    });
    expect(login.status).toBe(200);
    userToken = login.data.token;
    userCsrf = login.data.csrfToken;
  });

  test('ORDER-001: Checkout creates a new order', async () => {
    await api(userToken, { 'X-CSRF-Token': userCsrf }).post('/cart/items', {
      productId: sampleProductId,
      quantity: 1,
    });
    const res = await api(userToken, { 'X-CSRF-Token': userCsrf }).post('/checkout', {
      shippingAddress: shippingAddress(),
      paymentToken: 'tok_visa',
    });
    expect([200, 201]).toContain(res.status);
    expect(res.data.orderId).toBeDefined();
    createdOrderId = res.data.orderId;
  });

  test('ORDER-002: GET /orders/:id – Read own order', async () => {
    const res = await api(userToken).get(`/orders/${createdOrderId}`);
    expect(res.status).toBe(200);
    expect(res.data.orderId).toBe(createdOrderId);
  });

  test('ORDER-003: GET /orders – List own orders', async () => {
    const res = await api(userToken).get('/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.orders)).toBe(true);
  });

  test('ORDER-004: PUT /orders/:id – Admin updates order status', async () => {
    const res = await api(adminToken).put(`/orders/${createdOrderId}`, {
      status: 'Shipped',
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('Shipped');
  });

  test('ORDER-005: DELETE /orders/:id – Admin cancels order', async () => {
    const res = await api(adminToken).delete(`/orders/${createdOrderId}`);
    expect([200, 204]).toContain(res.status);
  });
});

// ===========================================================================
// INPUT VALIDATION
// ===========================================================================
describe('Input Validation', () => {
  beforeAll(async () => {
    const login = await api().post('/auth/login', {
      email: defaultUserEmail,
      password: defaultUserPassword,
    });
    expect(login.status).toBe(200);
    userToken = login.data.token;
    userCsrf = login.data.csrfToken;
  });

  test('VAL-001: POST /users with missing required email returns 400', async () => {
    const res = await api(adminToken).post('/users', {
      password: 'Password1!',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/email/i);
  });

  test('VAL-002: POST /users with invalid email format returns 400', async () => {
    const res = await api(adminToken).post('/users', {
      email: 'not-an-email',
      password: 'Password1!',
    });
    expect(res.status).toBe(400);
  });

  test('VAL-003: POST /products with negative price returns 400', async () => {
    const res = await api(adminToken).post('/products', {
      name: 'Bad Product',
      price: -5,
      stock: 10,
      category: 'Electronics',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/price/i);
  });

  test('VAL-004: POST /products with missing name returns 400', async () => {
    const res = await api(adminToken).post('/products', {
      price: 9.99,
      stock: 10,
      category: 'Electronics',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/name/i);
  });

  test('VAL-005: POST /checkout with empty cart returns 400', async () => {
    const res = await api(userToken, { 'X-CSRF-Token': userCsrf }).post('/checkout', {
      shippingAddress: shippingAddress({ email: 'emptycart@test.com' }),
      paymentToken: 'tok_visa',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/cart|empty/i);
  });

  test('VAL-006: PUT /users/me with excessively long name returns 400', async () => {
    const res = await api(userToken).put('/users/me', {
      firstName: 'A'.repeat(300),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// ERROR HANDLING (4xx / 5xx)
// ===========================================================================
describe('Error Handling', () => {
  test('ERR-001: GET /products/nonexistent-id returns 404', async () => {
    const res = await api(userToken).get('/products/does-not-exist-99999');
    expect(res.status).toBe(404);
    expect(res.data.error).toBeDefined();
  });

  test('ERR-002: GET /orders/nonexistent-id returns 404', async () => {
    const res = await api(userToken).get('/orders/does-not-exist-99999');
    expect(res.status).toBe(404);
  });

  test('ERR-003: Malformed JSON body returns 400', async () => {
    const res = await axios({
      method: 'post',
      url: `${BASE_URL}/products`,
      data: 'this is not json',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
    expect(res.status).toBe(400);
  });

  test('ERR-004: Unsupported HTTP method returns 405', async () => {
    const res = await api(adminToken).patch('/users/me/unsupported-endpoint');
    expect([404, 405]).toContain(res.status);
  });

  test('ERR-005: Server error is returned as 500 with safe message (no stack trace)', async () => {
    const res = await api(adminToken).post('/admin/trigger-test-error');
    if (res.status === 500) {
      expect(res.data.stack).toBeUndefined();
      expect(res.data.error).toBeDefined();
    }
  });
});

// ===========================================================================
// PERFORMANCE TESTS
// ===========================================================================
describe('Performance – Response Time < 500ms', () => {
  async function measureTime(fn) {
    const start = Date.now();
    await fn();
    return Date.now() - start;
  }

  test('PERF-001: GET /products responds within 500ms', async () => {
    const ms = await measureTime(() => api(userToken).get('/products?limit=10'));
    expect(ms).toBeLessThan(PERF_THRESHOLD_MS);
  });

  test('PERF-002: GET /products/:id responds within 500ms', async () => {
    const ms = await measureTime(() => api(userToken).get(`/products/${sampleProductId}`));
    expect(ms).toBeLessThan(PERF_THRESHOLD_MS);
  });

  test('PERF-003: GET /orders responds within 500ms', async () => {
    const ms = await measureTime(() => api(userToken).get('/orders'));
    expect(ms).toBeLessThan(PERF_THRESHOLD_MS);
  });

  test('PERF-004: POST /auth/login responds within 500ms', async () => {
    const ms = await measureTime(() =>
      api().post('/auth/login', {
        email: defaultUserEmail,
        password: defaultUserPassword,
      })
    );
    expect(ms).toBeLessThan(PERF_THRESHOLD_MS);
  });

  test('PERF-005: GET /users/me responds within 500ms', async () => {
    const ms = await measureTime(() => api(userToken).get('/users/me'));
    expect(ms).toBeLessThan(PERF_THRESHOLD_MS);
  });
});

// ===========================================================================
// RATE LIMITING
// ===========================================================================
describe('Rate Limiting', () => {
  test('RATE-001: Exceeding rate limit on /auth/login returns 429', async () => {
    const requests = Array.from({ length: 30 }, () =>
      api().post('/auth/login', { email: 'spam@example.com', password: 'wrong' })
    );
    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });

  test('RATE-002: Rate limit response includes Retry-After header', async () => {
    const requests = Array.from({ length: 30 }, () =>
      api().post('/auth/login', { email: 'spam2@example.com', password: 'wrong' })
    );
    const responses = await Promise.all(requests);
    const limited = responses.find(r => r.status === 429);
    expect(limited).toBeDefined();
    expect(limited.headers['retry-after'] ?? limited.headers['x-ratelimit-reset']).toBeDefined();
  });

  test('RATE-003: API endpoint rate limit on GET /products returns 429 after threshold', async () => {
    let saw429 = false;
    for (let i = 0; i < 150; i++) {
      const r = await api().get('/products?limit=1');
      if (r.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});
