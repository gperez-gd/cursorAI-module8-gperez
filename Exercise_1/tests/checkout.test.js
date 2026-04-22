/**
 * E-Commerce Checkout – Automated Test Suite (Jest)
 * Covers: Cart, Discount Codes, Payment Processing, Order Confirmation, Email Notifications
 * Categories: Positive, Negative, Edge Cases, Security
 */

const {
  addToCart,
  updateCartQuantity,
  removeFromCart,
  getCart,
  applyDiscountCode,
  removeDiscountCode,
  processPayment,
  placeOrder,
  getOrder,
  getOrderHistory,
  getEmailsSentTo,
} = require('../src/checkoutService');

const { generateCard, generateAddress, generateUser } = require('../test-data/testDataFactory');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_VISA      = { number: '4242424242424242', expiry: '12/28', cvv: '123' };
const DECLINED_CARD   = { number: '4000000000009995', expiry: '12/28', cvv: '123' };
const EXPIRED_CARD    = { number: '4242424242424242', expiry: '01/20', cvv: '123' };
const LOST_CARD       = { number: '4000000000009979', expiry: '12/28', cvv: '123' };
const WRONG_CVV_CARD  = { number: '4242424242424242', expiry: '12/28', cvv: '000' };

let testUser;
let sessionToken;

beforeEach(async () => {
  testUser = await generateUser();
  sessionToken = testUser.sessionToken;
});

afterEach(async () => {
  // Clear cart between tests
  const cart = await getCart(sessionToken);
  for (const item of cart.items) {
    await removeFromCart(sessionToken, item.id);
  }
});

// ===========================================================================
// POSITIVE SCENARIOS
// ===========================================================================
describe('Positive Scenarios – Cart', () => {
  test('TC-P-001: Add single in-stock item to cart', async () => {
    const result = await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    expect(result.success).toBe(true);
    const cart = await getCart(sessionToken);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('PROD-001');
    expect(cart.items[0].quantity).toBe(1);
  });

  test('TC-P-002: Add multiple different items to cart', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    await addToCart(sessionToken, { productId: 'PROD-002', quantity: 1 });
    const cart = await getCart(sessionToken);
    expect(cart.items).toHaveLength(2);
    expect(cart.subtotal).toBeGreaterThan(0);
  });

  test('TC-P-003: Increase item quantity in cart', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const cart = await getCart(sessionToken);
    const itemId = cart.items[0].id;
    await updateCartQuantity(sessionToken, itemId, 3);
    const updated = await getCart(sessionToken);
    expect(updated.items[0].quantity).toBe(3);
  });

  test('TC-P-004: Remove item from cart', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    await addToCart(sessionToken, { productId: 'PROD-002', quantity: 1 });
    const cart = await getCart(sessionToken);
    const itemAId = cart.items.find(i => i.productId === 'PROD-001').id;
    await removeFromCart(sessionToken, itemAId);
    const updated = await getCart(sessionToken);
    expect(updated.items.map(i => i.productId)).not.toContain('PROD-001');
    expect(updated.items).toHaveLength(1);
  });
});

describe('Positive Scenarios – Discount Codes', () => {
  beforeEach(async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 2 });
  });

  test('TC-P-005: Apply valid percentage discount code (SAVE10)', async () => {
    const cartBefore = await getCart(sessionToken);
    const result = await applyDiscountCode(sessionToken, 'SAVE10');
    expect(result.success).toBe(true);
    const cartAfter = await getCart(sessionToken);
    expect(cartAfter.total).toBeCloseTo(cartBefore.subtotal * 0.9, 2);
    expect(cartAfter.discountApplied).toBe('SAVE10');
  });

  test('TC-P-006: Apply valid fixed-amount discount code (FLAT5)', async () => {
    const cartBefore = await getCart(sessionToken);
    const result = await applyDiscountCode(sessionToken, 'FLAT5');
    expect(result.success).toBe(true);
    const cartAfter = await getCart(sessionToken);
    expect(cartAfter.total).toBeCloseTo(cartBefore.subtotal - 5, 2);
  });

  test('TC-P-007: Remove applied discount code', async () => {
    await applyDiscountCode(sessionToken, 'SAVE10');
    const cartWithDiscount = await getCart(sessionToken);
    await removeDiscountCode(sessionToken);
    const cartWithout = await getCart(sessionToken);
    expect(cartWithout.total).toBeGreaterThan(cartWithDiscount.total);
    expect(cartWithout.discountApplied).toBeNull();
  });
});

