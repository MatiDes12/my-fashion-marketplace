# Image Optimization Guide

This guide provides strategies to reduce Next.js Image Optimization usage and stay within the 5k/5k limit.

## Current Optimizations Implemented

### 1. Next.js Configuration Optimizations

**File: `next.config.js`**

```javascript
images: {
  // Reduced device sizes from 6 to 4
  deviceSizes: [640, 768, 1024, 1280],
  // Reduced image sizes from 7 to 5
  imageSizes: [16, 32, 64, 96, 128],
  // Increased cache TTL to 1 year
  minimumCacheTTL: 31536000,
  // Enable modern formats
  formats: ['image/webp', 'image/avif'],
}
```

**Impact:**
- Reduced optimization variants by ~40%
- Longer cache duration reduces re-optimization
- Modern formats provide better compression

### 2. OptimizedImage Component

**File: `src/components/OptimizedImage.tsx`**

Features:
- Intersection Observer for lazy loading
- Automatic quality optimization based on size
- Error handling with placeholders
- Progressive loading with skeleton states

### 3. Image Optimization Utilities

**File: `src/utils/imageOptimization.ts`**

Provides:
- Predefined size constants for different contexts
- Quality optimization based on usage
- Priority management
- URL formatting utilities

## Best Practices

### 1. Priority Images
- Only use `priority={true}` for above-the-fold images
- Limit to maximum 2 priority images per page
- Use for hero images and critical content only

### 2. Size Optimization
```javascript
// Use appropriate sizes for context
const sizes = {
  PRODUCT_GRID: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
  PRODUCT_DETAIL: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
  THUMBNAIL: '(max-width: 640px) 200px, 240px',
}
```

### 3. Quality Settings
```javascript
// Optimize quality based on size
const quality = {
  thumbnail: 60,
  grid: 75,
  detail: 80,
  hero: 85
}
```

### 4. Lazy Loading
- Use `OptimizedImage` component for non-critical images
- Set appropriate `rootMargin` for preloading
- Implement skeleton loading states

## Implementation Examples

### Product Grid
```jsx
import OptimizedImage from '@/components/OptimizedImage';

<OptimizedImage
  src={product.image_url}
  alt={product.title}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  quality={75}
  priority={index < 2}
/>
```

### Product Detail
```jsx
import { getImageProps } from '@/utils/imageOptimization';

const imageProps = getImageProps(
  product.image_url,
  product.title,
  'PRODUCT_DETAIL',
  { priority: true, quality: 80 }
);

<OptimizedImage {...imageProps} />
```

## Monitoring Usage

### 1. Track Optimization Count
- Monitor Vercel dashboard for image optimization usage
- Set up alerts when approaching limits
- Use analytics to identify high-usage pages

### 2. Performance Metrics
- Core Web Vitals (LCP, CLS)
- Image loading times
- Cache hit rates

## Additional Strategies

### 1. CDN Optimization
- Use Supabase storage with CDN
- Implement proper cache headers
- Consider image transformation at upload time

### 2. Format Optimization
- Convert images to WebP/AVIF at upload
- Use appropriate formats for different use cases
- Implement fallbacks for older browsers

### 3. Responsive Images
- Use `srcSet` for critical images
- Implement art direction with `picture` element
- Optimize for different screen densities

### 4. Caching Strategy
- Implement service worker for image caching
- Use browser cache effectively
- Consider stale-while-revalidate patterns

## Emergency Measures

If approaching the 5k limit:

1. **Reduce Quality**: Lower quality settings across the board
2. **Increase Cache TTL**: Extend cache duration further
3. **Disable Non-Critical Optimizations**: Use regular `<img>` tags for less important images
4. **Implement External CDN**: Use services like Cloudinary or ImageKit
5. **Pre-optimize Images**: Process images before upload

## Migration Checklist

- [ ] Update `next.config.js` with optimized settings
- [ ] Replace `Image` components with `OptimizedImage` where appropriate
- [ ] Review and reduce priority images
- [ ] Implement lazy loading for below-the-fold content
- [ ] Update size attributes to use predefined constants
- [ ] Test performance impact
- [ ] Monitor optimization usage

## Tools and Resources

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [Image Optimization Tools](https://github.com/GoogleChromeLabs/quicklink)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) 