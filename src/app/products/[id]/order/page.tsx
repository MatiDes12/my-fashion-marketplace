'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getFlashSalePrices } from '@/utils/flashSales';

interface Product {
  id: string;
  title: string;
  price: number;
  flash_sale_price?: number;
}

export default function OrderPage() {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const params = useParams();
  const productId = params?.id as string;
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (error) throw error;

        // Check for flash sale price
        const flashSalePrices = await getFlashSalePrices([productId]);
        const productWithFlashSale = {
          ...data,
          flash_sale_price: flashSalePrices[productId]
        };

        setProduct(productWithFlashSale);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product details');
      }
    }

    fetchProduct();
  }, [productId]);

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }

    if (!productId || !product) {
      setError('Invalid product ID');
      return;
    }

    setLoading(true);
    try {
      const finalPrice = product.flash_sale_price || product.price;
      const totalPrice = finalPrice * quantity;

      // Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            product_id: productId,
            quantity,
            total_price: totalPrice,
            original_price: product.price,
            order_status: 'pending'
          }
        ])
        .select();

      if (orderError) throw orderError;

      router.push('/orders');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Place Order</h1>

      <form onSubmit={handleOrder} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded">{error}</div>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">Price Details</h2>
          {product?.flash_sale_price ? (
            <div className="mt-2">
              <p className="text-2xl font-bold text-red-600">
                ${product.flash_sale_price.toFixed(2)}
              </p>
              <p className="text-gray-500 line-through">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-sm text-red-600">
                {Math.round(((product.price - product.flash_sale_price) / product.price) * 100)}% OFF
              </p>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">
              ${product?.price?.toFixed(2) || '0.00'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </form>
    </main>
  );
} 