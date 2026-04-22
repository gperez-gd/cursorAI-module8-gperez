/**
 * HomePage – Page Object Model for the storefront home/product listing page.
 */

const BasePage = require('./BasePage');

class HomePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      searchInput:      '[data-testid="search-input"],  #search,  input[name="q"]',
      searchButton:     '[data-testid="search-btn"],    .search-btn, button[type="submit"]',
      productCard:      '[data-testid="product-card"],  .product-card, .product-item',
      productName:      '[data-testid="product-name"],  .product-name, .card-title',
      productPrice:     '[data-testid="product-price"], .product-price, .price',
      addToCartButton:  '[data-testid="add-to-cart"],   .add-to-cart, .btn-cart',
      categoryFilter:   '[data-testid="category"],      .category-filter, select[name="category"]',
      sortSelect:       '[data-testid="sort"],           #sort, select[name="sort"]',
      cartIcon:         '[data-testid="cart-icon"],      .cart-icon, #cart-icon',
      cartBadge:        '[data-testid="cart-badge"],     .cart-count, .badge',
      navLogin:         '[data-testid="nav-login"],      .nav-login, a[href*="login"]',
      navAccount:       '[data-testid="nav-account"],    .nav-account, a[href*="account"]',
      heroSection:      '[data-testid="hero"],           .hero, .jumbotron',
      featuredProducts: '[data-testid="featured"],       .featured-products',
      pagination:       '[data-testid="pagination"],     .pagination, nav[aria-label="pagination"]',
      nextPage:         '[data-testid="next-page"],      .page-next, a[aria-label="Next"]',
    };
  }

  async open() {
    await this.navigate('/');
  }

  async search(query) {
    await this.fill(this.selectors.searchInput, query);
    await this.click(this.selectors.searchButton);
    await this.waitForLoad();
  }

  async getProductCount() {
    return this.getElementCount(this.selectors.productCard);
  }

  async getProductNames() {
    const cards = this.page.locator(this.selectors.productCard);
    const count = await cards.count();
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(await cards.nth(i).locator(this.selectors.productName).textContent());
    }
    return names;
  }

  async addProductToCart(productIndex = 0) {
    const cards = this.page.locator(this.selectors.productCard);
    await cards.nth(productIndex).locator(this.selectors.addToCartButton).click();
    await this.waitForLoad();
  }

  async filterByCategory(category) {
    await this.selectOption(this.selectors.categoryFilter, category);
    await this.waitForLoad();
  }

  async sortBy(option) {
    await this.selectOption(this.selectors.sortSelect, option);
    await this.waitForLoad();
  }

  async getCartItemCount() {
    const badge = await this.getText(this.selectors.cartBadge);
    return parseInt(badge, 10) || 0;
  }

  async goToCart() {
    await this.click(this.selectors.cartIcon);
    await this.waitForLoad();
  }

  async goToLogin() {
    await this.click(this.selectors.navLogin);
    await this.waitForLoad();
  }

  async isHeroVisible() {
    return this.isVisible(this.selectors.heroSection);
  }

  async goToNextPage() {
    await this.click(this.selectors.nextPage);
    await this.waitForLoad();
  }

  async hasPagination() {
    return this.isVisible(this.selectors.pagination);
  }
}

module.exports = HomePage;
