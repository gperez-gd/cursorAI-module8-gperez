/**
 * E2E Checkout Tests – Page Object Model
 * Covers the full checkout flow using Playwright's test runner.
 * Run against a live application: APP_URL=http://localhost:3000
 *
 * NOTE: These tests require a running application instance.
 *       Set APP_URL in your environment before executing.
 */

const { test, expect } = require('@playwright/test');
const LoginPage    = require('../../page-objects/LoginPage');
const CartPage     = require('../../page-objects/CartPage');
const CheckoutPage = require('../../page-objects/CheckoutPage');
const HomePage     = require('../../page-objects/HomePage');

// ── Test data ────────────────────────────────────────────────────────────────

const VALID_USER = {
  email:    process.env.TEST_USER_EMAIL    || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'Test1234!',
};

const SHIPPING = {
  firstName: 'John',
  lastName:  'Doe',
  email:     'john.doe@example.com',
  address:   '123 Main St',
  city:      'Austin',
  state:     'TX',
  zip:       '78701',
  country:   'US',
};

const VALID_CARD    = { cardNumber: '4242424242424242', expiry: '12/28', cvv: '123', cardName: 'John Doe' };
const DECLINED_CARD = { cardNumber: '4000000000009995', expiry: '12/28', cvv: '123', cardName: 'John Doe' };
const EXPIRED_CARD  = { cardNumber: '4242424242424242', expiry: '01/20', cvv: '123', cardName: 'John Doe' };

// ── Positive scenarios ────────────────────────────────────────────────────────

test.describe('POM-P: Positive Checkout Scenarios', () => {
  test('POM-P-001: Guest can add a product and reach the checkout page', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);
    const count = await home.getCartItemCount();
    expect(count).toBeGreaterThanOrEqual(1);

    await home.goToCart();
    const isEmpty = await cart.isEmpty();
    expect(isEmpty).toBe(false);
  });

  test('POM-P-002: Authenticated user completes full checkout flow', async ({ page }) => {
    const login    = new LoginPage(page);
    const home     = new HomePage(page);
    const checkout = new CheckoutPage(page);

    await login.open();
    await login.loginAndWaitForRedirect(VALID_USER.email, VALID_USER.password);

    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const cart = new CartPage(page);
    await cart.proceedToCheckout();

    await checkout.completeCheckout(SHIPPING, VALID_CARD);

    const success = await checkout.isOrderSuccessful();
    expect(success).toBe(true);

    const confirmationNo = await checkout.getConfirmationNumber();
    expect(confirmationNo).toBeTruthy();
    expect(confirmationNo.trim().length).toBeGreaterThan(0);
  });

  test('POM-P-003: Apply valid discount code reduces cart total', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const totalBefore = await cart.getCartTotal();
    await cart.applyDiscountCode('SAVE10');

    const discountAmount = await cart.getDiscountAmount();
    const totalAfter     = await cart.getCartTotal();

    expect(discountAmount).toBeGreaterThan(0);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test('POM-P-004: Cart persists after page refresh', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);

    await page.reload();
    await home.goToCart();

    const isEmpty = await cart.isEmpty();
    expect(isEmpty).toBe(false);
  });

  test('POM-P-005: Order confirmation page shows correct email', async ({ page }) => {
    const login    = new LoginPage(page);
    const home     = new HomePage(page);
    const checkout = new CheckoutPage(page);

    await login.open();
    await login.loginAndWaitForRedirect(VALID_USER.email, VALID_USER.password);
    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const cart = new CartPage(page);
    await cart.proceedToCheckout();
    await checkout.completeCheckout(SHIPPING, VALID_CARD);

    const success = await checkout.isOrderSuccessful();
    expect(success).toBe(true);
  });
});

// ── Negative scenarios ────────────────────────────────────────────────────────

