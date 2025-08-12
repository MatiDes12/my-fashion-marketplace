'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/utils/translations';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

type DeliveryTracking = {
  id: string;
  order_id: string;
  delivery_account_id: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  assigned_at: string;
  picked_up_at?: string;
  delivered_at?: string;
  delivery_notes?: string;
  proof_images?: string[];
  order: {
    id: string;
    user_id: string;
    total_price: number;
    delivery_address: string;
    delivery_method: string;
    pickup_code?: string;
    product_id: string;
    quantity: number;
    users: {
      full_name: string;
      email: string;
      phone: string;
    };
    products: {
      id: string;
      title: string;
      description: string;
      price: number;
    };
  };
  delivery_account: {
    id: string;
    delivery_person_name: string;
    phone_number: string;
  };
};

type DeliveryAccount = {
  id: string;
  name: string;
  phone: string;
};

function DeliveryDashboard() {
  const { language } = useLanguage();
  const [deliveries, setDeliveries] = useState<DeliveryTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTracking | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    delivery_notes: '',
    proof_images: [] as string[]
  });
  const [deliveryAccount, setDeliveryAccount] = useState<DeliveryAccount | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showDeliveryProofNotification, setShowDeliveryProofNotification] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const router = useRouter();
  const supabase = createClientComponent();

  // Tab configuration
  const tabs = [
    { 
      id: 'all', 
      label: 'All Deliveries', 
      count: deliveries.length,
      icon: '📦',
      color: 'gray'
    },
    { 
      id: 'assigned', 
      label: 'Assigned', 
      count: deliveries.filter(d => d.status === 'assigned').length,
      icon: '⏰',
      color: 'amber'
    },
    { 
      id: 'picked_up', 
      label: 'Picked Up', 
      count: deliveries.filter(d => d.status === 'picked_up').length,
      icon: '📥',
      color: 'blue'
    },
    { 
      id: 'in_transit', 
      label: 'In Transit', 
      count: deliveries.filter(d => d.status === 'in_transit').length,
      icon: '🚚',
      color: 'blue'
    },
    { 
      id: 'delivered', 
      label: 'Delivered', 
      count: deliveries.filter(d => d.status === 'delivered').length,
      icon: '✅',
      color: 'emerald'
    },
    { 
      id: 'failed', 
      label: 'Failed', 
      count: deliveries.filter(d => d.status === 'failed').length,
      icon: '❌',
      color: 'red'
    },
  ];

  // Filter deliveries based on active tab
  const filteredDeliveries = activeTab === 'all' 
    ? deliveries 
    : deliveries.filter(delivery => delivery.status === activeTab);

  useEffect(() => {
    // Get delivery account from cookies
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const storedAccount = getCookie('deliveryAccount');
    if (!storedAccount) {
      router.push('/delivery/login');
      return;
    }

    try {
      const account = JSON.parse(storedAccount);
      setDeliveryAccount(account);
    } catch (error) {
      console.error('Error parsing delivery account:', error);
      router.push('/delivery/login');
    }
  }, [router]);

  const fetchDeliveries = async () => {
    if (!deliveryAccount) return;

    try {
      setLoading(true);

      // Fetch deliveries using the API endpoint
      const response = await fetch('/api/delivery/get-deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          deliveryAccountId: deliveryAccount.id 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deliveries');
      }

      setDeliveries(data.deliveries || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      setError('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deliveryAccount) {
      fetchDeliveries();
    }
  }, [deliveryAccount]);

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);

      if (!selectedDelivery) {
        throw new Error('No delivery selected');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('deliveryId', selectedDelivery.id);

      const response = await fetch('/api/delivery/upload-proof', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDelivery || !deliveryAccount) return;

    try {
      // Check if delivery proof is required
      const isMarkingDelivered = updateData.status === 'delivered';
      const isPickupOrder = selectedDelivery.order.delivery_method === 'store_pickup';

      // Only require image for delivery orders being marked as delivered
      if (isMarkingDelivered && !selectedImage && !selectedDelivery.proof_images?.length) {
        setShowDeliveryProofNotification(true);
        return;
      }

      let proofImages = selectedDelivery.proof_images || [];

      // Upload image if selected
      if (isMarkingDelivered && selectedImage) {
        const imageUrl = await handleImageUpload(selectedImage);
        proofImages = [...proofImages, imageUrl];
      }

      const response = await fetch('/api/delivery/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryId: selectedDelivery.id,
          status: updateData.status,
          deliveryNotes: updateData.delivery_notes,
          deliveryAccountId: deliveryAccount.id,
          proofImages: proofImages
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }

      toast.success('Delivery status updated successfully!');
      setShowUpdateModal(false);
      setSelectedDelivery(null);
      setUpdateData({ status: '', delivery_notes: '', proof_images: [] });
      setSelectedImage(null);
      setImagePreview(null);
      fetchDeliveries();
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast.error('Failed to update delivery status');
    }
  };

  const handleLogout = async () => {
    // Clear the delivery account cookie
    document.cookie = 'deliveryAccount=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    router.push('/delivery/login');
  };

  if (!deliveryAccount) {
    return <LoadingSpinner />;
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{translations['delivery.dashboardTitle'][language]}</h1>
                <p className="text-sm sm:text-base text-gray-600">Welcome back, <span className="font-semibold text-emerald-600">{deliveryAccount.name}</span></p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 border border-red-200 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-sm"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {translations['delivery.logout'][language]}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500">Total</h3>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 border-l-4 border-amber-500 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500">Assigned</h3>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-600">
                  {deliveries.filter(d => d.status === 'assigned').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500">In Transit</h3>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">
                  {deliveries.filter(d => d.status === 'in_transit').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 border-l-4 border-emerald-500 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500">Delivered</h3>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-600">
                  {deliveries.filter(d => d.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Deliveries List */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {translations['delivery.yourDeliveries'][language]} ({filteredDeliveries.length})
                </h3>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <div className="px-4 sm:px-6">
              <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const colorClasses = {
                    gray: isActive ? 'bg-gray-100 text-gray-700 border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                    amber: isActive ? 'bg-amber-100 text-amber-700 border-amber-200' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
                    blue: isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
                    emerald: isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
                    red: isActive ? 'bg-red-100 text-red-700 border-red-200' : 'text-red-600 hover:text-red-700 hover:bg-red-50',
                  };

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap border ${
                        isActive
                          ? `${colorClasses[tab.color as keyof typeof colorClasses]} shadow-sm`
                          : `${colorClasses[tab.color as keyof typeof colorClasses]} border-transparent`
                      }`}
                    >
                      <span className="flex items-center space-x-1 sm:space-x-2">
                        <span className="text-sm sm:text-base">{tab.icon}</span>
                        <span>{tab.label}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          isActive
                            ? tab.color === 'gray' ? 'bg-gray-200 text-gray-800' :
                              tab.color === 'amber' ? 'bg-amber-200 text-amber-800' :
                              tab.color === 'blue' ? 'bg-blue-200 text-blue-800' :
                              tab.color === 'emerald' ? 'bg-emerald-200 text-emerald-800' :
                              'bg-red-200 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {tab.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {filteredDeliveries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeTab === 'all' 
                    ? 'No deliveries assigned' 
                    : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} deliveries`
                  }
                </h3>
                <p className="text-gray-500">
                  {activeTab === 'all' 
                    ? "You'll see your deliveries here once they're assigned to you."
                    : `No deliveries are currently ${activeTab.replace('_', ' ')}.`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {filteredDeliveries.map((delivery) => (
                  <div key={delivery.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                              Order #{delivery.order.id.slice(0, 8)}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-500">
                              Assigned: {new Date(delivery.assigned_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:text-right space-y-2">
                          <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                            ETB {delivery.order.total_price?.toFixed(2) || '0.00'}
                          </p>
                          <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                            delivery.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                            delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                            delivery.status === 'picked_up' ? 'bg-amber-100 text-amber-800' :
                            delivery.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {delivery.status === 'delivered' ? '✅ DELIVERED' : delivery.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 sm:px-6 py-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Customer Information */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                              <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center mr-2">
                                <svg className="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              Customer Information
                            </h5>
                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-900 truncate">{delivery.order.users.full_name}</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-600 truncate">{delivery.order.users.email}</span>
                              </div>
                              {delivery.order.users.phone && (
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-2 sm:mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{delivery.order.users.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Information */}
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center mr-2">
                                <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              </div>
                              Product Information
                            </h5>
                            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 space-y-2">
                              <div className="flex items-start">
                                <svg className="h-4 w-4 text-blue-500 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <div className="text-sm text-blue-900 min-w-0 flex-1">
                                  <p className="font-semibold truncate">{delivery.order.products.title}</p>
                                  <p className="text-xs text-blue-700 mt-1 line-clamp-2">{delivery.order.products.description}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-blue-600">
                                      Qty: {delivery.order.quantity}
                                    </span>
                                    <span className="text-xs font-medium text-blue-800">
                                      ETB {delivery.order.products.price} each
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pickup Code */}
                          {delivery.order.pickup_code && (
                            <div>
                              <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                                <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center mr-2">
                                  <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                  </svg>
                                </div>
                                Pickup Code
                              </h5>
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                                <p className="text-sm text-amber-800">
                                  <span className="font-semibold">Code:</span> 
                                  <span className="font-mono font-bold text-base sm:text-lg ml-2 text-amber-900">{delivery.order.pickup_code}</span>
                                </p>
                                <p className="text-xs text-amber-700 mt-1">Use this code when collecting the order</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delivery Address */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center mr-2">
                              <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            Delivery Address
                          </h5>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            {(() => {
                              try {
                                const address = JSON.parse(delivery.order.delivery_address);
                                
                                // Extract street address from character keys (0, 1, 2, etc.)
                                const streetAddressParts = [];
                                let i = 0;
                                while (address[i] !== undefined) {
                                  streetAddressParts.push(address[i]);
                                  i++;
                                }
                                const streetAddress = streetAddressParts.join('');
                                
                                // Build the full address
                                const addressParts = [
                                  address.houseNo && `House No. ${address.houseNo}`,
                                  streetAddress,
                                  address.landmark && `Near: ${address.landmark}`,
                                  address.kebele && `Kebele ${address.kebele}`,
                                  address.wereda && `Wereda ${address.wereda}`,
                                  address.subCity,
                                  address.city
                                ].filter(Boolean);
                                
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-start">
                                      <svg className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <div className="text-sm text-blue-900 space-y-1">
                                        {addressParts.map((part, index) => (
                                          <p key={index} className="text-xs">
                                            {part}
                                          </p>
                                        ))}
                                        {address.mapLink && (
                                          <a
                                            href={address.mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-900 text-xs inline-flex items-center mt-2 font-medium"
                                          >
                                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View on Map
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              } catch {
                                return (
                                  <div className="flex items-start">
                                    <svg className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="text-sm text-blue-900">{delivery.order.delivery_address}</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-200">
                        <div className="flex justify-end">
                          {delivery.status === 'delivered' ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <span className="text-emerald-600 font-medium text-sm sm:text-base">Delivery Completed</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedDelivery(delivery);
                                setUpdateData({
                                  status: delivery.status,
                                  delivery_notes: delivery.delivery_notes || '',
                                  proof_images: delivery.proof_images || []
                                });
                                setShowUpdateModal(true);
                              }}
                              className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-lg text-white bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {translations['delivery.updateStatus'][language]}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Update Status Modal */}
        {showUpdateModal && selectedDelivery && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-4 sm:top-10 mx-auto p-0 border w-full max-w-md shadow-2xl rounded-xl bg-white">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                       {translations['delivery.updateStatus'][language]}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowUpdateModal(false);
                      setSelectedDelivery(null);
                      setUpdateData({ status: '', delivery_notes: '', proof_images: [] });
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="px-6 py-6">
                <form onSubmit={handleStatusUpdate}>
                  {/* Add Image Upload Section for Delivery Orders */}
                  {(selectedDelivery?.order.delivery_method === 'home_delivery' || updateData.status === 'delivered') && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Delivery Proof Image
                        {updateData.status === 'delivered' && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          {imagePreview || (selectedDelivery?.proof_images?.[0] || '') ? (
                            <div className="relative">
                              <img
                                src={imagePreview || (selectedDelivery?.proof_images?.[0] || '')}
                                alt="Delivery Proof"
                                className="mx-auto h-32 w-auto object-contain"
                              />
                              {updateData.status !== 'delivered' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedImage(null);
                                    setImagePreview(null);
                                  }}
                                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {(updateData.status !== 'delivered' || !imagePreview) && (
                                <>
                                  <div className="flex text-sm text-gray-600">
                                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                      <span>Upload a file</span>
                                      <input
                                        type="file"
                                        className="sr-only"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                      />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    PNG, JPG, GIF up to 10MB
                                  </p>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {translations['delivery.statusLabel'][language]}
                    </label>
                    <select
                      value={updateData.status}
                      onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      required
                      disabled={selectedDelivery?.status === 'delivered'}
                    >
                      <option value="">Select Status</option>
                      <option value="assigned">📋 Assigned</option>
                      <option value="picked_up">📦 Picked Up</option>
                      <option value="in_transit">🚚 In Transit</option>
                      <option value="delivered">✅ Delivered</option>
                      <option value="failed">❌ Failed</option>
                    </select>
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {translations['delivery.notesLabel'][language]}
                    </label>
                    <textarea
                      value={updateData.delivery_notes}
                      onChange={(e) => setUpdateData({ ...updateData, delivery_notes: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm resize-none"
                      placeholder="Add any notes about the delivery, customer feedback, or delivery issues..."
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUpdateModal(false);
                        setSelectedDelivery(null);
                        setUpdateData({ status: '', delivery_notes: '', proof_images: [] });
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={selectedDelivery?.status === 'delivered'}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 shadow-lg ${
                        selectedDelivery?.status === 'delivered'
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700'
                      }`}
                    >
                      {selectedDelivery?.status === 'delivered' ? translations['delivery.alreadyDelivered'][language] : translations['delivery.updateStatus'][language]}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Proof Notification */}
        {showDeliveryProofNotification && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      Delivery Proof Required
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Please upload a delivery proof image before marking this order as delivered. This helps ensure proper delivery confirmation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDeliveryProofNotification(false)}
                    className="inline-flex justify-center rounded-md border border-transparent bg-orange-100 px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliveryDashboard; 