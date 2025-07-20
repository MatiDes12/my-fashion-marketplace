'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  BoltIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  FireIcon
} from '@heroicons/react/24/outline';

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
  creator: {
    id: string;
    full_name: string;
    store_settings: {
      name: string;
      email: string;
    };
  };
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
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
          creator:users!flash_sales_created_by_fkey (
            id,
            full_name,
            store_settings,
            email
          ),
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

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('All flash sales:', data);
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        toast.error('You must be logged in to create a flash sale');
        return;
      }

      // Get the user's store information
      const { data: userData, error: storeError } = await supabase
        .from('users')
        .select('id, store_settings')
        .eq('id', user.id)
        .single();

      if (storeError) throw storeError;

      // Insert flash sale with both created_by and store_id
      const { data: flashSale, error: flashSaleError } = await supabase
        .from('flash_sales')
        .insert({
          ...formData,
          created_by: user.id,
          store_id: user.id,  // Set store_id to the creator's ID
          store_name: userData?.store_settings?.name || ''
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
      setShowCreateForm(false);
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

  const deleteFlashSale = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flash_sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Flash sale deleted successfully');
      fetchFlashSales();
    } catch (error) {
      console.error('Error deleting flash sale:', error);
      toast.error('Failed to delete flash sale');
    }
  };

  // Calculate statistics
  const stats = {
    total: flashSales.length,
    active: flashSales.filter(s => s.is_active).length,
    upcoming: flashSales.filter(s => new Date(s.start_time) > new Date()).length,
    expired: flashSales.filter(s => new Date(s.end_time) < new Date()).length,
  };

  // Filter flash sales
  const filteredFlashSales = flashSales.filter(sale => {
    const matchesSearch = !searchTerm || 
      sale.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.creator?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.creator?.store_settings?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && sale.is_active) ||
      (statusFilter === 'inactive' && !sale.is_active) ||
      (statusFilter === 'upcoming' && new Date(sale.start_time) > new Date()) ||
      (statusFilter === 'expired' && new Date(sale.end_time) < new Date());
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (sale: FlashSale) => {
    if (!sale.is_active) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (new Date(sale.start_time) > new Date()) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (new Date(sale.end_time) < new Date()) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (sale: FlashSale) => {
    if (!sale.is_active) return 'Inactive';
    if (new Date(sale.start_time) > new Date()) return 'Upcoming';
    if (new Date(sale.end_time) < new Date()) return 'Expired';
    return 'Active';
  };

  const getStatusIcon = (sale: FlashSale) => {
    if (!sale.is_active) return <PauseIcon className="h-4 w-4" />;
    if (new Date(sale.start_time) > new Date()) return <ClockIcon className="h-4 w-4" />;
    if (new Date(sale.end_time) < new Date()) return <XCircleIcon className="h-4 w-4" />;
    return <CheckCircleIcon className="h-4 w-4" />;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Flash Sales</h1>
            <p className="text-gray-600">Create and manage lightning-fast promotional campaigns</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Flash Sale
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Campaigns"
          value={stats.total}
          icon={<BoltIcon className="h-6 w-6" />}
          color="orange"
          description="All flash sales"
        />
        <StatCard
          title="Active Now"
          value={stats.active}
          icon={<FireIcon className="h-6 w-6" />}
          color="red"
          description="Currently running"
        />
        <StatCard
          title="Upcoming"
          value={stats.upcoming}
          icon={<ClockIcon className="h-6 w-6" />}
          color="blue"
          description="Scheduled to start"
        />
        <StatCard
          title="Expired"
          value={stats.expired}
          icon={<XCircleIcon className="h-6 w-6" />}
          color="gray"
          description="Past campaigns"
        />
      </div>

      {/* Create Flash Sale Form */}
      {showCreateForm && (
        <div className="bg-white shadow-xl rounded-xl border border-gray-200 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
            <h2 className="text-lg font-semibold text-gray-900">Create New Flash Sale</h2>
            <p className="text-sm text-gray-600">Set up a lightning-fast promotional campaign</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Enter campaign title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount Percentage</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                placeholder="Describe your flash sale campaign..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="datetime-local"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">ETB</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Products</label>
                <select
                  multiple
                  value={selectedProducts}
                  onChange={(e) => setSelectedProducts(
                    Array.from(e.target.selectedOptions, option => option.value)
                  )}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                >
                  {availableProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.title} - {formatCurrency(product.price)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="free_shipping"
                checked={formData.free_shipping}
                onChange={(e) => setFormData({ ...formData, free_shipping: e.target.checked })}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="free_shipping" className="ml-2 block text-sm text-gray-900">
                Enable Free Shipping
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <BoltIcon className="h-4 w-4 mr-2" />
                Create Flash Sale
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search flash sales by title, description, or seller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flash Sales Grid */}
      <div className="space-y-6">
        {filteredFlashSales.length === 0 ? (
          <div className="text-center py-12">
            <BoltIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No flash sales found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No flash sales have been created yet.'
              }
            </p>
          </div>
        ) : (
          filteredFlashSales.map((sale) => (
            <div key={sale.id} className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-red-400 flex items-center justify-center">
                      <BoltIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{sale.title}</h3>
                      <p className="text-sm text-gray-500">{sale.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(sale)}`}>
                      {getStatusIcon(sale)}
                      <span className="ml-1">{getStatusText(sale)}</span>
                    </span>
                  </div>
                </div>

                {/* Campaign Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
                    <TagIcon className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">{sale.discount_percentage}% OFF</p>
                      <p className="text-xs text-orange-600">Discount</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {format(new Date(sale.start_time), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-blue-600">Start Date</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                    <CalendarIcon className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-purple-900">
                        {format(new Date(sale.end_time), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-purple-600">End Date</p>
                    </div>
                  </div>
                  
                  {sale.free_shipping && (
                    <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                      <TruckIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Free Shipping</p>
                        <p className="text-xs text-green-600">Included</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Seller Information */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        <span className="font-medium">Seller:</span> {sale.creator?.full_name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <BuildingStorefrontIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        <span className="font-medium">Store:</span> {sale.creator?.store_settings?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <EnvelopeIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        <span className="font-medium">Email:</span> {sale.creator?.store_settings?.email || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleFlashSale(sale.id, sale.is_active)}
                      className={`inline-flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-md ${
                        sale.is_active
                          ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                          : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      {sale.is_active ? (
                        <>
                          <PauseIcon className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this flash sale?')) {
                        deleteFlashSale(sale.id);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// StatCard component
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'orange': return 'bg-orange-50 border-orange-200 text-orange-600';
      case 'red': return 'bg-red-50 border-red-200 text-red-600';
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-600';
      case 'gray': return 'bg-gray-50 border-gray-200 text-gray-600';
      default: return 'bg-orange-50 border-orange-200 text-orange-600';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{value.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <div className={`flex-shrink-0 ml-4 p-3 rounded-lg border ${getColorClasses(color)}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
} 