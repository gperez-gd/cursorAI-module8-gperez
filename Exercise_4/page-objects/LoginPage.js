/**
 * LoginPage – Page Object Model for the authentication page.
 */

const BasePage = require('./BasePage');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      emailInput:      '[data-testid="email-input"], #email, input[type="email"]',
      passwordInput:   '[data-testid="password-input"], #password, input[type="password"]',
      submitButton:    '[data-testid="login-btn"], button[type="submit"], .login-btn',
      errorMessage:    '[data-testid="error-msg"], .error-message, .alert-danger',
      successMessage:  '[data-testid="success-msg"], .alert-success',
      forgotPassword:  '[data-testid="forgot-password"], a[href*="forgot"]',
      rememberMe:      '[data-testid="remember-me"], #remember-me',
      registerLink:    '[data-testid="register-link"], a[href*="register"]',
    };
  }

  async open() {
    await this.navigate('/login');
  }

  async login(email, password) {
    await this.fill(this.selectors.emailInput, email);
    await this.fill(this.selectors.passwordInput, password);
    await this.click(this.selectors.submitButton);
    await this.waitForLoad();
  }

  async loginAndWaitForRedirect(email, password, redirectPath = '/dashboard') {
    await this.login(email, password);
    await this.page.waitForURL(`**${redirectPath}`, { timeout: 10000 });
  }

  async getErrorMessage() {
    await this.waitForSelector(this.selectors.errorMessage, 3000);
    return this.getText(this.selectors.errorMessage);
  }

  async isErrorDisplayed() {
    return this.isVisible(this.selectors.errorMessage);
  }

  async clickForgotPassword() {
    await this.click(this.selectors.forgotPassword);
    await this.waitForLoad();
  }

  async toggleRememberMe() {
    await this.click(this.selectors.rememberMe);
  }

  async clickRegisterLink() {
    await this.click(this.selectors.registerLink);
    await this.waitForLoad();
  }

  async isSubmitDisabled() {
    const btn = this.page.locator(this.selectors.submitButton);
    return btn.isDisabled();
  }

  async clearAndFill(email, password) {
    await this.page.locator(this.selectors.emailInput).clear();
    await this.page.locator(this.selectors.passwordInput).clear();
    await this.login(email, password);
  }
}

module.exports = LoginPage;
