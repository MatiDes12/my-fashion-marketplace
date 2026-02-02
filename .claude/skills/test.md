# /test - Run Tests

Run E2E tests using Playwright across multiple browsers and devices.

## Usage

```
/test              # Run all tests
/test ui           # Run with interactive UI
/test debug        # Run in debug mode
/test <file>       # Run specific test file
/test --headed     # Run with visible browser
```

## Commands

### Run all tests
```bash
npm run test:e2e
```

### Interactive UI mode
```bash
npm run test:e2e:ui
```

### Debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/cart.spec.ts
```

### Run with visible browser
```bash
npx playwright test --headed
```

### Run specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run mobile tests
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Test Configuration

Located in `playwright.config.ts`:
- **Browsers**: Chrome, Firefox, Safari
- **Mobile**: Pixel 5, iPhone 12
- **Retries**: 2 in CI, 0 locally
- **Screenshots**: On failure
- **Video**: On retry

## Test Structure

```
tests/e2e/
├── auth.spec.ts        # Authentication flows
├── cart.spec.ts        # Cart operations
├── checkout.spec.ts    # Checkout process
├── products.spec.ts    # Product browsing
├── orders.spec.ts      # Order management
└── ...
```

## Writing Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cart', () => {
  test('should add product to cart', async ({ page }) => {
    await page.goto('/products');
    await page.click('[data-testid="product-card"]');
    await page.click('[data-testid="add-to-cart"]');

    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
  });
});
```

## View Test Report

```bash
npx playwright show-report
```

## CI Integration

Tests run automatically on PR via GitHub Actions:
```yaml
- run: npm run test:e2e
```