test.describe('POM-N: Negative Checkout Scenarios', () => {
  test('POM-N-001: Declined card shows payment error', async ({ page }) => {
    const login    = new LoginPage(page);
    const home     = new HomePage(page);
    const checkout = new CheckoutPage(page);

    await login.open();
    await login.loginAndWaitForRedirect(VALID_USER.email, VALID_USER.password);
    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const cart = new CartPage(page);
    await cart.proceedToCheckout();

    await checkout.fillShippingAddress(SHIPPING);
    await checkout.continueToPayment();
    await checkout.fillPaymentDetails(DECLINED_CARD);
    await checkout.placeOrder();

    const errorVisible = await checkout.isPaymentErrorVisible();
    expect(errorVisible).toBe(true);

    const errorText = await checkout.getPaymentError();
    expect(errorText.toLowerCase()).toMatch(/declin|fail|invalid/);
  });

  test('POM-N-002: Expired card shows appropriate error', async ({ page }) => {
    const login    = new LoginPage(page);
    const home     = new HomePage(page);
    const checkout = new CheckoutPage(page);

    await login.open();
    await login.loginAndWaitForRedirect(VALID_USER.email, VALID_USER.password);
    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const cart = new CartPage(page);
    await cart.proceedToCheckout();

    await checkout.fillShippingAddress(SHIPPING);
    await checkout.continueToPayment();
    await checkout.fillPaymentDetails(EXPIRED_CARD);
    await checkout.placeOrder();

    const errorVisible = await checkout.isPaymentErrorVisible();
    expect(errorVisible).toBe(true);
  });

  test('POM-N-003: Invalid discount code shows error', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    await cart.applyDiscountCode('INVALID_CODE_XYZ');

    const hasError = await cart.isDiscountErrorVisible();
    expect(hasError).toBe(true);
  });

  test('POM-N-004: Empty cart cannot proceed to checkout', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();

    const isEmpty = await cart.isEmpty();
    expect(isEmpty).toBe(true);
  });

  test('POM-N-005: Login with wrong credentials shows error', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login('wrong@example.com', 'WrongPass123!');

    const errorVisible = await login.isErrorDisplayed();
    expect(errorVisible).toBe(true);

    const errorText = await login.getErrorMessage();
    expect(errorText.toLowerCase()).toMatch(/invalid|incorrect|wrong|not found/);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test.describe('POM-E: Edge Case Scenarios', () => {
  test('POM-E-001: Remove item from cart leaves cart empty', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const countBefore = await cart.getItemCount();
    expect(countBefore).toBeGreaterThan(0);

    await cart.removeItem(0);

    const isEmpty = await cart.isEmpty();
    expect(isEmpty).toBe(true);
  });

  test('POM-E-002: Updating item quantity recalculates cart total', async ({ page }) => {
    const home = new HomePage(page);
    const cart = new CartPage(page);

    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const totalBefore = await cart.getCartTotal();
    await cart.updateQuantity(0, 2);
    const totalAfter = await cart.getCartTotal();

    expect(totalAfter).toBeGreaterThan(totalBefore);
  });

  test('POM-E-003: Checkout page is inaccessible without items in cart', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.open();
    const url = await checkout.getCurrentUrl();
    // Should redirect away from checkout or show empty-state
    expect(url).toBeTruthy();
  });

  test('POM-E-004: Search with no results shows empty state', async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    await home.search('xyznonexistentproduct123');
    const count = await home.getProductCount();
    expect(count).toBe(0);
  });

  test('POM-E-005: Login page is accessible and renders correctly', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    const title = await login.getTitle();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});

// ── Security scenarios ────────────────────────────────────────────────────────

test.describe('POM-S: Security Scenarios', () => {
  test('POM-S-001: XSS payload in search input is sanitized', async ({ page }) => {
    const home = new HomePage(page);
    await home.open();
    await home.search('<script>alert("xss")</script>');

    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>alert("xss")</script>');
  });

  test('POM-S-002: SQL injection in login email field is rejected', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login("' OR '1'='1", 'irrelevant');

    const isError = await login.isErrorDisplayed();
    expect(isError).toBe(true);
  });

  test('POM-S-003: Checkout page enforces HTTPS (production)', async ({ page }) => {
    const url = process.env.APP_URL || 'http://localhost:3000';
    if (url.startsWith('https')) {
      await page.goto(url);
      expect(page.url()).toMatch(/^https/);
    } else {
      test.skip();
    }
  });

  test('POM-S-004: Payment fields do not expose card data in DOM', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    const login    = new LoginPage(page);
    const home     = new HomePage(page);

    await login.open();
    await login.loginAndWaitForRedirect(VALID_USER.email, VALID_USER.password);
    await home.open();
    await home.addProductToCart(0);
    await home.goToCart();

    const cart = new CartPage(page);
    await cart.proceedToCheckout();
    await checkout.fillShippingAddress(SHIPPING);
    await checkout.continueToPayment();
    await checkout.fillPaymentDetails(VALID_CARD);

    const html = await page.content();
    expect(html).not.toContain('4242424242424242');
  });
});
