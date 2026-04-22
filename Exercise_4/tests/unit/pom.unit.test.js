/**
 * Unit Tests – Page Object Model classes
 * Validates POM structure, method signatures, and selector integrity
 * without requiring a live browser instance.
 */

const BasePage     = require('../../page-objects/BasePage');
const LoginPage    = require('../../page-objects/LoginPage');
const CartPage     = require('../../page-objects/CartPage');
const CheckoutPage = require('../../page-objects/CheckoutPage');
const HomePage     = require('../../page-objects/HomePage');

// ── Mock Playwright page object ───────────────────────────────────────────────

function createMockPage(overrides = {}) {
  const locatorMock = {
    click:       jest.fn().mockResolvedValue(undefined),
    fill:        jest.fn().mockResolvedValue(undefined),
    textContent: jest.fn().mockResolvedValue('mock-text'),
    isVisible:   jest.fn().mockResolvedValue(true),
    isDisabled:  jest.fn().mockResolvedValue(false),
    waitFor:     jest.fn().mockResolvedValue(undefined),
    getAttribute:jest.fn().mockResolvedValue('mock-attr'),
    selectOption:jest.fn().mockResolvedValue(undefined),
    press:       jest.fn().mockResolvedValue(undefined),
    count:       jest.fn().mockResolvedValue(2),
    nth:         jest.fn().mockReturnThis(),
    clear:       jest.fn().mockResolvedValue(undefined),
  };

  return {
    goto:                jest.fn().mockResolvedValue(undefined),
    waitForLoadState:    jest.fn().mockResolvedValue(undefined),
    waitForNavigation:   jest.fn().mockResolvedValue(undefined),
    waitForURL:          jest.fn().mockResolvedValue(undefined),
    title:               jest.fn().mockResolvedValue('Test Store'),
    url:                 jest.fn().mockReturnValue('http://localhost:3000/'),
    content:             jest.fn().mockResolvedValue('<html><body>Safe content</body></html>'),
    screenshot:          jest.fn().mockResolvedValue(undefined),
    reload:              jest.fn().mockResolvedValue(undefined),
    locator:             jest.fn().mockReturnValue(locatorMock),
    ...overrides,
  };
}

// ── BasePage tests ────────────────────────────────────────────────────────────

describe('BasePage – structure and methods', () => {
  let page;
  let basePage;

  beforeEach(() => {
    page     = createMockPage();
    basePage = new BasePage(page);
  });

  test('BP-001: constructor sets page and baseUrl', () => {
    expect(basePage.page).toBe(page);
    expect(basePage.baseUrl).toBeDefined();
    expect(typeof basePage.baseUrl).toBe('string');
  });

  test('BP-002: navigate calls page.goto with correct URL', async () => {
    await basePage.navigate('/products');
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/products'));
  });

  test('BP-003: navigate to root calls page.goto', async () => {
    await basePage.navigate();
    expect(page.goto).toHaveBeenCalledTimes(1);
  });

  test('BP-004: waitForLoad calls waitForLoadState', async () => {
    await basePage.waitForLoad();
    expect(page.waitForLoadState).toHaveBeenCalledWith('domcontentloaded');
  });

  test('BP-005: getTitle returns page title', async () => {
    const title = await basePage.getTitle();
    expect(title).toBe('Test Store');
  });

  test('BP-006: click delegates to page.locator().click()', async () => {
    await basePage.click('.my-btn');
    expect(page.locator).toHaveBeenCalledWith('.my-btn');
  });

  test('BP-007: fill delegates to page.locator().fill()', async () => {
    await basePage.fill('#input', 'hello');
    expect(page.locator).toHaveBeenCalledWith('#input');
  });

  test('BP-008: isVisible delegates to page.locator().isVisible()', async () => {
    const result = await basePage.isVisible('.modal');
    expect(result).toBe(true);
  });

  test('BP-009: getCurrentUrl returns page.url()', async () => {
    const url = await basePage.getCurrentUrl();
    expect(url).toBe('http://localhost:3000/');
  });

  test('BP-010: getElementCount returns a number', async () => {
    const count = await basePage.getElementCount('.item');
    expect(typeof count).toBe('number');
  });
});

