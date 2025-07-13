'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
  const [subscription, setSubscription] = useState<string>('basic');
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const router = useRouter();

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

  useEffect(() => {
    checkSubscriptionAndUsage();
  }, []);

  const checkSubscriptionAndUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Get user's subscription
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_plan')
        .eq('id', session.user.id)
        .single();

      const plan = userData?.subscription_plan || 'basic';
      setSubscription(plan);

      if (plan === 'basic') {
        toast.error('Flash sales require Pro or Enterprise subscription');
        router.push('/dashboard/marketing');
        return;
      }

      // If Pro, check monthly usage
      if (plan === 'pro') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: flashSales, error } = await supabase
          .from('flash_sales')
          .select('id')
          .eq('created_by', session.user.id)
          .gte('created_at', startOfMonth.toISOString());

        if (error) throw error;

        setMonthlyUsage(flashSales?.length || 0);

        if ((flashSales?.length || 0) >= 5) {
          toast.error('Monthly flash sales limit reached. Upgrade to Enterprise for unlimited flash sales.');
          router.push('/dashboard/marketing');
          return;
        }
      }

    } catch (error) {
      console.error('Error checking subscription:', error);
      toast.error('Failed to verify subscription status');
    } finally {
      setLoading(false);
    }
  };

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
    
    // Validation checks
    if (!formData.title.trim()) {
      toast.error('Please enter a flash sale title');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if (formData.discount_percentage <= 0 || formData.discount_percentage > 100) {
      toast.error('Please enter a valid discount percentage (1-100%)');
      return;
    }

    if (!formData.start_time) {
      toast.error('Please select a start time');
      return;
    }

    if (!formData.end_time) {
      toast.error('Please select an end time');
      return;
    }

    // Check if end time is after start time
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error('End time must be after start time');
      return;
    }

    // Check if products are selected based on selection mode
    let productsToInclude: Product[] = [];
    
    if (selectionMode === 'individual') {
      if (selectedProducts.length === 0) {
        toast.error('Please select at least one product');
        return;
      }
      productsToInclude = myProducts.filter(p => selectedProducts.includes(p.id));
    } else if (selectionMode === 'category') {
      if (!selectedCategory) {
        toast.error('Please select a category');
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)
        .eq('category', selectedCategory);
      productsToInclude = data || [];
      
      if (productsToInclude.length === 0) {
        toast.error('No products found in the selected category');
        return;
      }
    } else if (selectionMode === 'all') {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id);
      productsToInclude = data || [];
      
      if (productsToInclude.length === 0) {
        toast.error('No products found. Please add some products first.');
        return;
      }
    }
    
    if (subscription === 'pro' && monthlyUsage >= 5) {
      toast.error('Monthly flash sales limit reached. Upgrade to Enterprise for unlimited flash sales.');
      return;
    }

    try {
      if (!user) {
        toast.error('Please login to create a flash sale');
        return;
      }

      // Get the user's store information
      const { data: userData, error: storeError } = await supabase
        .from('users')
        .select('id, store_settings')
        .eq('id', user.id)
        .single();

      if (storeError) throw storeError;

      // Create flash sale with both created_by and store_id
      const { data: flashSale, error: flashSaleError } = await supabase
        .from('flash_sales')
        .insert({
          title: formData.title,
          description: formData.description,
          discount_percentage: formData.discount_percentage,
          min_order_amount: formData.min_order_amount || 0,
          free_shipping: formData.free_shipping,
          start_time: formData.start_time,
          end_time: formData.end_time,
          created_by: user.id,
          store_id: user.id,  // Set store_id to the creator's ID
          store_name: userData?.store_settings?.name || '',
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

      if (flashSaleProducts.length > 0) {
        const { error: productsError } = await supabase
          .from('flash_sale_products')
          .insert(flashSaleProducts);

        if (productsError) throw productsError;
      }

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

  const deleteFlashSale = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flash_sales')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the flash sales list after deletion
      fetchMyFlashSales();
      toast.success('Flash sale deleted successfully!');
    } catch (error) {
      console.error('Error deleting flash sale:', error);
      toast.error('Failed to delete flash sale');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-pink-600 to-red-700 py-16">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse"></div>
            <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-10 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-2000"></div>
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              ⚡ Flash Sales Manager
            </h1>
            <p className="text-xl text-red-100 mb-6 max-w-3xl mx-auto">
              Create and manage exciting flash sales to boost your sales and attract customers!
            </p>
            <div className="flex items-center justify-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">Boost Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Limited Time</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Subscription Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-red-500 to-pink-500 p-3 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
                  <p className="text-sm text-gray-600">
                    {subscription === 'pro' ? `Pro Plan - ${monthlyUsage}/5 flash sales used this month` : 'Enterprise Plan - Unlimited flash sales'}
                  </p>
                </div>
              </div>
              {subscription === 'pro' && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">{5 - monthlyUsage}</div>
                  <div className="text-sm text-gray-500">Remaining</div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Create Flash Sale Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-red-600 via-pink-600 to-red-700 p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">Create New Flash Sale</h2>
              <p className="text-red-100">Set up an exciting flash sale to boost your sales!</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sale Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                    placeholder="e.g., Summer Collection Flash Sale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                    placeholder="Brief description of your sale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount Percentage <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                      placeholder="0"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Order Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.min_order_amount}
                      onChange={(e) => setFormData({ ...formData, min_order_amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                      placeholder="0 (optional)"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">ETB</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Selection <span className="text-red-500">*</span></h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={selectionMode === 'individual'}
                        onChange={() => setSelectionMode('individual')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Select Individual Products</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={selectionMode === 'category'}
                        onChange={() => setSelectionMode('category')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Select by Category</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={selectionMode === 'all'}
                        onChange={() => setSelectionMode('all')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Select All Products</span>
                    </label>
                  </div>

                  {selectionMode === 'individual' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Products <span className="text-red-500">*</span>
                      </label>
                      <select
                        multiple
                        required
                        value={selectedProducts}
                        onChange={(e) => setSelectedProducts(
                          Array.from(e.target.selectedOptions, option => option.value)
                        )}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors min-h-[120px]"
                      >
                        {myProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.title} - ETB {product.price}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple products</p>
                    </div>
                  )}

                  {selectionMode === 'category' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectionMode === 'all' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-blue-700">
                          All your active products will be included in this flash sale automatically.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="free_shipping"
                  checked={formData.free_shipping}
                  onChange={(e) => setFormData({ ...formData, free_shipping: e.target.checked })}
                  className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="free_shipping" className="ml-3 block text-sm font-medium text-gray-900">
                  Enable Free Shipping
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-300 transform hover:scale-[1.02]"
              >
                Create Flash Sale
              </button>
            </form>
          </div>
        </motion.div>

        {/* My Flash Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">My Flash Sales</h2>
          <div className="space-y-6">
            {flashSales.map((sale, index) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300"
              >
                <div className={`p-6 ${sale.is_active ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500' : 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-400'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">{sale.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sale.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {sale.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {sale.description && (
                        <p className="text-gray-600 mb-4">{sale.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-semibold text-red-600">{sale.discount_percentage}% OFF</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {new Date(sale.start_time).toLocaleDateString()} - {new Date(sale.end_time).toLocaleDateString()}
                          </span>
                        </div>
                        {sale.free_shipping && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-green-600 font-medium">Free Shipping</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => toggleFlashSale(sale.id, sale.is_active)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          sale.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {sale.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteFlashSale(sale.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {flashSales.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="bg-white rounded-2xl shadow-lg p-12 max-w-2xl mx-auto">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">No Flash Sales Yet</h3>
                  <p className="text-gray-600 mb-8">Create your first flash sale to start boosting your sales and attracting customers!</p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
} 