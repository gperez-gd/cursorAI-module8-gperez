/**
 * CheckoutPage – Page Object Model for the multi-step checkout flow.
 * Steps: Shipping → Payment → Review → Confirmation
 */

const BasePage = require('./BasePage');

class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      // Shipping step
      firstNameInput:    '[data-testid="first-name"], #first-name, input[name="firstName"]',
      lastNameInput:     '[data-testid="last-name"],  #last-name,  input[name="lastName"]',
      emailInput:        '[data-testid="email"],       #email,      input[name="email"]',
      addressInput:      '[data-testid="address"],     #address,    input[name="address"]',
      cityInput:         '[data-testid="city"],        #city,       input[name="city"]',
      stateSelect:       '[data-testid="state"],       #state,      select[name="state"]',
      zipInput:          '[data-testid="zip"],         #zip,        input[name="zip"]',
      countrySelect:     '[data-testid="country"],     #country,    select[name="country"]',
      continueToPayment: '[data-testid="continue-payment"], .btn-continue, #continue-payment',

      // Payment step
      cardNumberInput:   '[data-testid="card-number"], #card-number, input[name="cardNumber"]',
      cardExpiryInput:   '[data-testid="card-expiry"], #card-expiry, input[name="expiry"]',
      cardCvvInput:      '[data-testid="card-cvv"],    #cvv,         input[name="cvv"]',
      cardNameInput:     '[data-testid="card-name"],   #card-name,   input[name="cardholderName"]',
      placeOrderButton:  '[data-testid="place-order"], .place-order, #place-order',
      paymentError:      '[data-testid="payment-error"], .payment-error, .alert-danger',

      // Order review
      orderSummary:      '[data-testid="order-summary"], .order-summary',
      orderTotal:        '[data-testid="order-total"],   .order-total, .total-amount',

      // Confirmation
      confirmationNumber: '[data-testid="confirmation-number"], .order-number, .confirmation-id',
      confirmationEmail:  '[data-testid="confirmation-email"],  .confirmation-email',
      successMessage:     '[data-testid="success-msg"],         .order-success, .success-title',

      // Breadcrumb / step indicators
      stepIndicator:     '[data-testid="step-indicator"], .checkout-steps, .breadcrumb',
    };
  }

  async open() {
    await this.navigate('/checkout');
  }

  // ── Shipping ─────────────────────────────────────────────────────────────────

  async fillShippingAddress({ firstName, lastName, email, address, city, state, zip, country = 'US' }) {
    await this.fill(this.selectors.firstNameInput, firstName);
    await this.fill(this.selectors.lastNameInput,  lastName);
    await this.fill(this.selectors.emailInput,     email);
    await this.fill(this.selectors.addressInput,   address);
    await this.fill(this.selectors.cityInput,      city);
    await this.selectOption(this.selectors.stateSelect,   state);
    await this.fill(this.selectors.zipInput,       zip);
    await this.selectOption(this.selectors.countrySelect, country);
  }

  async continueToPayment() {
    await this.click(this.selectors.continueToPayment);
    await this.waitForLoad();
  }

  // ── Payment ──────────────────────────────────────────────────────────────────

  async fillPaymentDetails({ cardNumber, expiry, cvv, cardName }) {
    await this.fill(this.selectors.cardNumberInput, cardNumber);
    await this.fill(this.selectors.cardExpiryInput, expiry);
    await this.fill(this.selectors.cardCvvInput,    cvv);
    if (cardName) await this.fill(this.selectors.cardNameInput, cardName);
  }

  async placeOrder() {
    await this.click(this.selectors.placeOrderButton);
    await this.waitForLoad();
  }

  async getPaymentError() {
    await this.waitForSelector(this.selectors.paymentError, 5000);
    return this.getText(this.selectors.paymentError);
  }

  async isPaymentErrorVisible() {
    return this.isVisible(this.selectors.paymentError);
  }

  // ── Full checkout flow helper ─────────────────────────────────────────────────

  async completeCheckout(shippingData, paymentData) {
    await this.fillShippingAddress(shippingData);
    await this.continueToPayment();
    await this.fillPaymentDetails(paymentData);
    await this.placeOrder();
  }

  // ── Order review ─────────────────────────────────────────────────────────────

  async getOrderTotal() {
    const text = await this.getText(this.selectors.orderTotal);
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────

  async getConfirmationNumber() {
    await this.waitForSelector(this.selectors.confirmationNumber, 10000);
    return this.getText(this.selectors.confirmationNumber);
  }

  async isOrderSuccessful() {
    return this.isVisible(this.selectors.successMessage);
  }

  async getSuccessMessage() {
    return this.getText(this.selectors.successMessage);
  }
}

module.exports = CheckoutPage;
