'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import CountdownTimer from '@/components/CountdownTimer';

interface FlashSaleProduct {
  id: string;
  product_id: string;
  special_price: number;
  products: {
    id: string;
    title: string;
    description: string;
    price: number;
    product_images: {
      id: string;
      image_url: string;
      is_model_picture: boolean;
    }[];
    users: {
      id: string;
      full_name: string;
      store_settings: any;
    };
  };
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  flash_sale_products: FlashSaleProduct[];
}

export default function FlashSalePage() {
  const params = useParams();
  const [flashSale, setFlashSale] = useState<FlashSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();

  useEffect(() => {
    const fetchFlashSale = async () => {
      try {
        setLoading(true);
        
        // Check if we have a valid ID
        const saleId = params?.id;
        if (!saleId) {
          throw new Error('Flash sale ID is required');
        }

        const { data, error } = await supabase
          .from('flash_sales')
          .select(`
            *,
            flash_sale_products (
              id,
              product_id,
              special_price,
              products (
                *,
                product_images (
                  id,
                  image_url,
                  is_model_picture
                ),
                users (
                  id,
                  full_name,
                  store_settings
                )
              )
            )
          `)
          .eq('id', saleId)
          .single();

        if (error) throw error;
        setFlashSale(data);
      } catch (err) {
        console.error('Error fetching flash sale:', err);
        setError('Failed to load flash sale');
      } finally {
        setLoading(false);
      }
    };

    if (params?.id) {
      fetchFlashSale();
    }
  }, [params?.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!flashSale) return <ErrorMessage message="Flash sale not found" />;

  return (
    <div className="min-h-screen bg-gray-50 pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-red-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">{flashSale.title}</h1>
                <p className="mt-2 text-red-100">{flashSale.description}</p>
              </div>
              <CountdownTimer endTime={flashSale.end_time} />
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {flashSale.flash_sale_products.map((flashProduct: any) => (
                <ProductCard
                  key={flashProduct.product_id}
                  product={{
                    ...flashProduct.products,
                    flash_sale_price: flashProduct.special_price
                  }}
                  showOwner
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 