'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import AddressSelectionModal from '@/components/AddressSelectionModal';
import { GiftIcon, CalendarIcon, UserIcon } from '@heroicons/react/24/outline';

interface GiftPurchase {
  id: string;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    delivery_fee: number;
    images: Array<{ image_url: string }>;
    owner: {
      id: string;
      full_name: string;
      store_settings: any;
    };
  };
  quantity: number;
  selected_size?: string;
  selected_color?: string;
  selected_variant_sku?: string;
  // gift_wrapping: boolean;
  // gift_message?: string;
  // gift_wrapping_fee: number;
  total_amount: number;
  currency: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export default function GiftPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponent();
  
  const [giftPurchase, setGiftPurchase] = useState<GiftPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  const linkCode = params.linkCode as string;

  useEffect(() => {
    if (linkCode) {
      fetchGiftPurchase();
    }
  }, [linkCode]);

  const fetchGiftPurchase = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/gift-purchase/${linkCode}`);
      const data = await response.json();

      if (response.ok) {
        setGiftPurchase(data.giftPurchase);
      } else {
        setError(data.error || 'Failed to load gift purchase');
      }
    } catch (err) {
      console.error('Error fetching gift purchase:', err);
      setError('Failed to load gift purchase');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (paymentMethod: string) => {
    if (!purchaserEmail || !purchaserName) {
      toast.error('Please fill in your details');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      setShowAddressModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/gift-purchase/${linkCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaserEmail,
          purchaserName,
          paymentMethod,
          deliveryAddress,
          deliveryMethod,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Gift purchase completed successfully!');
        // Redirect to payment processing or success page
        router.push(`/payment/success?orderId=${data.order.id}`);
      } else {
        toast.error(data.error || 'Failed to complete gift purchase');
      }
    } catch (error) {
      console.error('Error completing gift purchase:', error);
      toast.error('Failed to complete gift purchase');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    return 'Less than 1 hour remaining';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-16 sm:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error || !giftPurchase) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-16 sm:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 p-8 rounded-xl shadow-sm">
            <ErrorMessage message={error || 'Gift purchase not found'} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-16 sm:pt-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <GiftIcon className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gift Purchase</h1>
          <p className="text-gray-600">
            Someone has created a gift purchase link for you!
          </p>
        </div>

        {/* Gift Info */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">From</p>
                  <p className="font-medium text-gray-900">{giftPurchase.purchaser_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <div className="text-right">
                  <p className="text-sm text-gray-500">Expires</p>
                  <p className="font-medium text-gray-900">{formatDate(giftPurchase.expires_at)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⏰ {getTimeRemaining(giftPurchase.expires_at)}
              </p>
            </div>
          </div>

          {/* Product Details */}
          <div className="p-6">
            <div className="flex gap-6">
              {/* Product Image */}
              <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {giftPurchase.product.images && giftPurchase.product.images.length > 0 ? (
                  <img
                    src={giftPurchase.product.images[0].image_url}
                    alt={giftPurchase.product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <GiftIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {giftPurchase.product.title}
                </h2>
                <p className="text-gray-600 mb-4">{giftPurchase.product.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quantity:</span>
                    <span className="text-gray-900">{giftPurchase.quantity}</span>
                  </div>
                  {giftPurchase.selected_size && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size:</span>
                      <span className="text-gray-900">{giftPurchase.selected_size}</span>
                    </div>
                  )}
                  {giftPurchase.selected_color && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Color:</span>
                      <span className="text-gray-900">{giftPurchase.selected_color}</span>
                    </div>
                  )}
                  {/* {giftPurchase.gift_wrapping && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gift Wrapping:</span>
                      <span className="text-gray-900">✓ Included</span>
                    </div>
                  )} */}
                </div>

                {/* {giftPurchase.gift_message && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">Gift Message:</span> {giftPurchase.gift_message}
                    </p>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Form */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Complete Your Purchase</h3>
            
            <div className="space-y-6">
              {/* Purchaser Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="purchaserName" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="purchaserName"
                    value={purchaserName}
                    onChange={(e) => setPurchaserName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="purchaserEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Email *
                  </label>
                  <input
                    type="email"
                    id="purchaserEmail"
                    value={purchaserEmail}
                    onChange={(e) => setPurchaserEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Delivery Method
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="delivery"
                      checked={deliveryMethod === 'delivery'}
                      onChange={(e) => setDeliveryMethod(e.target.value as 'delivery' | 'pickup')}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Home Delivery (ETB {giftPurchase.product.delivery_fee?.toFixed(2) || '0.00'})</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="pickup"
                      checked={deliveryMethod === 'pickup'}
                      onChange={(e) => setDeliveryMethod(e.target.value as 'delivery' | 'pickup')}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Store Pickup (Free)</span>
                  </label>
                </div>
              </div>

              {/* Delivery Address for Home Delivery */}
              {deliveryMethod === 'delivery' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Address
                  </label>
                  {deliveryAddress ? (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900">{deliveryAddress.city}</p>
                      <p className="text-sm text-gray-600">{deliveryAddress.subCity}</p>
                      <p className="text-sm text-gray-600">
                        Wereda {deliveryAddress.wereda}, Kebele {deliveryAddress.kebele}
                      </p>
                      {deliveryAddress.houseNo && (
                        <p className="text-sm text-gray-600">House No: {deliveryAddress.houseNo}</p>
                      )}
                      <button
                        onClick={() => setShowAddressModal(true)}
                        className="text-sm text-green-600 hover:text-green-700 mt-2"
                      >
                        Change Address
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddressModal(true)}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                    >
                      + Add Delivery Address
                    </button>
                  )}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Price Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product Price:</span>
                    <span className="text-gray-900">ETB {(giftPurchase.product.price * giftPurchase.quantity).toFixed(2)}</span>
                  </div>
                  {giftPurchase.product.delivery_fee > 0 && deliveryMethod === 'delivery' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee:</span>
                      <span className="text-gray-900">ETB {giftPurchase.product.delivery_fee.toFixed(2)}</span>
                    </div>
                  )}
                  {/* {giftPurchase.gift_wrapping_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gift Wrapping:</span>
                      <span className="text-gray-900">ETB {giftPurchase.gift_wrapping_fee.toFixed(2)}</span>
                    </div>
                  )} */}
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-gray-900">ETB {giftPurchase.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Button */}
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={!purchaserName || !purchaserEmail || (deliveryMethod === 'delivery' && !deliveryAddress)}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Purchase
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <PaymentMethodModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSelectMethod={async (methodId) => {
            await handlePurchase(methodId);
          }}
          isProcessing={false}
          sellers={[{
            sellerId: giftPurchase.product.owner.id,
            sellerName: giftPurchase.product.owner.full_name,
            products: [{
              id: giftPurchase.product.id,
              title: giftPurchase.product.title,
              price: giftPurchase.product.price,
              quantity: giftPurchase.quantity,
              owner: giftPurchase.product.owner,
              delivery_method: 'delivery' as const,
              delivery_address: deliveryAddress,
              selected_size: giftPurchase.selected_size,
              selected_color: giftPurchase.selected_color,
              selected_variant_sku: giftPurchase.selected_variant_sku
            }],
            subtotal: giftPurchase.product.price * giftPurchase.quantity,
            total: giftPurchase.total_amount,
            platformFee: 0,
            serviceFee: 0,
            ethiopiaTax: 0,
            deliveryFee: giftPurchase.product.delivery_fee || 0
          }]}
        />
      )}

      {/* Address Selection Modal */}
      <AddressSelectionModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        currentAddress={deliveryAddress}
        onAddressSelect={(address) => {
          setDeliveryAddress(address);
          setShowAddressModal(false);
        }}
      />
    </div>
  );
}
