'use client';

import { cleanImageUrl } from '@/utils/url';

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
    || product?.product_images?.[0]?.image_url;

  const imageAlt = alt || product?.title || 'Product image';

  return (
    <div className={`relative w-full h-full bg-white rounded-lg overflow-hidden ${className}`}>
      {imageUrl ? (
        <img
          src={cleanImageUrl(imageUrl)}
          alt={imageAlt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.png';
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
} 