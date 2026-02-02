# /lint - Code Linting

Run ESLint to check code quality and fix issues.

## Usage

```
/lint              # Check for linting issues
/lint fix          # Auto-fix linting issues
/lint <path>       # Lint specific file or directory
```

## Commands

### Check all files
```bash
npm run lint
```

### Auto-fix issues
```bash
npm run lint:fix
```

### Lint specific path
```bash
npx eslint src/components/
npx eslint src/app/api/
```

### Check specific file
```bash
npx eslint src/components/ProductCard.tsx
```

## ESLint Configuration

Located in `.eslintrc.json`:
- Extends: `next/core-web-vitals`
- Parser: TypeScript ESLint
- Rules customized for Next.js 15

## Common Issues

### Unused imports
```typescript
// Error: 'useState' is defined but never used
import { useState } from 'react'; // Remove unused imports
```

### Missing dependencies in hooks
```typescript
// Warning: React Hook useEffect has missing dependencies
useEffect(() => {
  fetchData(id);
}, []); // Add 'id' to dependency array
```

### Unescaped entities
```typescript
// Error: `'` can be escaped with `&apos;`
<p>It's a product</p>
// Fix:
<p>It&apos;s a product</p>
```

### Next.js Image component
```typescript
// Warning: Using `<img>` could result in slower LCP
<img src="/image.png" />
// Fix:
import Image from 'next/image';
<Image src="/image.png" alt="Description" width={100} height={100} />
```

## Type Checking

Run TypeScript type check separately:
```bash
npm run type-check
```

## Pre-commit Hook

Linting runs automatically before commits via husky (if configured).

## CI Integration

Linting is part of the CI test command:
```bash
npm run ci:test  # Runs lint && type-check && build
```
