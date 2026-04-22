# Module 8 – Automated Test Suites

Automated test suites for an e-commerce checkout process (Exercise 1) and a REST API (Exercise 2), generated using Cursor AI as part of Module 8.

---

## Project Structure

```
cursorAI-module8-gperez/
├── package.json
├── Exercise_1/
│   ├── tests/
│   │   └── checkout.test.js        # Jest test suite – e-commerce checkout
│   ├── test-cases/
│   │   └── checkout_test_cases.md  # 45 documented test cases
│   └── test-data/
│       ├── testDataFactory.js      # Runtime data factory (users, cards, addresses)
│       └── test_data_strategy.md   # Test data strategy documentation
├── Exercise_2/
│   └── tests/
│       └── api.test.js             # Jest test suite – REST API
└── Prompts/
    └── Generate Test Cases for E-commerce Checkout.md
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

Verify your versions:

```bash
node --version
npm --version
```

---

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd cursorAI-module8-gperez
```

### 2. Install dependencies

```bash
npm install
```

This installs Jest, Axios, and UUID as defined in `package.json`.

---

## Environment Variables

Before running the tests, create a `.env.test` file in the project root. This file is git-ignored and must never be committed.

```bash
# .env.test
BASE_URL=http://localhost:3000/api/v1

# Admin credentials (Exercise 2)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=AdminPass1234!

# Regular user credentials (Exercise 2)
USER_EMAIL=user@example.com
USER_PASSWORD=UserPass1234!

# Database (Exercise 1)
TEST_DB_URL=postgresql://localhost/ecommerce_test

# Payment (use test/sandbox keys only)
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_SANDBOX_TOKEN=...

# Test user password (Exercise 1)
TEST_USER_PASSWORD=Test1234!
```

> **Never use real card numbers or production credentials in tests.**
> Exercise 1 uses Stripe test card numbers (e.g. `4242 4242 4242 4242`) and Exercise 2 uses sandbox tokens.

---

## Running the Tests

### Run all tests (both exercises)

```bash
npm test
```

Tests run serially (`--runInBand`) to prevent shared-state conflicts in Exercise 2.

### Run Exercise 1 only (Checkout)

```bash
npm run test:ex1
```

### Run Exercise 2 only (REST API)

```bash
npm run test:ex2
```

### Run a single test file directly

```bash
npx jest Exercise_1/tests/checkout.test.js
npx jest Exercise_2/tests/api.test.js
```

### Run tests matching a specific name pattern

```bash
# Run only security tests
npx jest --testNamePattern="Security"

# Run only authentication tests
npx jest --testNamePattern="Authentication"

# Run only performance tests
npx jest --testNamePattern="Performance"
```

### Run with verbose output

```bash
npm test -- --verbose
```

### Run with coverage report

```bash
npm test -- --coverage
```

---

## Test Suite Overview

### Exercise 1 – E-Commerce Checkout (`checkout.test.js`)

| Category | Test IDs | Count |
|---|---|---|
| Positive – Cart | TC-P-001 → TC-P-004 | 4 |
| Positive – Discount Codes | TC-P-005 → TC-P-007 | 3 |
| Positive – Payment Processing | TC-P-008 → TC-P-011 | 4 |
| Positive – Order & Email | TC-P-012 → TC-P-015 | 4 |
| Negative – Payment Failures | TC-N-001 → TC-N-004 | 4 |
| Negative – Invalid Codes | TC-N-005 → TC-N-007 | 3 |
| Negative – Form Validation | TC-N-008 → TC-N-010 | 3 |
| Edge Cases | TC-E-001 → TC-E-010 | 6 scripted |
| Security | TC-S-001 → TC-S-010 | 7 scripted |
| **Total** | | **38 scripted / 45 documented** |

### Exercise 2 – REST API (`api.test.js`)

| Category | Test IDs | Count |
|---|---|---|
| Authentication | AUTH-001 → AUTH-007 | 7 |
| Authorization (RBAC) | AUTHZ-001 → AUTHZ-008 | 8 |
| CRUD – User Management | USER-001 → USER-005 | 5 |
| CRUD – Product Catalog | PROD-001 → PROD-005 | 5 |
| CRUD – Orders | ORDER-001 → ORDER-005 | 5 |
| Input Validation | VAL-001 → VAL-006 | 6 |
| Error Handling | ERR-001 → ERR-005 | 5 |
| Performance (< 500ms) | PERF-001 → PERF-005 | 5 |
| Rate Limiting | RATE-001 → RATE-003 | 3 |
| **Total** | | **49** |

---

## Configuration

Jest configuration is defined inside `package.json`:

| Setting | Value | Reason |
|---|---|---|
| `testEnvironment` | `node` | Backend APIs; no browser DOM required |
| `testTimeout` | `15000` ms | Accommodates email delivery simulation in TC-P-014 |
| `--runInBand` | enabled | Ensures serial execution for shared state in Exercise 2 |

---

## Notes

- **Exercise 1** requires a running application backend (`checkoutService`) and a seeded test database. Run `globalSetup.js` to seed products and discount codes before executing the suite.
- **Exercise 2** requires a live REST API server at `BASE_URL`. Start your local server before running tests.
- Email delivery tests (TC-P-014, TC-P-015) use a mock mail service such as [Mailhog](https://github.com/mailhog/MailHog) in local environments.
- Stripe interactions use [Stripe test mode](https://stripe.com/docs/testing) keys only (`sk_test_...`).