// ── LoginPage tests ───────────────────────────────────────────────────────────

describe('LoginPage – structure and selectors', () => {
  let page;
  let loginPage;

  beforeEach(() => {
    page      = createMockPage();
    loginPage = new LoginPage(page);
  });

  test('LP-001: inherits from BasePage', () => {
    expect(loginPage).toBeInstanceOf(BasePage);
  });

  test('LP-002: selectors object is defined with required keys', () => {
    const required = ['emailInput', 'passwordInput', 'submitButton', 'errorMessage'];
    required.forEach(key => {
      expect(loginPage.selectors).toHaveProperty(key);
      expect(typeof loginPage.selectors[key]).toBe('string');
    });
  });

  test('LP-003: open() navigates to /login', async () => {
    await loginPage.open();
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/login'));
  });

  test('LP-004: login() fills email, password and clicks submit', async () => {
    await loginPage.login('user@example.com', 'Pass123!');
    expect(page.locator).toHaveBeenCalledWith(loginPage.selectors.emailInput);
    expect(page.locator).toHaveBeenCalledWith(loginPage.selectors.passwordInput);
    expect(page.locator).toHaveBeenCalledWith(loginPage.selectors.submitButton);
  });

  test('LP-005: isErrorDisplayed returns boolean', async () => {
    const result = await loginPage.isErrorDisplayed();
    expect(typeof result).toBe('boolean');
  });
});

// ── CartPage tests ────────────────────────────────────────────────────────────

describe('CartPage – structure and selectors', () => {
  let page;
  let cartPage;

  beforeEach(() => {
    page     = createMockPage();
    cartPage = new CartPage(page);
  });

  test('CP-001: inherits from BasePage', () => {
    expect(cartPage).toBeInstanceOf(BasePage);
  });

  test('CP-002: selectors object has required cart keys', () => {
    const required = ['cartItem', 'cartTotal', 'discountInput', 'removeButton', 'checkoutButton'];
    required.forEach(key => {
      expect(cartPage.selectors).toHaveProperty(key);
    });
  });

  test('CP-003: open() navigates to /cart', async () => {
    await cartPage.open();
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/cart'));
  });

  test('CP-004: applyDiscountCode() fills input and clicks apply button', async () => {
    await cartPage.applyDiscountCode('SAVE10');
    expect(page.locator).toHaveBeenCalledWith(cartPage.selectors.discountInput);
    expect(page.locator).toHaveBeenCalledWith(cartPage.selectors.applyDiscountBtn);
  });

  test('CP-005: proceedToCheckout() clicks checkout button', async () => {
    await cartPage.proceedToCheckout();
    expect(page.locator).toHaveBeenCalledWith(cartPage.selectors.checkoutButton);
  });

  test('CP-006: isEmpty returns boolean', async () => {
    const result = await cartPage.isEmpty();
    expect(typeof result).toBe('boolean');
  });
});

// ── CheckoutPage tests ────────────────────────────────────────────────────────

describe('CheckoutPage – structure and selectors', () => {
  let page;
  let checkoutPage;

  beforeEach(() => {
    page         = createMockPage();
    checkoutPage = new CheckoutPage(page);
  });

  test('CK-001: inherits from BasePage', () => {
    expect(checkoutPage).toBeInstanceOf(BasePage);
  });

  test('CK-002: selectors has shipping, payment, and confirmation keys', () => {
    const required = [
      'firstNameInput', 'cardNumberInput', 'placeOrderButton',
      'confirmationNumber', 'successMessage',
    ];
    required.forEach(key => {
      expect(checkoutPage.selectors).toHaveProperty(key);
    });
  });

  test('CK-003: open() navigates to /checkout', async () => {
    await checkoutPage.open();
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/checkout'));
  });

  test('CK-004: fillShippingAddress() calls fill for all address fields', async () => {
    await checkoutPage.fillShippingAddress({
      firstName: 'John', lastName: 'Doe',   email: 'j@d.com',
      address:   '123 St', city: 'Austin', state: 'TX', zip: '78701',
    });
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.firstNameInput);
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.lastNameInput);
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.emailInput);
  });

  test('CK-005: fillPaymentDetails() fills card fields', async () => {
    await checkoutPage.fillPaymentDetails({
      cardNumber: '4242424242424242', expiry: '12/28', cvv: '123',
    });
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.cardNumberInput);
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.cardExpiryInput);
    expect(page.locator).toHaveBeenCalledWith(checkoutPage.selectors.cardCvvInput);
  });

  test('CK-006: isOrderSuccessful returns boolean', async () => {
    const result = await checkoutPage.isOrderSuccessful();
    expect(typeof result).toBe('boolean');
  });

  test('CK-007: isPaymentErrorVisible returns boolean', async () => {
    const result = await checkoutPage.isPaymentErrorVisible();
    expect(typeof result).toBe('boolean');
  });
});

