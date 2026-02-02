# Translation Agent

A specialized agent for internationalization (i18n) in the AVRIO marketplace.

## Supported Languages

- **English (en)** - Default
- **Amharic (am)** - Ethiopian language

## Architecture

### Language Context
Located in `src/contexts/LanguageContext.tsx`:
```typescript
interface LanguageContextType {
  language: 'en' | 'am';
  setLanguage: (lang: 'en' | 'am') => void;
  t: (key: string) => string;
}
```

### Translation Files
Located in `src/utils/translations.ts`:
```typescript
const translations = {
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.cart': 'Cart',
    'nav.account': 'Account',
    // ...
  },
  am: {
    'nav.home': 'መነሻ',
    'nav.products': 'ምርቶች',
    'nav.cart': 'ጋሪ',
    'nav.account': 'መለያ',
    // ...
  }
};
```

## Usage Patterns

### In Components
```typescript
'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function ProductCard() {
  const { t, language } = useLanguage();

  return (
    <div>
      <button>{t('product.addToCart')}</button>
      <span>{t('product.inStock')}</span>
    </div>
  );
}
```

### Language Switcher
```typescript
'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as 'en' | 'am')}
    >
      <option value="en">English</option>
      <option value="am">አማርኛ</option>
    </select>
  );
}
```

## Translation Keys Structure

### Navigation
```
nav.home
nav.products
nav.categories
nav.cart
nav.wishlist
nav.account
nav.seller
nav.admin
```

### Products
```
product.addToCart
product.buyNow
product.inStock
product.outOfStock
product.price
product.description
product.reviews
product.rating
product.quantity
```

### Cart & Checkout
```
cart.title
cart.empty
cart.subtotal
cart.total
cart.checkout
checkout.shipping
checkout.payment
checkout.placeOrder
checkout.success
```

### Authentication
```
auth.login
auth.register
auth.logout
auth.email
auth.password
auth.forgotPassword
auth.resetPassword
```

### Common
```
common.loading
common.error
common.success
common.cancel
common.confirm
common.save
common.delete
common.edit
common.search
common.filter
common.sort
```

### Errors
```
error.general
error.notFound
error.unauthorized
error.forbidden
error.network
error.validation
```

## Adding New Translations

1. Add key to both language objects in `translations.ts`:

```typescript
const translations = {
  en: {
    // existing translations...
    'new.feature.title': 'New Feature',
    'new.feature.description': 'This is a new feature',
  },
  am: {
    // existing translations...
    'new.feature.title': 'አዲስ ባህሪ',
    'new.feature.description': 'ይህ አዲስ ባህሪ ነው',
  }
};
```

2. Use in component:
```typescript
const { t } = useLanguage();
<h1>{t('new.feature.title')}</h1>
```

## Amharic Typography

### Font Support
Ensure Amharic fonts are loaded:
```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic&display=swap');

body {
  font-family: 'Inter', 'Noto Sans Ethiopic', sans-serif;
}
```

### RTL Considerations
Amharic is left-to-right (LTR), so no RTL adjustments needed.

### Number Formatting
```typescript
const formatNumber = (num: number, lang: string) => {
  return new Intl.NumberFormat(lang === 'am' ? 'am-ET' : 'en-US').format(num);
};
```

### Currency Formatting
```typescript
const formatCurrency = (amount: number, lang: string) => {
  const currency = lang === 'am' ? 'ETB' : 'USD';
  return new Intl.NumberFormat(lang === 'am' ? 'am-ET' : 'en-US', {
    style: 'currency',
    currency
  }).format(amount);
};
```

## Best Practices

1. **Use descriptive keys**: `product.addToCart` not `btn1`
2. **Group related translations**: Use dot notation for hierarchy
3. **Include context**: `cart.empty` vs just `empty`
4. **Handle plurals**: Create separate keys for singular/plural
5. **Avoid HTML in translations**: Keep formatting in components
6. **Test both languages**: Verify UI looks correct in Amharic
