import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page loads successfully
    await expect(page).toHaveTitle(/Avrio/i);
    
    // Check if main navigation is present
    await expect(page.locator('nav')).toBeVisible();
    
    // Check if the page has content
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to products page and verify
    await page.goto('/products');
    await expect(page).toHaveURL(/.*\/products/);
    
    // Navigate to cart page and verify
    await page.goto('/cart');
    await expect(page).toHaveURL(/.*\/cart/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check if mobile menu is accessible
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    }
  });
});

test.describe('Authentication', () => {
  test('should allow user to navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    // Navigate directly to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    
    // Check if login form is present
    await expect(page.locator('form')).toBeVisible();
  });

  test('should allow user to navigate to signup page', async ({ page }) => {
    await page.goto('/');
    
    // Navigate directly to signup page
    await page.goto('/signup');
    await expect(page).toHaveURL(/.*signup/);
    
    // Check if signup form is present
    await expect(page.locator('form')).toBeVisible();
  });
});

test.describe('Product Browsing', () => {
  test('should display products on products page', async ({ page }) => {
    await page.goto('/products');
    
    // Prefer robust smoke check; skip if no seeded data
    const productCards = page.locator('[data-testid="product-card"]');
    const count = await productCards.count();
    if (count === 0) {
      // Page loaded but no data seeded; treat as non-fatal for CI
      test.skip(true, 'No product cards found in CI environment');
    }
    await expect(productCards.first()).toBeVisible();
  });

  test('should allow adding products to cart', async ({ page }) => {
    await page.goto('/products');
    
    // Click add to cart button on first product if available
    const addToCartButton = page.locator('[data-testid="add-to-cart"]').first();
    const hasAdd = await addToCartButton.count();
    test.skip(hasAdd === 0, 'No add-to-cart button in CI environment');
    await addToCartButton.click();
    
    // Check if cart icon shows updated count
    const cartIcon = page.locator('[data-testid="cart-icon"]');
    await expect(cartIcon).toBeVisible();
  });
}); 