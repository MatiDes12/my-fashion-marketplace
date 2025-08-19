'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SharedCartPaymentModal from '@/components/SharedCartPaymentModal';
import AddressSelectionModal from '@/components/AddressSelectionModal';
import { ShareIcon, UserIcon, CalendarIcon, GiftIcon } from '@heroicons/react/24/outline';

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
  // gift_wrapping?: boolean;
  // gift_message?: string;
  // gift_wrapping_fee?: number;
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
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-16 sm:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedCart) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-16 sm:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 p-8 rounded-xl shadow-sm">
            <ErrorMessage message={error || 'Shared cart not found'} />
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
            <ShareIcon className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shared Shopping Cart</h1>
          <p className="text-gray-600">
            {sharedCart.cart_data.sender.name} has shared their cart with you!
          </p>
        </div>

        {/* Cart Info */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">From</p>
                  <p className="font-medium text-gray-900">{sharedCart.cart_data.sender.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <div className="text-right">
                  <p className="text-sm text-gray-500">Expires</p>
                  <p className="font-medium text-gray-900">{formatDate(sharedCart.expires_at)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⏰ {getTimeRemaining(sharedCart.expires_at)}
              </p>
            </div>
          </div>

          {/* Cart Items */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cart Items ({sharedCart.cart_data.totalItems})</h2>
            
            <div className="space-y-4">
              {sharedCart.cart_data.items.map((item, index) => (
                <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GiftIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600">ETB {item.price.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    {item.selected_size && (
                      <p className="text-sm text-gray-500">Size: {item.selected_size}</p>
                    )}
                    {item.selected_color && (
                      <p className="text-sm text-gray-500">Color: {item.selected_color}</p>
                    )}
                    {/* {item.gift_wrapping && (
                      <p className="text-sm text-green-600">🎁 Gift Wrapped</p>
                    )} */}
                    {item.seller && (
                      <p className="text-sm text-gray-500">Seller: {item.seller}</p>
                    )}
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ETB {(item.price * item.quantity).toFixed(2)}
                    </p>
                    {/* {item.gift_wrapping_fee && item.gift_wrapping_fee > 0 && (
                      <p className="text-sm text-gray-500">
                        +ETB {item.gift_wrapping_fee.toFixed(2)} wrapping
                      </p>
                    )} */}
                  </div>
                </div>
              ))}
            </div>

            {/* Message */}
            {sharedCart.cart_data.message && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Message from {sharedCart.cart_data.sender.name}:</span><br />
                  "{sharedCart.cart_data.message}"
                </p>
              </div>
            )}
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
                    <span className="text-sm text-gray-700">Home Delivery</span>
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
                    <span className="text-sm text-gray-700">Store Pickup</span>
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
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">ETB {sharedCart.cart_data.totalValue.toFixed(2)}</span>
                  </div>
                  {/* <div className="flex justify-between">
                    <span className="text-gray-600">Gift Wrapping:</span>
                    <span className="text-gray-900">
                      ETB {sharedCart.cart_data.items.reduce((sum, item) => sum + (item.gift_wrapping_fee || 0), 0).toFixed(2)}
                    </span>
                  </div> */}
                  {deliveryMethod === 'delivery' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee:</span>
                      <span className="text-gray-900">ETB 300.00</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-gray-900">
                                              ETB {(
                        sharedCart.cart_data.totalValue + 
                        // sharedCart.cart_data.items.reduce((sum, item) => sum + (item.gift_wrapping_fee || 0), 0) +
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
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Purchase
              </button>
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
            // sharedCart.cart_data.items.reduce((sum, item) => sum + (item.gift_wrapping_fee || 0), 0) +
            (deliveryMethod === 'delivery' ? 300 : 0)
          }
          subtotal={sharedCart.cart_data.totalValue}
          giftWrappingFee={0} // sharedCart.cart_data.items.reduce((sum, item) => sum + (item.gift_wrapping_fee || 0), 0)}
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
      />
    </div>
  );
}
