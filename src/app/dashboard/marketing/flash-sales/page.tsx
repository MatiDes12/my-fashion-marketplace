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

interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
}

export default function SellerFlashSalesPage() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_percentage: 0,
    min_order_amount: 0,
    free_shipping: false,
    start_time: '',
    end_time: '',
  });
  const [selectionMode, setSelectionMode] = useState<'individual' | 'category' | 'all'>('individual');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  const supabase = createClientComponent();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchMyFlashSales();
      fetchMyProducts();
      fetchCategories();
    }
  }, [user]);

  const fetchMyFlashSales = async () => {
    try {
      if (!user) return;

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
        .eq('created_by', user.id)
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

  const fetchMyProducts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('products')
      .select('id, title, price, category')
      .eq('owner_id', user.id)
      .eq('is_active', true);

    if (!error && data) {
      setMyProducts(data);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null)
      .eq('owner_id', user.id);
    
    const uniqueCategories = Array.from(new Set(data?.map(p => p.category)));
    setCategories(uniqueCategories);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user) {
        toast.error('Please login to create a flash sale');
        return;
      }

      // Get products based on selection mode
      let productsToInclude: Product[] = [];
      
      if (selectionMode === 'individual') {
        productsToInclude = myProducts.filter(p => selectedProducts.includes(p.id));
      } else if (selectionMode === 'category') {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('owner_id', user.id)
          .eq('category', selectedCategory);
        productsToInclude = data || [];
      } else if (selectionMode === 'all') {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('owner_id', user.id);
        productsToInclude = data || [];
      }

      // Create flash sale
      const { data: flashSale, error: flashSaleError } = await supabase
        .from('flash_sales')
        .insert({
          title: formData.title,
          description: formData.description,
          discount_percentage: formData.discount_percentage,
          min_order_amount: formData.min_order_amount,
          free_shipping: formData.free_shipping,
          start_time: formData.start_time,
          end_time: formData.end_time,
          created_by: user.id,
          is_active: true
        })
        .select()
        .single();

      if (flashSaleError) throw flashSaleError;

      // Calculate and insert special prices for all included products
      const flashSaleProducts = productsToInclude.map(product => ({
        flash_sale_id: flashSale.id,
        product_id: product.id,
        special_price: Number((product.price * (1 - formData.discount_percentage / 100)).toFixed(2))
      }));

      const { error: productsError } = await supabase
        .from('flash_sale_products')
        .insert(flashSaleProducts);

      if (productsError) throw productsError;

      // Reset form and refresh data
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
      setSelectionMode('individual');
      setSelectedCategory('');
      fetchMyFlashSales();
      toast.success('Flash sale created successfully!');

    } catch (error) {
      console.error('Error creating flash sale:', error);
      toast.error('Failed to create flash sale');
    }
  };

  const toggleFlashSale = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('flash_sales')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      fetchMyFlashSales();
      toast.success(`Flash sale ${currentStatus ? 'deactivated' : 'activated'} successfully!`);
    } catch (error) {
      console.error('Error toggling flash sale:', error);
      toast.error('Failed to update flash sale status');
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-6">Create Flash Sale</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Discount Percentage</label>
              <input
                type="number"
                required
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Minimum Order Amount</label>
              <input
                type="number"
                min="0"
                value={formData.min_order_amount}
                onChange={(e) => setFormData({ ...formData, min_order_amount: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">Product Selection Mode</label>
            <div className="mt-2 space-y-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="individual"
                  checked={selectionMode === 'individual'}
                  onChange={() => setSelectionMode('individual')}
                  className="h-4 w-4 text-red-600"
                />
                <label htmlFor="individual" className="ml-2">Select Individual Products</label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="category"
                  checked={selectionMode === 'category'}
                  onChange={() => setSelectionMode('category')}
                  className="h-4 w-4 text-red-600"
                />
                <label htmlFor="category" className="ml-2">Select by Category</label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="all"
                  checked={selectionMode === 'all'}
                  onChange={() => setSelectionMode('all')}
                  className="h-4 w-4 text-red-600"
                />
                <label htmlFor="all" className="ml-2">Select All Products</label>
              </div>
            </div>
          </div>

          {selectionMode === 'individual' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Select Products</label>
              <select
                multiple
                value={selectedProducts}
                onChange={(e) => setSelectedProducts(
                  Array.from(e.target.selectedOptions, option => option.value)
                )}
                className="mt-1 block w-full rounded-md border-gray-300"
              >
                {myProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.title} - ${product.price}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectionMode === 'category' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Select Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          )}

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

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Create Flash Sale
            </button>
          </div>
        </form>
      </div>

      {/* Active Flash Sales */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">My Flash Sales</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {flashSales.map((sale) => (
              <li key={sale.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
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
                  <button
                    onClick={() => toggleFlashSale(sale.id, sale.is_active)}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      sale.is_active
                        ? 'text-red-700 bg-red-100 hover:bg-red-200'
                        : 'text-green-700 bg-green-100 hover:bg-green-200'
                    }`}
                  >
                    {sale.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
} 