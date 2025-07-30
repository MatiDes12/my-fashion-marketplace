/**
 * Image optimization utilities to reduce Next.js Image Optimization usage
 */

// Optimized sizes for different contexts
export const IMAGE_SIZES = {
  // Product grid items
  PRODUCT_GRID: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
  // Product detail main image
  PRODUCT_DETAIL: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
  // Category images
  CATEGORY: '(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 20vw',
  // Small thumbnails
  THUMBNAIL: '(max-width: 640px) 200px, 240px',
  // Medium thumbnails
  MEDIUM_THUMB: '(max-width: 640px) 280px, 320px',
  // Fixed small sizes
  SMALL: '64px',
  MEDIUM: '128px',
  LARGE: '256px'
} as const;

// Quality settings based on image size and context
export const getOptimizedQuality = (context: 'thumbnail' | 'grid' | 'detail' | 'hero' = 'grid') => {
  switch (context) {
    case 'thumbnail':
      return 60;
    case 'grid':
      return 75;
    case 'detail':
      return 80;
    case 'hero':
      return 85;
    default:
      return 75;
  }
};

// Determine if image should be prioritized
export const shouldPrioritize = (index: number, maxPriority: number = 4) => {
  return index < maxPriority;
};

// Format image URL for Supabase storage
export const formatImageUrl = (url: string, bucket: string = 'products') => {
  if (!url) return '/placeholder.png';
  
  if (url.startsWith('http')) {
    return url;
  }
  
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${url}`;
};

// Get optimized image props for different contexts
export const getImageProps = (
  src: string,
  alt: string,
  context: keyof typeof IMAGE_SIZES = 'PRODUCT_GRID',
  options: {
    priority?: boolean;
    quality?: number;
    className?: string;
    fill?: boolean;
    width?: number;
    height?: number;
  } = {}
) => {
  const {
    priority = false,
    quality,
    className = '',
    fill = true,
    width,
    height
  } = options;

  return {
    src: formatImageUrl(src),
    alt,
    fill,
    width: !fill ? width : undefined,
    height: !fill ? height : undefined,
    className,
    sizes: IMAGE_SIZES[context],
    quality: quality || getOptimizedQuality(context === 'THUMBNAIL' ? 'thumbnail' : 'grid'),
    priority
  };
};

// Lazy loading threshold for intersection observer
export const LAZY_LOAD_THRESHOLD = 0.1;
export const LAZY_LOAD_ROOT_MARGIN = '50px 0px';

// Cache key for image optimization
export const getImageCacheKey = (src: string, width: number, quality: number) => {
  return `${src}-${width}-${quality}`;
}; 