describe('Positive Scenarios – Payment Processing', () => {
  const address = generateAddress();

  beforeEach(async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
  });

  test('TC-P-008: Complete checkout with valid Visa', async () => {
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: address,
    });
    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
  });

  test('TC-P-009: Complete checkout with valid Mastercard', async () => {
    const mastercard = { number: '5555555555554444', expiry: '12/28', cvv: '123' };
    const result = await processPayment(sessionToken, {
      card: mastercard,
      shippingAddress: address,
    });
    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
  });

  test('TC-P-010: Complete checkout with PayPal', async () => {
    const result = await processPayment(sessionToken, {
      method: 'paypal',
      paypalToken: testUser.paypalToken,
      shippingAddress: address,
    });
    expect(result.success).toBe(true);
  });

  test('TC-P-011: Complete checkout with saved card on file', async () => {
    const result = await processPayment(sessionToken, {
      savedCardId: testUser.savedCardId,
      shippingAddress: address,
    });
    expect(result.success).toBe(true);
  });
});

describe('Positive Scenarios – Order Confirmation & Email', () => {
  const address = generateAddress();

  test('TC-P-012: Order confirmation page data is correct', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const payment = await processPayment(sessionToken, { card: VALID_VISA, shippingAddress: address });
    const order = await getOrder(payment.orderId);
    expect(order.orderId).toBe(payment.orderId);
    expect(order.items).toHaveLength(1);
    expect(order.total).toBeGreaterThan(0);
    expect(order.estimatedDelivery).toBeDefined();
  });

  test('TC-P-013: Order appears in order history after checkout', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const payment = await processPayment(sessionToken, { card: VALID_VISA, shippingAddress: address });
    const history = await getOrderHistory(sessionToken);
    const ids = history.map(o => o.orderId);
    expect(ids).toContain(payment.orderId);
  });

  test('TC-P-014: Order confirmation email sent within 2 minutes', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    await processPayment(sessionToken, { card: VALID_VISA, shippingAddress: address });
    // Allow up to 2 minutes for email delivery in integration environment
    await new Promise(r => setTimeout(r, 5000));
    const emails = await getEmailsSentTo(testUser.email);
    const confirmEmail = emails.find(e => e.subject.includes('Order Confirmation'));
    expect(confirmEmail).toBeDefined();
    expect(confirmEmail.body).toMatch(/order/i);
  });

  test('TC-P-015: Shipping notification email contains tracking number', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const payment = await processPayment(sessionToken, { card: VALID_VISA, shippingAddress: address });
    // Simulate order status change to Shipped
    await placeOrder(payment.orderId, { status: 'Shipped', trackingNumber: 'TRK123456' });
    const emails = await getEmailsSentTo(testUser.email);
    const shippingEmail = emails.find(e => e.subject.includes('Shipped'));
    expect(shippingEmail).toBeDefined();
    expect(shippingEmail.body).toContain('TRK123456');
  });
});

// ===========================================================================
// NEGATIVE SCENARIOS
// ===========================================================================
describe('Negative Scenarios – Payment Failures', () => {
  const address = generateAddress();

  beforeEach(async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
  });

  test('TC-N-001: Payment declined – insufficient funds', async () => {
    const result = await processPayment(sessionToken, { card: DECLINED_CARD, shippingAddress: address });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient funds/i);
    const history = await getOrderHistory(sessionToken);
    expect(history).toHaveLength(0);
  });

  test('TC-N-002: Payment declined – expired card', async () => {
    const result = await processPayment(sessionToken, { card: EXPIRED_CARD, shippingAddress: address });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  test('TC-N-003: Payment declined – incorrect CVV', async () => {
    const result = await processPayment(sessionToken, { card: WRONG_CVV_CARD, shippingAddress: address });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/security code/i);
  });

  test('TC-N-004: Payment declined – lost or stolen card', async () => {
    const result = await processPayment(sessionToken, { card: LOST_CARD, shippingAddress: address });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/declined/i);
  });
});

describe('Negative Scenarios – Invalid Discount Codes', () => {
  beforeEach(async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
  });

  test('TC-N-005: Apply expired discount code', async () => {
    const result = await applyDiscountCode(sessionToken, 'SUMMER21');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  test('TC-N-006: Apply non-existent discount code', async () => {
    const result = await applyDiscountCode(sessionToken, 'FAKE99');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  test('TC-N-007: Apply already-used single-use discount code', async () => {
    // NEWUSER is a single-use code, pre-marked as used for this test user
    const result = await applyDiscountCode(sessionToken, 'NEWUSER');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already been used/i);
  });
});

describe('Negative Scenarios – Form Validation', () => {
  test('TC-N-008: Submit checkout with missing shipping address', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/shipping address.*required/i);
  });

  test('TC-N-009: Submit payment with blank card number', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: { number: '', expiry: '12/28', cvv: '123' },
      shippingAddress: generateAddress(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/card number.*required/i);
  });

  test('TC-N-010: Enter non-numeric characters in card number', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: { number: 'ABCD EFGH IJKL MNOP', expiry: '12/28', cvv: '123' },
      shippingAddress: generateAddress(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid card number/i);
  });
});

