'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  min_order_amount: number;
  free_shipping: boolean;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

interface FlashSaleProduct {
  id: string;
  product_id: string;
  flash_sale_id: string;
  special_price: number;
  product: {
    title: string;
    price: number;
  };
}

export default function FlashSalesPage() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_percentage: 0,
    min_order_amount: 0,
    free_shipping: false,
    start_time: '',
    end_time: '',
  });

  const supabase = createClientComponent();

  useEffect(() => {
    fetchFlashSales();
    fetchAvailableProducts();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const { data, error } = await supabase
        .from('flash_sales')
        .select(`
          *,
          flash_sale_products (
            id,
            product_id,
            special_price,
            products (
              id,
              title,
              price
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlashSales(data || []);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
      toast.error('Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, title, price')
      .eq('is_active', true);

    if (!error && data) {
      setAvailableProducts(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Insert flash sale
      const { data: flashSale, error: flashSaleError } = await supabase
        .from('flash_sales')
        .insert({
          ...formData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (flashSaleError) throw flashSaleError;

      // Insert selected products
      if (selectedProducts.length > 0) {
        const flashSaleProducts = selectedProducts.map(productId => ({
          flash_sale_id: flashSale.id,
          product_id: productId,
          special_price: availableProducts
            .find(p => p.id === productId)?.price * (1 - formData.discount_percentage / 100)
        }));

        const { error: productsError } = await supabase
          .from('flash_sale_products')
          .insert(flashSaleProducts);

        if (productsError) throw productsError;
      }

      toast.success('Flash sale created successfully');
      fetchFlashSales();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        discount_percentage: 0,
        min_order_amount: 0,
        free_shipping: false,
        start_time: '',
        end_time: '',
      });
      setSelectedProducts([]);
    } catch (error) {
      console.error('Error creating flash sale:', error);
      toast.error('Failed to create flash sale');
    }
  };

  const toggleFlashSale = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('flash_sales')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchFlashSales();
      toast.success(`Flash sale ${isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error('Error toggling flash sale:', error);
      toast.error('Failed to update flash sale');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:grid md:grid-cols-3 md:gap-6">
        {/* Create Flash Sale Form */}
        <div className="md:col-span-1">
          <div className="px-4 sm:px-0">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Create Flash Sale</h3>
            <p className="mt-1 text-sm text-gray-600">
              Set up a new flash sale campaign with special discounts and offers.
            </p>
          </div>
        </div>

        <div className="mt-5 md:mt-0 md:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="shadow sm:rounded-md sm:overflow-hidden">
              <div className="px-4 py-5 bg-white space-y-6 sm:p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Discount Percentage
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Order Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_order_amount}
                      onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Products</label>
                  <select
                    multiple
                    value={selectedProducts}
                    onChange={(e) => setSelectedProducts(
                      Array.from(e.target.selectedOptions, option => option.value)
                    )}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  >
                    {availableProducts.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.title} - {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="free_shipping"
                    checked={formData.free_shipping}
                    onChange={(e) => setFormData({ ...formData, free_shipping: e.target.checked })}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label htmlFor="free_shipping" className="ml-2 block text-sm text-gray-900">
                    Enable Free Shipping
                  </label>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Create Flash Sale
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Active Flash Sales */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Active Flash Sales</h2>
        <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {flashSales.map((sale) => (
              <li key={sale.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{sale.title}</h3>
                      <p className="mt-1 text-sm text-gray-500">{sale.description}</p>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span>{sale.discount_percentage}% OFF</span>
                        <span className="mx-2">•</span>
                        <span>
                          {new Date(sale.start_time).toLocaleDateString()} - {new Date(sale.end_time).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => toggleFlashSale(sale.id, sale.is_active)}
                        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${
                          sale.is_active
                            ? 'text-red-700 bg-red-100 hover:bg-red-200'
                            : 'text-green-700 bg-green-100 hover:bg-green-200'
                        }`}
                      >
                        {sale.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
} 