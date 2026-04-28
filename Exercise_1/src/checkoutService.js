/**
 * In-memory checkout service for Exercise 1 Jest tests.
 * Implements cart, discounts, payment simulation, orders, and email stubs.
 */

const crypto = require('crypto');
const { PRODUCTS, DISCOUNT_CODES } = require('../test-data/testDataFactory');

const carts = new Map();
const orders = new Map();
const orderHistoryBySession = new Map();
const emailsByAddress = new Map();
const idempotencyToOrderId = new Map();

function getCartState(sessionToken) {
  if (!carts.has(sessionToken)) {
    carts.set(sessionToken, { items: [], discountApplied: null });
  }
  return carts.get(sessionToken);
}

function sessionUuid(sessionToken) {
  const m = /^mock-session-(.+)$/.exec(sessionToken);
  return m ? m[1] : '';
}

function expectedPaypalToken(sessionToken) {
  const id = sessionUuid(sessionToken);
  return id ? `paypal_sandbox_${id.slice(0, 8)}` : '';
}

function expectedSavedCardId(sessionToken) {
  const id = sessionUuid(sessionToken);
  return id ? `card_test_${id.slice(0, 8)}` : '';
}

function computeLineSubtotal(items) {
  return items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

function applyDiscountToSubtotal(subtotal, discountCode) {
  if (!discountCode) return { discount: 0, total: subtotal };
  const valid = DISCOUNT_CODES.valid[discountCode];
  if (!valid) return { discount: 0, total: subtotal };
  if (valid.type === 'percentage') {
    const discount = (subtotal * valid.value) / 100;
    const total = Math.max(0, subtotal - discount);
    return { discount, total };
  }
  if (valid.type === 'fixed') {
    const discount = valid.value;
    const total = Math.max(0, subtotal - discount);
    return { discount, total };
  }
  return { discount: 0, total: subtotal };
}

function snapshotCart(sessionToken) {
  const cart = getCartState(sessionToken);
  const subtotal = computeLineSubtotal(cart.items);
  const { total } = applyDiscountToSubtotal(subtotal, cart.discountApplied);
  return {
    items: cart.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      quantity: line.quantity,
    })),
    subtotal,
    total,
    discountApplied: cart.discountApplied,
  };
}

async function addToCart(sessionToken, { productId, quantity }) {
  const product = PRODUCTS[productId];
  if (!product) {
    return { success: false, error: 'Unknown product' };
  }
  const cart = getCartState(sessionToken);
  if (productId !== 'PROD-OUT-OF-STOCK' && quantity > product.stock) {
    return { success: false, error: 'Insufficient stock' };
  }
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    const nextQty = existing.quantity + quantity;
    if (productId !== 'PROD-OUT-OF-STOCK' && nextQty > product.stock) {
      return { success: false, error: 'Insufficient stock' };
    }
    existing.quantity = nextQty;
  } else {
    cart.items.push({
      id: `line_${crypto.randomUUID()}`,
      productId,
      quantity,
      unitPrice: product.price,
    });
  }
  return { success: true };
}

async function updateCartQuantity(sessionToken, itemId, quantity) {
  const cart = getCartState(sessionToken);
  const line = cart.items.find((i) => i.id === itemId);
  if (!line) return { success: false, error: 'Item not found' };
  if (quantity > 10) {
    return { success: false, error: 'Maximum quantity per line item is 10' };
  }
  const product = PRODUCTS[line.productId];
  if (product && line.productId !== 'PROD-OUT-OF-STOCK' && quantity > product.stock) {
    return { success: false, error: 'Insufficient stock' };
  }
  line.quantity = quantity;
  return { success: true };
}

async function removeFromCart(sessionToken, itemId) {
  const cart = getCartState(sessionToken);
  cart.items = cart.items.filter((i) => i.id !== itemId);
  return { success: true };
}

async function getCart(sessionToken) {
  return snapshotCart(sessionToken);
}

async function applyDiscountCode(sessionToken, code) {
  const cart = getCartState(sessionToken);
  const trimmed = String(code).trim();

  if (DISCOUNT_CODES.valid[trimmed]) {
    cart.discountApplied = trimmed;
    return { success: true };
  }
  const invalid = DISCOUNT_CODES.invalid[trimmed];
  if (trimmed === 'SUMMER21' || (invalid && invalid && invalid.status === 'expired')) {
    return { success: false, error: 'This discount code has expired' };
  }
  if (trimmed === 'FAKE99' || invalid === null) {
    return { success: false, error: 'Invalid discount code' };
  }
  if (trimmed === 'NEWUSER' || (invalid && invalid.status === 'used')) {
    return { success: false, error: 'This code has already been used' };
  }
  return { success: false, error: 'Invalid discount code' };
}

async function removeDiscountCode(sessionToken) {
  const cart = getCartState(sessionToken);
  cart.discountApplied = null;
  return { success: true };
}

function sanitizeNameForStorage(firstName) {
  if (typeof firstName !== 'string') return firstName;
  return firstName.replace(/<[^>]*>/g, '');
}

function cloneAddress(addr) {
  return {
    firstName: sanitizeNameForStorage(addr.firstName),
    lastName: addr.lastName,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
  };
}