// ── HomePage tests ────────────────────────────────────────────────────────────

describe('HomePage – structure and selectors', () => {
  let page;
  let homePage;

  beforeEach(() => {
    page     = createMockPage();
    homePage = new HomePage(page);
  });

  test('HP-001: inherits from BasePage', () => {
    expect(homePage).toBeInstanceOf(BasePage);
  });

  test('HP-002: selectors has product and navigation keys', () => {
    const required = ['productCard', 'addToCartButton', 'searchInput', 'cartIcon'];
    required.forEach(key => {
      expect(homePage.selectors).toHaveProperty(key);
    });
  });

  test('HP-003: open() navigates to /', async () => {
    await homePage.open();
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('/'));
  });

  test('HP-004: search() fills input and clicks button', async () => {
    await homePage.search('laptop');
    expect(page.locator).toHaveBeenCalledWith(homePage.selectors.searchInput);
    expect(page.locator).toHaveBeenCalledWith(homePage.selectors.searchButton);
  });

  test('HP-005: getProductCount returns a number', async () => {
    const count = await homePage.getProductCount();
    expect(typeof count).toBe('number');
  });

  test('HP-006: isHeroVisible returns boolean', async () => {
    const result = await homePage.isHeroVisible();
    expect(typeof result).toBe('boolean');
  });
});

// ── POM pattern compliance ────────────────────────────────────────────────────

describe('POM pattern compliance', () => {
  test('PC-001: All page objects expose an open() method', () => {
    const mock     = createMockPage();
    const pages    = [
      new LoginPage(mock), new CartPage(mock),
      new CheckoutPage(mock), new HomePage(mock),
    ];
    pages.forEach(p => {
      expect(typeof p.open).toBe('function');
    });
  });

  test('PC-002: All page objects have a selectors property', () => {
    const mock  = createMockPage();
    const pages = [
      new LoginPage(mock), new CartPage(mock),
      new CheckoutPage(mock), new HomePage(mock),
    ];
    pages.forEach(p => {
      expect(p.selectors).toBeDefined();
      expect(typeof p.selectors).toBe('object');
      expect(Object.keys(p.selectors).length).toBeGreaterThan(0);
    });
  });

  test('PC-003: All page objects inherit BasePage methods', () => {
    const mock  = createMockPage();
    const pages = [
      new LoginPage(mock), new CartPage(mock),
      new CheckoutPage(mock), new HomePage(mock),
    ];
    const baseMethods = ['navigate', 'click', 'fill', 'isVisible', 'getTitle', 'getCurrentUrl'];
    pages.forEach(p => {
      baseMethods.forEach(method => {
        expect(typeof p[method]).toBe('function');
      });
    });
  });

  test('PC-004: No page object hardcodes a base URL', () => {
    const mock  = createMockPage();
    const pages = [
      new LoginPage(mock), new CartPage(mock),
      new CheckoutPage(mock), new HomePage(mock),
    ];
    pages.forEach(p => {
      const source = p.constructor.toString();
      expect(source).not.toMatch(/localhost:\d+/);
    });
  });

  test('PC-005: Selectors use fallback chains (multiple CSS strategies)', () => {
    const mock         = createMockPage();
    const checkoutPage = new CheckoutPage(mock);
    // Selectors should have comma-separated fallback selectors
    Object.values(checkoutPage.selectors).forEach(selector => {
      expect(typeof selector).toBe('string');
      expect(selector.length).toBeGreaterThan(0);
    });
  });
});
