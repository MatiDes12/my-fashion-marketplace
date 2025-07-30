'use client';

import { useState } from 'react';
import OptimizedImage from './OptimizedImage';
import DirectImage from './DirectImage';

type ProductImageProps = {
  product: {
    product_images?: Array<{
      id: string;
      image_url: string;
      is_model_picture: boolean;
    }>;
    title?: string;
  };
  alt?: string;
  className?: string;
  useDirectImage?: boolean; // Option to bypass Next.js optimization
};

export default function ProductImage({ product, alt, className = '', useDirectImage = false }: ProductImageProps) {
  // Get the first non-model picture, or the first picture, or default to placeholder
  const imageUrl = product?.product_images?.find(img => !img.is_model_picture)?.image_url 
    || product?.product_images?.[0]?.image_url;

  // Format the image URL correctly
  const formattedImageUrl = imageUrl ? 
    (imageUrl.startsWith('http') ? imageUrl : 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${imageUrl}`) : 
    '/placeholder.png';

  const imageAlt = alt || product?.title || 'Product image';

  // Use DirectImage if specified or if environment variable is set
  if (useDirectImage || process.env.DISABLE_IMAGE_OPTIMIZATION === 'true') {
    return (
      <div className={`relative w-full h-80 bg-white rounded-lg overflow-hidden ${className}`}>
        <DirectImage
          src={imageUrl || '/placeholder.png'}
          alt={imageAlt}
          fill
          className="object-cover"
          priority={false}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-80 bg-white rounded-lg overflow-hidden ${className}`}>
      <OptimizedImage
        src={formattedImageUrl}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        priority={false}
        quality={80}
      />
    </div>
  );
} 