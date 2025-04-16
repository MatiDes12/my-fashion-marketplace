'use client';

import Image from 'next/image';
import { useState } from 'react';

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
};

export default function ProductImage({ product, alt, className = '' }: ProductImageProps) {
  const [imageError, setImageError] = useState(false);

  // Get the first non-model picture, or the first picture, or default to placeholder
  const imageUrl = !imageError ? 
    (product?.product_images?.find(img => !img.is_model_picture)?.image_url 
    || product?.product_images?.[0]?.image_url) : null;

  // Format the image URL correctly
  const formattedImageUrl = imageUrl ? 
    (imageUrl.startsWith('http') ? imageUrl : 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${imageUrl}`) : 
    '/placeholder.png';

  const imageAlt = alt || product?.title || 'Product image';

  return (
    <div className={`relative w-full h-80 bg-white rounded-lg overflow-hidden ${className}`}>
      <Image
        src={formattedImageUrl}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        onError={() => setImageError(true)}
        priority={false}
      />
    </div>
  );
} 