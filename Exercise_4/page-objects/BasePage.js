/**
 * BasePage – Page Object Model base class
 * All page objects extend this to share navigation, waiting, and assertion helpers.
 */

class BasePage {
  constructor(page) {
    this.page = page;
    this.baseUrl = process.env.APP_URL || 'http://localhost:3000';
  }

  async navigate(path = '') {
    await this.page.goto(`${this.baseUrl}${path}`);
    await this.waitForLoad();
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getTitle() {
    return this.page.title();
  }

  async getText(selector) {
    return this.page.locator(selector).textContent();
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async fill(selector, value) {
    await this.page.locator(selector).fill(value);
  }

  async isVisible(selector) {
    return this.page.locator(selector).isVisible();
  }

  async waitForSelector(selector, timeout = 5000) {
    await this.page.locator(selector).waitFor({ timeout });
  }

  async getAttributeValue(selector, attribute) {
    return this.page.locator(selector).getAttribute(attribute);
  }

  async selectOption(selector, value) {
    await this.page.locator(selector).selectOption(value);
  }

  async screenshot(name) {
    const dir = 'Exercise_4/reports/screenshots';
    await this.page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  }

  async getElementCount(selector) {
    return this.page.locator(selector).count();
  }

  async pressKey(selector, key) {
    await this.page.locator(selector).press(key);
  }

  async waitForNavigation() {
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  }

  async getCurrentUrl() {
    return this.page.url();
  }

  async hasErrorMessage() {
    const errorSelectors = ['.error', '[role="alert"]', '.alert-danger', '.error-message'];
    for (const selector of errorSelectors) {
      if (await this.isVisible(selector)) return true;
    }
    return false;
  }
}

module.exports = BasePage;
