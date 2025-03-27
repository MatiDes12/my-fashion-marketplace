'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { CartItem } from '@/types/cart';
import PaymentMethodSelector from './PaymentMethodSelector';
import { PAYMENT_METHODS } from '@/utils/constants';
import { getTelebirrConfig, TelebirrPayment } from '@/lib/telebirr';
import { useUserDetails } from '@/hooks/useUserDetails';
import { createClientComponent } from '@/lib/supabase';
import { isMobile } from '@/utils/deviceDetection';
import { useRouter } from 'next/navigation';

type PaymentMethodType = keyof typeof PAYMENT_METHODS;

interface PaymentMethod {
  id: PaymentMethodType;
  name: string;
  logo: string;
  isAvailable: boolean;
  description?: string;
}

interface PaymentSettings {
  telebirr_settings?: {
    is_active: boolean;
  };
  bank_settings?: {
    is_active: boolean;
  };
  cbe_birr_settings?: {
    is_active: boolean;
  };
  amole_settings?: {
    is_active: boolean;
  };
  chapa_settings?: {
    is_active: boolean;
    public_key?: string;
    secret_key?: string;
    callback_url?: string;
  };
}

interface SellerProduct {
  id: string;
  title: string;
  price: number;
  owner: {
    id: string;
    full_name: string;
    store_settings?: {
      name?: string;
    };
    payment_settings?: PaymentSettings;
  };
}

