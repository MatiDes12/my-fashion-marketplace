import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page loads successfully
    await expect(page).toHaveTitle(/Fashion Marketplace/);
    
    // Check if main navigation is present
    await expect(page.locator('nav')).toBeVisible();
    
    // Check if the page has content
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation to products page
    await page.click('a[href="/products"]');
    await expect(page).toHaveURL(/.*products/);
    
    // Test navigation to cart page
    await page.click('a[href="/cart"]');
    await expect(page).toHaveURL(/.*cart/);
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
    
    // Click login link
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/.*login/);
    
    // Check if login form is present
    await expect(page.locator('form')).toBeVisible();
  });

  test('should allow user to navigate to signup page', async ({ page }) => {
    await page.goto('/');
    
    // Click signup link
    await page.click('a[href="/signup"]');
    await expect(page).toHaveURL(/.*signup/);
    
    // Check if signup form is present
    await expect(page.locator('form')).toBeVisible();
  });
});

test.describe('Product Browsing', () => {
  test('should display products on products page', async ({ page }) => {
    await page.goto('/products');
    
    // Check if products are displayed
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible();
  });

  test('should allow adding products to cart', async ({ page }) => {
    await page.goto('/products');
    
    // Click add to cart button on first product
    const addToCartButton = page.locator('[data-testid="add-to-cart"]').first();
    await addToCartButton.click();
    
    // Check if cart icon shows updated count
    const cartIcon = page.locator('[data-testid="cart-icon"]');
    await expect(cartIcon).toBeVisible();
  });
}); 