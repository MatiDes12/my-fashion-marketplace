'use client';

import Image from 'next/image';

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
  // Get the first non-model picture, or the first picture, or default to placeholder
  const imageUrl = product?.product_images?.find(img => !img.is_model_picture)?.image_url 
    || product?.product_images?.[0]?.image_url 
    || '/placeholder.png';

  // No need to clean the URL as it's already in the correct format from Supabase
  const imageAlt = alt || product?.title || 'Product image';

  return (
    <div className={`relative w-full h-80 bg-white rounded-lg overflow-hidden ${className}`}>
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
} 