'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

interface SimilarProduct {
  id: string;
  title: string;
  price: number;
  product_images: Array<{
    image_url: string;
  }>;
}

interface SimilarProductsProps {
  currentProductId: string;
  category: string;
}

export default function SimilarProducts({ currentProductId, category }: SimilarProductsProps) {
  const [products, setProducts] = useState<SimilarProduct[]>([]);
  const supabase = createClientComponent();

  useEffect(() => {
    const fetchSimilarProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select(`
          id,
          title,
          price,
          product_images (image_url)
        `)
        .eq('category', category)
        .neq('id', currentProductId)
        .eq('is_active', true)
        .limit(4);

      setProducts(data || []);
    };

    fetchSimilarProducts();
  }, [currentProductId, category]);

  if (products.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Similar Products</h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {products.map((product) => (
          <Link 
            key={product.id}
            href={`/products/${product.id}`}
            className="group"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={product.product_images[0]?.image_url || '/placeholder.png'}
                alt={product.title}
                fill
                className="object-cover group-hover:opacity-75 transition-opacity"
              />
            </div>
            <h4 className="mt-2 text-sm font-medium text-gray-900 truncate group-hover:text-red-600">
              {product.title}
            </h4>
            <p className="text-sm font-medium text-gray-500">
              ETB {product.price}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
} 