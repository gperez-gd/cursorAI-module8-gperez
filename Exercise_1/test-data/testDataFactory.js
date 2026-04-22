/**
 * Test Data Factory – E-Commerce Checkout
 * Generates isolated, realistic test data for each test run.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Creates a unique test user with a session token.
 * Each call produces an independent user to avoid cross-test contamination.
 * @returns {Promise<object>} user object with sessionToken, email, savedCardId, paypalToken
 */
async function generateUser() {
  const id = uuidv4();
  const email = `test+${id}@example.com`;
  // In a real environment these would call internal test APIs or seed the DB directly
  return {
    id,
    email,
    password: process.env.TEST_USER_PASSWORD ?? 'Test1234!',
    sessionToken: `mock-session-${id}`,
    savedCardId: `card_test_${id.slice(0, 8)}`,
    paypalToken: `paypal_sandbox_${id.slice(0, 8)}`,
  };
}

/**
 * Generates a US shipping address, with optional field overrides for edge/security tests.
 * @param {object} overrides - Fields to override (e.g. { street: "SQL_INJECTION_PAYLOAD" })
 * @returns {object} address object
 */
function generateAddress(overrides = {}) {
  return {
    firstName: overrides.firstName ?? 'Jane',
    lastName:  overrides.lastName  ?? 'Doe',
    street:    overrides.street    ?? '123 Test Lane',
    city:      overrides.city      ?? 'Springfield',
    state:     overrides.state     ?? 'IL',
    zip:       overrides.zip       ?? '62701',
    country:   overrides.country   ?? 'US',
  };
}

/**
 * Returns a Stripe test card object.
 * @param {'visa'|'mastercard'|'declined'|'expired'|'lost'|'wrongCvv'} type
 * @returns {object} card object
 */
function generateCard(type = 'visa') {
  const cards = {
    visa:       { number: '4242424242424242', expiry: '12/28', cvv: '123' },
    mastercard: { number: '5555555555554444', expiry: '12/28', cvv: '123' },
    declined:   { number: '4000000000009995', expiry: '12/28', cvv: '123' },
    expired:    { number: '4242424242424242', expiry: '01/20', cvv: '123' },
    lost:       { number: '4000000000009979', expiry: '12/28', cvv: '123' },
    wrongCvv:   { number: '4242424242424242', expiry: '12/28', cvv: '000' },
  };
  return cards[type] ?? cards.visa;
}

/**
 * Known discount codes seeded in the test database.
 */
const DISCOUNT_CODES = {
  valid: {
    SAVE10:     { type: 'percentage', value: 10, status: 'active' },
    FLAT5:      { type: 'fixed',      value: 5,  status: 'active' },
    TWENTY_OFF: { type: 'fixed',      value: 20, status: 'active' },
  },
  invalid: {
    SUMMER21:   { type: 'percentage', value: 20, status: 'expired' },
    FAKE99:     null,
    NEWUSER:    { type: 'fixed', value: 10, status: 'used' },
  },
};

/**
 * Known products seeded in the test database.
 */
const PRODUCTS = {
  'PROD-001':           { name: 'Test Widget A',    price: 25.00, stock: 100 },
  'PROD-002':           { name: 'Test Widget B',    price: 15.00, stock: 50  },
  'PROD-CHEAP':         { name: 'Mini Item',         price: 5.00,  stock: 200 },
  'PROD-OUT-OF-STOCK':  { name: 'Unavailable Item',  price: 30.00, stock: 0   },
  'PROD-LAST-ONE':      { name: 'Limited Edition',   price: 99.00, stock: 1   },
};

/**
 * Security / malicious payloads for injection and XSS testing.
 */
const SECURITY_PAYLOADS = {
  sqlInjection:     "'; DROP TABLE orders;--",
  sqlInjection2:    "1' OR '1'='1",
  xssScript:        "<script>alert('xss')</script>",
  xssImg:           "<img src=x onerror=alert(1)>",
  csrfToken:        'INVALID_CSRF_TOKEN',
  negativePrice:    -1,
};

module.exports = {
  generateUser,
  generateAddress,
  generateCard,
  DISCOUNT_CODES,
  PRODUCTS,
  SECURITY_PAYLOADS,
};
