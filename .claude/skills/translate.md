# /translate - Translation Management

Manage English and Amharic translations for the marketplace.

## Usage

```
/translate list               # List all translation keys
/translate add <key>          # Add a new translation key
/translate missing            # Find missing translations
/translate check              # Validate translation completeness
```

## Translation File

Located at `src/utils/translations.ts`:
```typescript
const translations = {
  en: {
    'key.name': 'English text',
  },
  am: {
    'key.name': 'አማርኛ ጽሑፍ',
  }
};
```

## Adding Translations

### 1. Add to translations.ts
```typescript
// src/utils/translations.ts
const translations = {
  en: {
    // ... existing
    'new.feature.title': 'New Feature',
    'new.feature.description': 'Description of the feature',
  },
  am: {
    // ... existing
    'new.feature.title': 'አዲስ ባህሪ',
    'new.feature.description': 'የባህሪው መግለጫ',
  }
};
```

### 2. Use in component
```typescript
import { useLanguage } from '@/contexts/LanguageContext';

function MyComponent() {
  const { t } = useLanguage();
  return <h1>{t('new.feature.title')}</h1>;
}
```

## Key Naming Convention

Use dot notation for hierarchy:
```
nav.home
nav.products
nav.cart

product.title
product.price
product.addToCart

checkout.shipping
checkout.payment
checkout.confirm

error.notFound
error.unauthorized
```

## Find Missing Translations

```bash
# Search for t() calls and compare with translations
grep -r "t('" src/ | grep -oP "t\('[^']+'" | sort | uniq
```

## Common Categories

| Category | Prefix | Example |
|----------|--------|---------|
| Navigation | `nav.` | `nav.home` |
| Products | `product.` | `product.price` |
| Cart | `cart.` | `cart.empty` |
| Checkout | `checkout.` | `checkout.pay` |
| Orders | `order.` | `order.status` |
| Auth | `auth.` | `auth.login` |
| Errors | `error.` | `error.notFound` |
| Common | `common.` | `common.save` |

## Amharic Resources

When adding Amharic translations, consider:
- Use proper Ethiopic script (ኢትዮጲክ)
- Keep phrases concise (may be longer than English)
- Test UI layout with Amharic text
- Use `Noto Sans Ethiopic` font

## Validation

Ensure all translations exist in both languages:
```typescript
// Check for missing keys
const enKeys = Object.keys(translations.en);
const amKeys = Object.keys(translations.am);

const missingInAm = enKeys.filter(k => !amKeys.includes(k));
const missingInEn = amKeys.filter(k => !enKeys.includes(k));
```