interface SellerOrder {
  sellerId: string;
  sellerName: string;
  product: SellerProduct;
  quantity: number;
  total: number;
  platformFee: number;
  serviceFee: number;
  ethiopiaTax: number;
  deliveryFee: number;
  // ... other fields
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'TELEBIRR',
    name: 'Telebirr',
    logo: '/images/telebirr-logo.png',
    isAvailable: true,
    description: 'Pay directly with your Telebirr mobile wallet'
  },
  {
    id: 'CHAPA',
    name: 'Chapa',
    logo: '/images/chapa-logo.png',
    isAvailable: true,
    description: 'Pay with bank transfer, mobile money, or cards'
  },
  {
    id: 'CBE',
    name: 'Commercial Bank of Ethiopia',
    logo: '/images/cbe-logo.png', // Add this image to your public folder
    isAvailable: false
  },
  {
    id: 'AMOLE',
    name: 'Amole',
    logo: '/images/amole-logo.png', // Add this image to your public folder
    isAvailable: false
  }
];

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (methodId: PaymentMethodType, phoneNumber?: string) => Promise<void>;
  isProcessing: boolean;
  sellers: SellerOrder[];
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const clearCart = async (userId: string) => {
  try {
    const supabase = createClientComponent();
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    // Trigger cart count update in the header
    window.dispatchEvent(new CustomEvent('cart-updated'));
  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
};

// Add this function to handle quantity updates
const updateProductQuantity = async (productId: string, orderedQuantity: number) => {
  const supabase = createClientComponent();
  
  try {
    // First get the current product quantity
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('quantity')
      .eq('id', productId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Calculate new quantity
    const newQuantity = Math.max(0, (product?.quantity || 0) - orderedQuantity);
    
    // Update the product quantity
    const { error: updateError } = await supabase
      .from('products')
      .update({ quantity: newQuantity })
      .eq('id', productId);
      
    if (updateError) throw updateError;
    
  } catch (error) {
    console.error('Error updating product quantity:', error);
    throw error;
  }
};

export default function PaymentMethodModal({
  isOpen,
  onClose,
  onSelectMethod,
  isProcessing,
  sellers
}: PaymentMethodModalProps) {
  const { userDetails } = useUserDetails();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpReference, setOtpReference] = useState<string | null>(null);
  const [step, setStep] = useState<'method' | 'phone' | 'otp'>('method');
  const [error, setError] = useState('');
  const [localProcessing, setLocalProcessing] = useState(false);
  const router = useRouter();

  // Add this console.log to see what data we're receiving
  console.log('Sellers data:', sellers);

  // Get available payment methods for the seller
  const getAvailablePaymentMethods = () => {
    if (!sellers || sellers.length === 0) return [];

    // Get the first seller's payment settings
    const seller = sellers[0];
    const paymentSettings = seller.product?.owner?.payment_settings;

    console.log('Payment Settings:', paymentSettings); // Add this for debugging

    return Object.values(PAYMENT_METHODS).filter(method => 
      method.id === 'CASH' || // Cash is always available
      (method.id === 'TELEBIRR' && paymentSettings?.telebirr_settings?.is_active) ||
      (method.id === 'CBE' && paymentSettings?.bank_settings?.is_active) ||
      (method.id === 'AMOLE' && paymentSettings?.amole_settings?.is_active) ||
      (method.id === 'CHAPA' && paymentSettings?.chapa_settings?.is_active)
    );
  };

  // Get the available payment methods
  const availablePaymentMethods = getAvailablePaymentMethods();

  const handleSubmit = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    if (selectedMethod === 'CHAPA') {
      try {
        await handleChapaPayment();
      } catch (error) {
        console.error('Payment error:', error);
        setError(error instanceof Error ? error.message : 'Payment failed');
      }
      return;
    }

    if (selectedMethod === 'TELEBIRR') {
      try {
        setLocalProcessing(true);
        const response = await fetch('/api/telebirr/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: sellers.reduce((sum, seller) => sum + seller.total, 0),
            description: `Order payment for ${sellers.length} seller(s)`,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to initialize payment');
        }

        // After successful payment (in both CHAPA and TELEBIRR cases)
        // Update product quantities
        for (const seller of sellers) {
          await updateProductQuantity(seller.product.id, seller.quantity);
        }
        
        // Clear cart after successful payment
        if (userDetails?.id) {
          await clearCart(userDetails.id);
        }

        // Redirect to Telebirr payment page
        window.location.href = data.paymentUrl;

      } catch (error) {
        console.error('Payment error:', error);
        setError(error instanceof Error ? error.message : 'Payment failed');
      } finally {
        setLocalProcessing(false);
      }
      return;
    }

    // Handle other payment methods...
    try {
      await onSelectMethod(selectedMethod);
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  const handleChapaPayment = async () => {
    try {
      if (!userDetails?.email) {
        throw new Error('Please login to continue with payment');
      }

      setLocalProcessing(true);
      const totalAmount = sellers.reduce((sum, seller) => sum + seller.total, 0);
      const txRef = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const supabase = createClientComponent();

      // Create orders first
      for (const seller of sellers) {
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: userDetails.id,
            product_id: seller.product.id,
            quantity: seller.quantity,
            total_price: seller.total,
            platform_fee: seller.platformFee,
            service_fee: seller.serviceFee,
            ethiopia_tax: seller.ethiopiaTax,
            delivery_fee: seller.deliveryFee,
            tx_ref: txRef,
            payment_status: 'pending',
            order_status: 'pending',
            payment_reference: null,
            receipt_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (orderError) throw orderError;
      }

      // Initialize Chapa payment
      const response = await fetch('/api/payments/chapa/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount.toString(),
          email: userDetails.email,
          tx_ref: txRef,
          callback_url: `${window.location.origin}/api/payments/chapa/callback`,
          return_url: `${window.location.origin}/orders?payment_success=true&tx_ref=${txRef}`,
          customization: {
            title: 'Order Payment',
            description: `Payment for order from ${sellers.length} sellers`
          }
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.data.checkout_url) {
        // Store payment info
        localStorage.setItem('pendingPayment', JSON.stringify({
          tx_ref: txRef,
          amount: totalAmount,
          items: sellers,
          checkout_url: data.data.checkout_url
        }));

        // Close modal first
        onClose();

        // Clear cart after storing order
        if (userDetails?.id) {
          await clearCart(userDetails.id);
        }

        if (isMobile()) {
          // Mobile: Open in new tab and show tracking
          const newWindow = window.open(data.data.checkout_url, '_blank');
          
          if (!newWindow) {
            const link = document.createElement('a');
            link.href = data.data.checkout_url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
          }

          setTimeout(() => {
            router.push(`/payment/mobile-tracking?tx_ref=${txRef}`);
          }, 100);
        } else {
          // Desktop: Use current window
          window.location.href = data.data.checkout_url;
          // No need to redirect to orders page as Chapa callback will handle it
        }
      } else {
        throw new Error(data.message || 'Payment initialization failed');
      }

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLocalProcessing(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    {step === 'method' ? 'Select Payment Method' : 
                     step === 'phone' ? 'Enter Phone Number' : 'Enter OTP Code'}
                  </Dialog.Title>

                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Order Summary</h4>
                    {sellers?.map((seller) => (
                      <div key={seller.product.id || 'temp-key'} className="mb-4 border rounded-lg p-4">
                        <div className="flex justify-between mb-2">
                          <div>
                            <span className="font-medium">
                              {seller?.product?.title || 'Product'}
                            </span>
                            <p className="text-sm text-gray-500">
                              Quantity: {seller?.quantity || 0}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subtotal</span>
                            <span>ETB {((seller?.quantity || 0) * (seller?.product?.price || 0)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Platform Fee (5%)</span>
                            <span>ETB {(seller?.platformFee || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Service Fee (2%)</span>
                            <span>ETB {(seller?.serviceFee || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">VAT (15%)</span>
                            <span>ETB {(seller?.ethiopiaTax || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Delivery Fee</span>
                            <span>ETB {(seller?.deliveryFee || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t font-medium">
                            <span>Total</span>
                            <span>ETB {(seller?.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between font-medium text-lg">
                        <span>Grand Total</span>
                        <span>ETB {sellers.reduce((sum, seller) => sum + seller.total, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {step === 'method' ? (
                    <>
                      <div className="grid grid-cols-1 gap-4">
                        {availablePaymentMethods.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => {
                              setSelectedMethod(method.id);
                              setError('');
                            }}
                            className={`flex items-center p-4 border rounded-lg ${
                              selectedMethod === method.id 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-blue-200'
                            }`}
                          >
                            <div className="w-12 h-12 relative mr-4">
                              <Image
                                src={method.logo}
                                alt={method.name}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{method.name}</h3>
                              {method.description && (
                                <p className="text-sm text-gray-500">{method.description}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      {error && (
                        <div className="mt-4 text-red-500">
                          {error}
                        </div>
                      )}
                      <div className="mt-6">
                        <button
                          onClick={handleSubmit}
                          disabled={!selectedMethod || isProcessing}
                          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Continue'}
                        </button>
                      </div>
                    </>
                  ) : step === 'phone' ? (
                    <div className="space-y-4">
                      <div>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            setError('');
                          }}
                          placeholder="e.g., 0911234567"
                          className="w-full px-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Enter your Telebirr registered phone number
                        </p>
                      </div>
                      {error && (
                        <div className="text-red-500">{error}</div>
                      )}
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => setStep('method')}
                          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!phoneNumber || isProcessing || localProcessing}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing || localProcessing ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value);
                            setError('');
                          }}
                          placeholder="Enter OTP code"
                          className="w-full px-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Enter the OTP code sent to {phoneNumber}
                        </p>
                      </div>
                      {error && (
                        <div className="text-red-500">{error}</div>
                      )}
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => setStep('phone')}
                          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!otpCode || isProcessing || localProcessing}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing || localProcessing ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 