function cardDigitsOnly(number) {
  return String(number ?? '').replace(/\s/g, '');
}

function validateCardForCharge(card) {
  const num = cardDigitsOnly(card.number);
  if (!num) {
    return { ok: false, error: 'Card number is required' };
  }
  if (!/^\d+$/.test(num)) {
    return { ok: false, error: 'Invalid card number' };
  }
  if (num === '4000000000009995') {
    return { ok: false, error: 'Your card has insufficient funds' };
  }
  if (card.expiry === '01/20') {
    return { ok: false, error: 'Your card has expired' };
  }
  if (num === '4242424242424242' && String(card.cvv) === '000') {
    return { ok: false, error: 'Security code incorrect' };
  }
  if (num === '4000000000009979') {
    return { ok: false, error: 'Your card has been declined' };
  }
  return { ok: true };
}

function pushEmail(email, { subject, body }) {
  if (!emailsByAddress.has(email)) emailsByAddress.set(email, []);
  emailsByAddress.get(email).push({ subject, body });
}

async function processPayment(sessionToken, opts = {}) {
  if (opts.csrfToken === 'INVALID_CSRF_TOKEN') {
    return { success: false, statusCode: 403 };
  }

  if (opts.idempotencyKey && idempotencyToOrderId.has(opts.idempotencyKey)) {
    const orderId = idempotencyToOrderId.get(opts.idempotencyKey);
    return {
      success: true,
      orderId,
      idempotencyKey: opts.idempotencyKey,
    };
  }

  const cart = getCartState(sessionToken);
  const subtotal = computeLineSubtotal(cart.items);
  const { total: serverTotalRaw } = applyDiscountToSubtotal(subtotal, cart.discountApplied);
  const serverTotal = serverTotalRaw;

  if (cart.items.length === 0) {
    return { success: false, error: 'Your cart is empty' };
  }

  for (const line of cart.items) {
    const p = PRODUCTS[line.productId];
    if (p && p.stock === 0) {
      return { success: false, error: 'This item is no longer available' };
    }
  }

  if (!opts.shippingAddress) {
    return { success: false, error: 'Shipping address is required' };
  }

  const idempotencyKey = opts.idempotencyKey ?? `idem_${crypto.randomUUID()}`;

  if (serverTotal > 0) {
    if (opts.method === 'paypal') {
      if (opts.paypalToken !== expectedPaypalToken(sessionToken)) {
        return { success: false, error: 'PayPal authentication failed' };
      }
    } else if (opts.savedCardId) {
      if (opts.savedCardId !== expectedSavedCardId(sessionToken)) {
        return { success: false, error: 'Invalid saved card' };
      }
    } else if (opts.card) {
      const v = validateCardForCharge(opts.card);
      if (!v.ok) return { success: false, error: v.error };
    } else {
      return { success: false, error: 'Payment method is required' };
    }
  }

  const orderId = `ord_${crypto.randomUUID()}`;
  const userId = sessionUuid(sessionToken);
  const email = `test+${userId}@example.com`;

  const last4 = opts.card ? cardDigitsOnly(opts.card.number).slice(-4) : undefined;
  const paymentMethod =
    opts.method === 'paypal'
      ? { type: 'paypal' }
      : opts.savedCardId
        ? { type: 'saved', token: `tok_saved_${opts.savedCardId}`, last4: '4242' }
        : opts.card
          ? {
              token: `tok_${last4}`,
              last4,
            }
          : { type: 'free', token: 'tok_free' };

  const order = {
    orderId,
    sessionToken,
    userEmail: email,
    items: cart.items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    total: serverTotal,
    estimatedDelivery: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    shippingAddress: cloneAddress(opts.shippingAddress),
    paymentMethod,
    status: 'Processing',
    trackingNumber: null,
  };

  orders.set(orderId, order);
  idempotencyToOrderId.set(idempotencyKey, orderId);

  if (!orderHistoryBySession.has(sessionToken)) orderHistoryBySession.set(sessionToken, []);
  orderHistoryBySession.get(sessionToken).push(order);

  pushEmail(email, {
    subject: 'Order Confirmation — thank you',
    body: `Your order ${orderId} is confirmed. Total: ${serverTotal}`,
  });

  cart.items = [];
  cart.discountApplied = null;

  return {
    success: true,
    orderId,
    idempotencyKey,
  };
}

async function placeOrder(orderId, { status, trackingNumber } = {}) {
  const order = orders.get(orderId);
  if (!order) return { success: false, error: 'Order not found' };
  if (status) order.status = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (status === 'Shipped' && trackingNumber) {
    pushEmail(order.userEmail, {
      subject: 'Shipped — tracking available',
      body: `Tracking: ${trackingNumber}`,
    });
  }
  return { success: true };
}

async function getOrder(orderId) {
  return orders.get(orderId) ?? null;
}

async function getOrderHistory(sessionToken) {
  const hist = orderHistoryBySession.get(sessionToken) ?? [];
  return hist.map((o) => ({
    orderId: o.orderId,
    total: o.total,
    status: o.status,
  }));
}

async function getEmailsSentTo(email) {
  return emailsByAddress.get(email) ?? [];
}

module.exports = {
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
};
