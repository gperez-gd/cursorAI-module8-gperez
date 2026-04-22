/**
 * CartPage – Page Object Model for the shopping cart page.
 */

const BasePage = require('./BasePage');

class CartPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      cartIcon:          '[data-testid="cart-icon"], .cart-icon, #cart-icon',
      cartCount:         '[data-testid="cart-count"], .cart-count, .badge',
      cartItem:          '[data-testid="cart-item"], .cart-item',
      itemName:          '[data-testid="item-name"], .item-name, .product-name',
      itemPrice:         '[data-testid="item-price"], .item-price, .price',
      itemQuantity:      '[data-testid="item-quantity"], .quantity-input, input[name="quantity"]',
      removeButton:      '[data-testid="remove-item"], .remove-item, .btn-remove',
      cartTotal:         '[data-testid="cart-total"], .cart-total, .total-price',
      discountInput:     '[data-testid="discount-input"], #discount-code, input[name="coupon"]',
      applyDiscountBtn:  '[data-testid="apply-discount"], .apply-coupon, #apply-discount',
      discountAmount:    '[data-testid="discount-amount"], .discount-amount, .savings',
      discountError:     '[data-testid="discount-error"], .coupon-error, .discount-invalid',
      checkoutButton:    '[data-testid="checkout-btn"], .checkout-btn, #checkout',
      emptyCartMessage:  '[data-testid="empty-cart"], .empty-cart, .cart-empty',
      continueShopping:  '[data-testid="continue-shopping"], a[href*="shop"]',
    };
  }

  async open() {
    await this.navigate('/cart');
  }

  async openFromIcon() {
    await this.click(this.selectors.cartIcon);
    await this.waitForLoad();
  }

  async getItemCount() {
    const count = await this.getText(this.selectors.cartCount);
    return parseInt(count, 10) || 0;
  }

  async getCartItems() {
    const items = this.page.locator(this.selectors.cartItem);
    const count = await items.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      result.push({
        name:  await item.locator(this.selectors.itemName).textContent(),
        price: await item.locator(this.selectors.itemPrice).textContent(),
      });
    }
    return result;
  }

  async getCartTotal() {
    const text = await this.getText(this.selectors.cartTotal);
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  async updateQuantity(itemIndex, quantity) {
    const items = this.page.locator(this.selectors.cartItem);
    const qtyInput = items.nth(itemIndex).locator(this.selectors.itemQuantity);
    await qtyInput.fill(String(quantity));
    await qtyInput.press('Enter');
    await this.waitForLoad();
  }

  async removeItem(itemIndex) {
    const items = this.page.locator(this.selectors.cartItem);
    await items.nth(itemIndex).locator(this.selectors.removeButton).click();
    await this.waitForLoad();
  }

  async applyDiscountCode(code) {
    await this.fill(this.selectors.discountInput, code);
    await this.click(this.selectors.applyDiscountBtn);
    await this.waitForLoad();
  }

  async getDiscountAmount() {
    const text = await this.getText(this.selectors.discountAmount);
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  async getDiscountError() {
    return this.getText(this.selectors.discountError);
  }

  async isDiscountErrorVisible() {
    return this.isVisible(this.selectors.discountError);
  }

  async proceedToCheckout() {
    await this.click(this.selectors.checkoutButton);
    await this.waitForLoad();
  }

  async isEmpty() {
    return this.isVisible(this.selectors.emptyCartMessage);
  }

  async continueShopping() {
    await this.click(this.selectors.continueShopping);
    await this.waitForLoad();
  }
}

module.exports = CartPage;
