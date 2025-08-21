'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SharedCartPaymentModal from '@/components/SharedCartPaymentModal';
import AddressSelectionModal from '@/components/AddressSelectionModal';
import { ShareIcon, UserIcon, CalendarIcon, GiftIcon, ArrowLeftIcon, ShoppingBagIcon, TruckIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface SharedCartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  selected_size?: string;
  selected_color?: string;
  selected_variant_sku?: string;
  delivery_method?: string;
  delivery_address?: any;
  image?: string;
  seller?: string;
}

interface SharedCart {
  id: string;
  share_code: string;
  user_id: string;
  recipient_email?: string;
  recipient_name?: string;
  message: string;
  cart_data: {
    sender: {
      name: string;
      email: string;
    };
    message: string;
    items: SharedCartItem[];
    totalItems: number;
    totalValue: number;
    sharedAt: string;
  };
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

export default function SharedCartPage() {
  const params = useParams();
  const router = useRouter();
  
  const [sharedCart, setSharedCart] = useState<SharedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  const shareCode = params.shareCode as string;

  useEffect(() => {
    if (shareCode) {
      fetchSharedCart();
    }
  }, [shareCode]);

  const fetchSharedCart = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cart/shared/${shareCode}`);
      const data = await response.json();

      if (response.ok) {
        setSharedCart(data.sharedCart);
      } else {
        setError(data.error || 'Failed to load shared cart');
      }
    } catch (err) {
      console.error('Error fetching shared cart:', err);
      setError('Failed to load shared cart');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = (data: any) => {
    // Redirect to receipt page
    if (data.baseTxRef) {
      window.location.href = `/api/receipts/${data.paymentMethod?.toLowerCase() || 'cash'}/${data.baseTxRef}?redirect=/orders?payment_success=true%26tx_ref=${data.baseTxRef}`;
    } else {
      router.push('/orders?payment_success=true');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your shared cart...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedCart) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShareIcon className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
            <p className="text-gray-600 mb-6">{error || 'Shared cart not found'}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header with back button */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Home
            </button>
            <div className="flex items-center space-x-2">
              <ShareIcon className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-gray-900">Shared Cart</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            <ShareIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Someone Shared Their Cart With You! 🎁
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            <span className="font-semibold text-blue-600">{sharedCart.cart_data.sender.name}</span> has carefully selected these items for you
          </p>
          
          {/* Cart Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <UserIcon className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">From</p>
              <p className="font-semibold text-gray-900">{sharedCart.cart_data.sender.name}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <ShoppingBagIcon className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Items</p>
              <p className="font-semibold text-gray-900">{sharedCart.cart_data.totalItems}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <CalendarIcon className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Expires</p>
              <p className="font-semibold text-gray-900">{formatDate(sharedCart.expires_at)}</p>
            </div>
          </div>

          {/* Expiry Warning */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4 max-w-md mx-auto">
            <p className="text-orange-800 font-medium">
              ⏰ {getTimeRemaining(sharedCart.expires_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ShoppingBagIcon className="h-6 w-6 mr-2 text-blue-600" />
                  Selected Items ({sharedCart.cart_data.totalItems})
                </h2>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {sharedCart.cart_data.items.map((item, index) => (
                    <div key={index} className="flex gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                      {/* Product Image */}
                      <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <GiftIcon className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">{item.title}</h3>
                        <p className="text-blue-600 font-medium">ETB {item.price.toFixed(2)}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <span>Qty: {item.quantity}</span>
                          {item.selected_size && <span>Size: {item.selected_size}</span>}
                          {item.selected_color && <span>Color: {item.selected_color}</span>}
                        </div>
                        {item.seller && (
                          <p className="text-sm text-gray-500 mt-1">Seller: {item.seller}</p>
                        )}
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                          ETB {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message */}
                {sharedCart.cart_data.message && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <p className="text-blue-900">
                      <span className="font-semibold">💌 Message from {sharedCart.cart_data.sender.name}:</span><br />
                      "{sharedCart.cart_data.message}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Purchase Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Complete Your Purchase</h3>
              </div>
              
              <div className="p-6">
                <div className="space-y-6">
                  {/* Purchaser Details */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="purchaserName" className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        id="purchaserName"
                        value={purchaserName}
                        onChange={(e) => setPurchaserName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="purchaserEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Email *
                      </label>
                      <input
                        type="email"
                        id="purchaserEmail"
                        value={purchaserEmail}
                        onChange={(e) => setPurchaserEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Delivery Method */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Delivery Method
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center p-3 border border-gray-200 rounded-xl hover:border-blue-300 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="delivery"
                          checked={deliveryMethod === 'delivery'}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'delivery' | 'pickup')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex items-center">
                          <TruckIcon className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="text-gray-700">Home Delivery</span>
                        </div>
                      </label>
                      <label className="flex items-center p-3 border border-gray-200 rounded-xl hover:border-blue-300 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="pickup"
                          checked={deliveryMethod === 'pickup'}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'delivery' | 'pickup')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                                                 <div className="ml-3 flex items-center">
                           <BuildingStorefrontIcon className="h-5 w-5 text-green-600 mr-2" />
                           <span className="text-gray-700">Store Pickup</span>
                         </div>
                      </label>
                    </div>
                  </div>

                  {/* Delivery Address for Home Delivery */}
                  {deliveryMethod === 'delivery' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Delivery Address
                      </label>
                      {deliveryAddress ? (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-sm text-gray-900 font-medium">{deliveryAddress.city}</p>
                          <p className="text-sm text-gray-600">{deliveryAddress.subCity}</p>
                          <p className="text-sm text-gray-600">
                            Wereda {deliveryAddress.wereda}, Kebele {deliveryAddress.kebele}
                          </p>
                          {deliveryAddress.houseNo && (
                            <p className="text-sm text-gray-600">House No: {deliveryAddress.houseNo}</p>
                          )}
                          <button
                            onClick={() => setShowAddressModal(true)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                          >
                            Change Address
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddressModal(true)}
                          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          + Add Delivery Address
                        </button>
                      )}
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Price Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900 font-medium">ETB {sharedCart.cart_data.totalValue.toFixed(2)}</span>
                      </div>
                      {deliveryMethod === 'delivery' && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery Fee:</span>
                          <span className="text-gray-900 font-medium">ETB 300.00</span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-2">
                        <div className="flex justify-between font-bold text-lg">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-blue-600">
                            ETB {(
                              sharedCart.cart_data.totalValue + 
                              (deliveryMethod === 'delivery' ? 300 : 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={!purchaserName || !purchaserEmail || (deliveryMethod === 'delivery' && !deliveryAddress)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Complete Purchase
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shared Cart Payment Modal */}
      {showPaymentModal && (
        <SharedCartPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onPaymentComplete={handlePaymentComplete}
          totalAmount={
            sharedCart.cart_data.totalValue + 
            (deliveryMethod === 'delivery' ? 300 : 0)
          }
          subtotal={sharedCart.cart_data.totalValue}
          giftWrappingFee={0}
          shareCode={shareCode}
          purchaserEmail={purchaserEmail}
          purchaserName={purchaserName}
          deliveryMethod={deliveryMethod}
          deliveryAddress={deliveryAddress}
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
        isGuest={true}
      />
    </div>
  );
}
