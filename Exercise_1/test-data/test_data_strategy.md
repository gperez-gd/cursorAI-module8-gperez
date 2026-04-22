# Test Data Generation Strategy – E-Commerce Checkout

## 1. Goals

- Provide **realistic, isolated, reproducible** test data for every test run.
- Ensure **no cross-test contamination** (each test gets a fresh user, cart, and order space).
- Cover all **boundary values**, **equivalence partitions**, and **special characters** needed for
  security testing.
- Keep **sensitive data (card numbers, CVV) ephemeral** — never committed to source control.

---

## 2. Data Categories & Sources

### 2.1 Users

| Field | Strategy | Example |
|---|---|---|
| `userId` | UUID v4 generated at test runtime | `f47ac10b-58cc-...` |
| `email` | `test+{uuid}@example.com` pattern | `test+f47ac@example.com` |
| `password` | Fixed strong password from secrets manager | `$Test1234!` |
| `savedCardId` | Seeded in test DB with Stripe test token | `card_1ABC...` |
| `paypalToken` | PayPal sandbox credential from env var | `PAYPAL_SANDBOX_TOKEN` |

**Factory function:**
```js
// test-data/testDataFactory.js
const { v4: uuidv4 } = require('uuid');

async function generateUser() {
  const id = uuidv4();
  const email = `test+${id}@example.com`;
  // Create user via API or seed DB
  const user = await createUserInDB({ id, email, password: process.env.TEST_USER_PASSWORD });
  return { ...user, sessionToken: await loginUser(email) };
}
```

### 2.2 Products

| Scenario | ProductId | Description | Price | Stock |
|---|---|---|---|---|
| Standard in-stock | `PROD-001` | "Test Widget A" | $25.00 | 100 |
| Second item | `PROD-002` | "Test Widget B" | $15.00 | 50 |
| Cheap item (for discount edge case) | `PROD-CHEAP` | "Mini Item" | $5.00 | 200 |
| Out-of-stock | `PROD-OUT-OF-STOCK` | "Unavailable Item" | $30.00 | 0 |
| High-demand (concurrency) | `PROD-LAST-ONE` | "Limited Edition" | $99.00 | 1 |

Products are seeded once per test suite in `globalSetup.js` and cleaned up in `globalTeardown.js`.

### 2.3 Discount Codes

| Code | Type | Value | Status | Notes |
|---|---|---|---|---|
| `SAVE10` | Percentage | 10% | Active | General use |
| `FLAT5` | Fixed amount | $5.00 | Active | General use |
| `TWENTY_OFF` | Fixed amount | $20.00 | Active | Exceeds cheap item price |
| `SUMMER21` | Percentage | 20% | Expired (2021-09-01) | Negative test |
| `FAKE99` | — | — | Does not exist | Negative test |
| `NEWUSER` | Fixed amount | $10.00 | Single-use (used) | Pre-marked as used for test user |

Codes are seeded in `globalSetup.js`.

### 2.4 Payment Cards (Stripe Test Mode)

| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Visa – Successful payment |
| `5555 5555 5555 4444` | Mastercard – Successful payment |
| `4000 0000 0000 9995` | Decline: Insufficient funds |
| `4000 0000 0000 9979` | Decline: Lost/stolen card |
| `4242 4242 4242 4242` (exp 01/20) | Decline: Expired card |
| `4242 4242 4242 4242` (cvv 000) | Decline: Incorrect CVV |

**Never use real card numbers in tests.** Use only Stripe/payment-processor test card numbers.

### 2.5 Addresses

```js
function generateAddress(overrides = {}) {
  return {
    firstName:  overrides.firstName  ?? 'Jane',
    lastName:   overrides.lastName   ?? 'Doe',
    street:     overrides.street     ?? '123 Test Lane',
    city:       overrides.city       ?? 'Springfield',
    state:      overrides.state      ?? 'IL',
    zip:        overrides.zip        ?? '62701',
    country:    overrides.country    ?? 'US',
  };
}
```

Override individual fields to test edge cases (e.g., SQL injection, XSS).

---

## 3. Data Isolation Strategy

### 3.1 Per-Test User Accounts
Each test creates a unique user via `generateUser()` using a UUID-based email. This ensures:
- Cart contents, orders, and discount usage do not bleed between tests.
- Parallel test runs do not conflict.

### 3.2 Database Seeding & Teardown
```
globalSetup.js    →  Seed products, discount codes once before all tests
beforeEach()      →  Create fresh user, clear cart
afterEach()       →  Delete orders created by test user; clear cart
globalTeardown.js →  Remove seeded products, discount codes
```

### 3.3 Environment Configuration
```
TEST_DB_URL=postgresql://localhost/ecommerce_test
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_SANDBOX_TOKEN=...
TEST_USER_PASSWORD=...
BASE_URL=http://localhost:3000
```

Store in `.env.test` (git-ignored). Never commit secrets.

---

## 4. Boundary Value Analysis

| Field | Min | Max | Boundary Values to Test |
|---|---|---|---|
| Cart item quantity | 1 | 10 | 1, 10, 11 (reject), 0 (reject) |
| Discount code length | 1 | 20 chars | 1, 20, 21 (reject), 0 (reject) |
| Card number length | 16 digits | 19 digits | 15 (reject), 16 (accept), 20 (reject) |
| CVV length | 3 digits | 4 digits (Amex) | 2 (reject), 3, 4, 5 (reject) |
| Email length | 5 | 254 chars | 5, 254, 255 (reject) |
| Shipping zip (US) | 5 digits | 10 chars (zip+4) | 4 (reject), 5, 10, 11 (reject) |

---

## 5. Equivalence Partitioning

### Payment Method
- **Valid partitions:** Visa, Mastercard, Amex, PayPal, Saved Card
- **Invalid partitions:** Empty, non-numeric string, expired, wrong CVV, declined

### Discount Code
- **Valid:** Active percentage, active fixed amount
- **Invalid:** Expired, non-existent, already used, wrong format

---

## 6. Security Test Data

| Payload | Target Field | Purpose |
|---|---|---|
| `'; DROP TABLE orders;--` | Discount code | SQL injection |
| `1' OR '1'='1` | Street address | SQL injection |
| `<script>alert('xss')</script>` | First name | XSS |
| `INVALID_CSRF_TOKEN` | CSRF token header | CSRF bypass attempt |
| `-1` | Tampered total in request body | Negative price manipulation |

---

## 7. Test Data File Structure

```
Exercise_1/
  test-data/
    test_data_strategy.md       ← This document
    testDataFactory.js          ← Runtime factory functions
    seeds/
      products.json             ← Static product seed data
      discountCodes.json        ← Static discount code seed data
    fixtures/
      validOrder.json           ← Example of a well-formed order payload
      invalidPayloads.json      ← Collection of malformed/malicious inputs
```

---

## 8. Continuous Integration Notes

- Run tests against a **dedicated test database** (never staging or production).
- Use **Stripe test mode** keys only (key prefix `sk_test_`).
- Set `NODE_ENV=test` to enable test-specific middleware (e.g., disable rate limiting).
- Mock email delivery with **nodemailer-mock** or a dedicated test inbox service (Mailhog).
- Seed and teardown run as part of the Jest `globalSetup`/`globalTeardown` hooks.
