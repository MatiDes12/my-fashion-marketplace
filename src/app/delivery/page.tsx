'use client';

import { useEffect, useState } from 'react';
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
    product: {
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

  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    // Check if delivery account is stored in session storage
    const storedAccount = sessionStorage.getItem('deliveryAccount');
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

      // Fetch deliveries for this delivery person
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('delivery_tracking')
        .select(`
          *,
          order:orders(
            id,
            user_id,
            total_price,
            delivery_address,
            delivery_method,
            pickup_code,
            product_id,
            quantity,
            users!inner(full_name, email, phone),
            product:products(
              id,
              title,
              description,
              price
            )
          ),
          delivery_account:delivery_accounts(
            id,
            delivery_person_name,
            phone_number
          )
        `)
        .eq('delivery_account_id', deliveryAccount.id)
        .order('assigned_at', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      setDeliveries(deliveriesData || []);
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

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type must be JPEG, PNG, or GIF');
      }

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `delivery-proofs/${fileName}`;

      console.log('Attempting to upload to:', filePath);

      // Upload image to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('delivery-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL using the correct method
      const publicUrl = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(filePath).data.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log('Upload successful, public URL:', publicUrl);
      return publicUrl;

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
    sessionStorage.removeItem('deliveryAccount');
    router.push('/delivery/login');
  };

  if (!deliveryAccount) {
    return <LoadingSpinner />;
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Delivery Dashboard</h1>
                <p className="text-lg text-gray-600">Welcome back, <span className="font-semibold text-green-600">{deliveryAccount.name}</span></p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Deliveries</h3>
                <p className="text-3xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Assigned</h3>
                <p className="text-3xl font-bold text-yellow-600">
                  {deliveries.filter(d => d.status === 'assigned').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">In Transit</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {deliveries.filter(d => d.status === 'in_transit').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Delivered</h3>
                <p className="text-3xl font-bold text-green-600">
                  {deliveries.filter(d => d.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Deliveries List */}
        <div className="bg-white shadow-xl rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900">
                  Your Deliveries ({deliveries.length})
                </h3>
              </div>
            </div>
          </div>
          <div className="p-6">
            {deliveries.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No deliveries assigned</h3>
                <p className="mt-2 text-gray-500">You'll see your deliveries here once they're assigned to you.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">
                              Order #{delivery.order.id.slice(0, 8)}
                            </h4>
                            <p className="text-sm text-gray-500">
                              Assigned: {new Date(delivery.assigned_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            ${delivery.order.total_price}
                          </p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                            delivery.status === 'picked_up' ? 'bg-yellow-100 text-yellow-800' :
                            delivery.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {delivery.status === 'delivered' ? '✅ DELIVERED' : delivery.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Customer Information */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Customer Information
                            </h5>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-900">{delivery.order.users.full_name}</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="h-4 w-4 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-600">{delivery.order.users.email}</span>
                              </div>
                              {delivery.order.users.phone && (
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              Product Information
                            </h5>
                            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                              <div className="flex items-start">
                                <svg className="h-4 w-4 text-blue-500 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <div className="text-sm text-blue-900">
                                  <p className="font-semibold">{delivery.order.product.title}</p>
                                  <p className="text-xs text-blue-700 mt-1 line-clamp-2">{delivery.order.product.description}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-blue-600">
                                      Quantity: {delivery.order.quantity}
                                    </span>
                                    <span className="text-xs font-medium text-blue-800">
                                      ${delivery.order.product.price} each
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
                                <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Pickup Code
                              </h5>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-800">
                                  <span className="font-semibold">Code:</span> 
                                  <span className="font-mono font-bold text-lg ml-2 text-yellow-900">{delivery.order.pickup_code}</span>
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">Use this code when collecting the order</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delivery Address */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Delivery Address
                          </h5>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            {(() => {
                              try {
                                const address = JSON.parse(delivery.order.delivery_address);
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-start">
                                      <svg className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <div className="text-sm text-blue-900">
                                        <p className="font-medium">{address.houseNo} {address.landmark || ''}</p>
                                        <p>{address.city}, {address.subCity}</p>
                                        <p>Wereda: {address.wereda}, Kebele: {address.kebele}</p>
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
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex justify-end">
                          {delivery.status === 'delivered' ? (
                            <div className="flex items-center space-x-2">
                              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-green-600 font-medium">Delivery Completed</span>
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
                              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg"
                            >
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Update Status
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
            <div className="relative top-10 mx-auto p-0 border w-full max-w-md shadow-2xl rounded-xl bg-white">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Update Delivery Status
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
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      Delivery Status
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
                      Delivery Notes
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
                      {selectedDelivery?.status === 'delivered' ? 'Already Delivered' : 'Update Status'}
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