// ===========================================================================
// EDGE CASES
// ===========================================================================
describe('Edge Cases', () => {
  test('TC-E-001: Checkout with empty cart is blocked', async () => {
    const cart = await getCart(sessionToken);
    expect(cart.items).toHaveLength(0);
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cart is empty/i);
  });

  test('TC-E-002: Item out-of-stock between add-to-cart and payment', async () => {
    await addToCart(sessionToken, { productId: 'PROD-OUT-OF-STOCK', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer available/i);
  });

  test('TC-E-003: Discount exceeding order total results in $0 charge', async () => {
    await addToCart(sessionToken, { productId: 'PROD-CHEAP', quantity: 1 }); // $5 item
    await applyDiscountCode(sessionToken, 'TWENTY_OFF'); // $20 off
    const cart = await getCart(sessionToken);
    expect(cart.total).toBe(0);
  });

  test('TC-E-004: Cart quantity limit enforced at 10 units', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const cart = await getCart(sessionToken);
    const itemId = cart.items[0].id;
    const result = await updateCartQuantity(sessionToken, itemId, 11);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum quantity/i);
  });

  test('TC-E-008: Free checkout ($0 after discount) completes without card', async () => {
    await addToCart(sessionToken, { productId: 'PROD-CHEAP', quantity: 1 });
    await applyDiscountCode(sessionToken, 'TWENTY_OFF');
    const result = await processPayment(sessionToken, {
      shippingAddress: generateAddress(),
    });
    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
  });

  test('TC-E-010: Browser back after payment does not re-submit order', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const firstPayment = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
    });
    // Simulate duplicate submission with same idempotency key
    const secondAttempt = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
      idempotencyKey: firstPayment.idempotencyKey,
    });
    expect(secondAttempt.orderId).toBe(firstPayment.orderId);
    const history = await getOrderHistory(sessionToken);
    const ids = history.map(o => o.orderId);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(history.length); // no duplicates
  });
});

// ===========================================================================
// SECURITY TEST CASES
// ===========================================================================
describe('Security Tests', () => {
  test('TC-S-001: SQL injection in discount code field is neutralized', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const maliciousCode = "'; DROP TABLE orders;--";
    const result = await applyDiscountCode(sessionToken, maliciousCode);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
    // Verify orders table still exists
    const history = await getOrderHistory(sessionToken);
    expect(Array.isArray(history)).toBe(true);
  });

  test('TC-S-002: SQL injection in address field stored as literal string', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const maliciousAddress = generateAddress({ street: "1' OR '1'='1" });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: maliciousAddress,
    });
    const order = await getOrder(result.orderId);
    expect(order.shippingAddress.street).toBe("1' OR '1'='1"); // stored literally
  });

  test('TC-S-003: XSS in name/address fields is escaped', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const xssAddress = generateAddress({ firstName: "<script>alert('xss')</script>" });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: xssAddress,
    });
    const order = await getOrder(result.orderId);
    // The stored value should be escaped
    expect(order.shippingAddress.firstName).not.toContain('<script>');
  });

  test('TC-S-004: PCI-DSS – Card number not stored in plaintext', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const payment = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
    });
    const order = await getOrder(payment.orderId);
    // Payment details should only have a token, not the raw card number
    expect(order.paymentMethod.cardNumber).toBeUndefined();
    expect(order.paymentMethod.token).toBeDefined();
    expect(order.paymentMethod.last4).toBe('4242');
  });

  test('TC-S-005: PCI-DSS – CVV is never persisted', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const payment = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
    });
    const order = await getOrder(payment.orderId);
    expect(order.paymentMethod.cvv).toBeUndefined();
  });

  test('TC-S-007: CSRF token required on order submission', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
      csrfToken: 'INVALID_CSRF_TOKEN',
    });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  test('TC-S-010: Negative price manipulation via tampered request is rejected', async () => {
    await addToCart(sessionToken, { productId: 'PROD-001', quantity: 1 });
    const result = await processPayment(sessionToken, {
      card: VALID_VISA,
      shippingAddress: generateAddress(),
      tamperedTotal: -1,
    });
    // Server must use its own calculated price, not the client-submitted one
    expect(result.success).toBe(true);
    const order = await getOrder(result.orderId);
    expect(order.total).toBeGreaterThan(0);
  });
});
