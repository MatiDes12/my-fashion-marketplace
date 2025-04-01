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

interface Product {
  id: string;
  quantity: number;
  price: number;
  owner: {
    id: string;
    store_settings?: {
      phone?: string;
    };
  };
  delivery_method: 'home_delivery' | 'store_pickup';
  delivery_address: any; // Or create a proper type for the address
}

interface SellerProduct {
  id: string;
  title: string;
  price: number;
  quantity: number;
  owner: {
    id: string;
    full_name: string;
    store_settings?: {
      name?: string;
      phone?: string;
    };
    payment_settings?: PaymentSettings;
  };
}

interface SellerOrder {
  sellerId: string;
  sellerName: string;
  products: {
    id: string;
    title: string;
    price: number;
    quantity: number;
    images?: any[];
    delivery_method: 'home_delivery' | 'store_pickup';
    delivery_address: any;
    owner: {
      id: string;
      full_name: string;
      store_settings?: {
        name?: string;
        phone?: string;
      };
      payment_settings?: PaymentSettings;
    };
  }[];
  subtotal: number;
  total: number;
  platformFee: number;
  serviceFee: number;
  ethiopiaTax: number;
  deliveryFee: number;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'TELEBIRR',
    name: 'Telebirr',
    logo: '/images/payment-methods/Telebirr-logo.png',
    isAvailable: true,
    description: 'Pay directly with your Telebirr mobile wallet'
  },
  {
    id: 'CHAPA',
    name: 'Chapa',
    logo: '/images/payment-methods/chapa-logo.png',
    isAvailable: true,
    description: 'Pay with bank transfer, mobile money, or cards'
  },
  {
    id: 'CBE',
    name: 'Commercial Bank of Ethiopia',
    logo: '/images/payment-methods/cbe-logo.png', // Add this image to your public folder
    isAvailable: false
  },
  {
    id: 'AMOLE',
    name: 'Amole',
    logo: 'camole-logo.png', // Add this image to your public folder
    isAvailable: false
  },
  {
    id: 'CASH',
    name: 'Cash on Delivery/Pickup',
    logo: '/images/payment-methods/cash-icon.jpg', // Add this icon to your public folder
    isAvailable: true,
    description: 'Pay with cash when your order is delivered or during pickup'
  }
];

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (methodId: PaymentMethodType, phoneNumber?: string) => Promise<void>;
  isProcessing: boolean;
  sellers: SellerOrder[];
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.avrioxshop.com/';

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

// Add this function at the top level
const pollPaymentStatus = async (txRef: string, maxAttempts = 10) => {
  console.log('[PAYMENT POLLING] Starting payment status polling for:', txRef);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`/api/payments/chapa/verify?tx_ref=${txRef}`);
      const data = await response.json();
      
      console.log(`[PAYMENT POLLING] Attempt ${i + 1}:`, data);
      
      if (data.status === 'success') {
        console.log('[PAYMENT POLLING] Payment verified successfully');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
    } catch (error) {
      console.error('[PAYMENT POLLING] Error:', error);
    }
  }
  
  return false;
};

// Add this function at the top level
const getCartItemDetails = async (userId: string, productId: string) => {
  const supabase = createClientComponent();
  const { data, error } = await supabase
    .from('cart_items')
    .select('delivery_method, delivery_address, delivery_fee')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (error) throw error;
  return data;
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
    const paymentSettings = seller.products[0]?.owner?.payment_settings;

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

    if (selectedMethod === 'CASH') {
      try {
        setLocalProcessing(true);
        const supabase = createClientComponent();
        const txRef = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Process each seller's orders
        for (const seller of sellers) {
          for (const product of seller.products) {
            // Get delivery info from cart_items
            const cartItemDetails = await getCartItemDetails(userDetails?.id!, product.id);
            
            const itemSubtotal = product.quantity * product.price;
            const serviceFee = itemSubtotal * 0.03;
            const itemDeliveryFee = cartItemDetails.delivery_fee || 0;
            const itemTotal = itemSubtotal + itemDeliveryFee;

            // Create order with cart delivery info
            const { data: order, error: orderError } = await supabase
              .from('orders')
              .insert({
                user_id: userDetails?.id,
                product_id: product.id,
                quantity: product.quantity,
                total_price: itemTotal,
                platform_fee: 0,
                service_fee: serviceFee,
                ethiopia_tax: 0,
                delivery_fee: itemDeliveryFee,
                order_status: 'confirmed',
                payment_status: 'pending',
                payment_reference: txRef,
                tx_ref: txRef,
                receipt_url: `/api/receipts/cash/${txRef}`,
                delivery_method: cartItemDetails.delivery_method === 'delivery' ? 'home_delivery' : 'store_pickup',
                delivery_address: cartItemDetails.delivery_address,
              })
              .select()
              .single();

            if (orderError) throw orderError;

            // Create transaction with pending status
            const { error: transactionError } = await supabase
              .from('transactions')
              .insert({
                order_id: order.id,
                payment_method: 'CASH',
                payment_status: 'pending',
                subtotal: itemSubtotal,
                platform_fee: 0,
                service_fee: serviceFee,
                vat_amount: 0,
                delivery_fee: itemDeliveryFee,
                total_amount: itemTotal,
                seller_id: product.owner.id,
                customer_name: userDetails?.full_name,
                customer_email: userDetails?.email,
                customer_phone: product.owner.store_settings?.phone || null,
                seller_payout_amount: itemTotal - serviceFee,
                seller_payout_status: 'pending',
                platform_payout_status: 'pending'
              });

            if (transactionError) throw transactionError;
          }
        }

        // Clear cart after successful order creation
        if (userDetails?.id) {
          await clearCart(userDetails.id);
        }

        // Close modal
        onClose();
        toast.success('Order placed successfully! Please prepare cash for delivery/pickup.');
        
        // Redirect to receipt page first
        window.location.href = `/api/receipts/cash/${txRef}?redirect=/orders?payment_success=true%26tx_ref=${txRef}`;

      } catch (error) {
        console.error('Order creation error:', error);
        setError(error instanceof Error ? error.message : 'Failed to create order');
      } finally {
        setLocalProcessing(false);
      }
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
          for (const product of seller.products) {
            await updateProductQuantity(product.id, product.quantity);
          }
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
      const totalAmount = sellers.reduce((sum, seller) => 
        sum + seller.subtotal + seller.deliveryFee, 0
      );
      const txRef = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const supabase = createClientComponent();

      // Create orders first
      for (const seller of sellers) {
        for (const product of seller.products) {
          // Get delivery info from cart_items
          const cartItemDetails = await getCartItemDetails(userDetails.id, product.id);
          
          const itemSubtotal = product.quantity * product.price;
          const serviceFee = itemSubtotal * 0.03;
          const itemDeliveryFee = cartItemDetails.delivery_fee || 0;
          const itemTotal = itemSubtotal + itemDeliveryFee;

          // First create the order
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: userDetails.id,
              product_id: product.id,
              quantity: product.quantity,
              total_price: itemTotal,
              platform_fee: 0,
              service_fee: serviceFee,
              ethiopia_tax: 0,
              delivery_fee: itemDeliveryFee,
              tx_ref: txRef,
              payment_status: 'pending',
              order_status: 'pending',
              payment_reference: null,
              receipt_url: null,
              delivery_method: cartItemDetails.delivery_method === 'delivery' ? 'home_delivery' : 'store_pickup',
              delivery_address: cartItemDetails.delivery_address,
            })
            .select()
            .single();

          if (orderError) throw orderError;

          // Then create the transaction
          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              order_id: order.id,
              payment_method: 'CHAPA',
              payment_status: 'pending',
              subtotal: itemSubtotal,
              platform_fee: 0,
              service_fee: serviceFee,
              vat_amount: 0,
              delivery_fee: itemDeliveryFee,
              total_amount: itemTotal,
              seller_id: product.owner.id,
              customer_name: userDetails.full_name,
              customer_email: userDetails.email,
              customer_phone: product.owner.store_settings?.phone || null,
              seller_payout_amount: itemTotal - serviceFee
            });

          if (transactionError) throw transactionError;
        }
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
          return_url: `${window.location.origin}/api/payments/chapa/callback?trx_ref=${txRef}&status=success`,
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
          items: sellers
        }));

        // Close modal and clear cart
        onClose();
        if (userDetails?.id) {
          await clearCart(userDetails.id);
        }

        // Redirect to Chapa checkout
        window.location.href = data.data.checkout_url;
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
                      <div key={seller.sellerId} className="mb-4 border rounded-lg p-4">
                        {seller.sellerName && (
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Seller: {seller.sellerName}
                          </p>
                        )}
                        
                        {/* Products list */}
                        <div className="space-y-2 mb-4">
                          {seller.products.map((product) => (
                            <div key={product.id} className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">
                                  {product.title}
                                </span>
                                <p className="text-sm text-gray-500">
                                  Quantity: {product.quantity}
                                </p>
                              </div>
                              <span className="text-gray-600">
                                ETB {(product.price * product.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Fee breakdown */}
                        <div className="space-y-1 text-sm border-t pt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subtotal</span>
                            <span>ETB {seller.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Platform Fee</span>
                            <span>ETB 0.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Service Fee</span>
                            <span>ETB 0.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">VAT</span>
                            <span>ETB 0.00</span>
                          </div>
                          {seller.deliveryFee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Delivery Fee</span>
                              <span>ETB {seller.deliveryFee.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t font-medium">
                            <span>Total</span>
                            <span>ETB {(seller.subtotal + seller.deliveryFee).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between font-medium text-lg">
                        <span>Grand Total</span>
                        <span>ETB {sellers.reduce((sum, seller) => 
                          sum + seller.subtotal + seller.deliveryFee, 0
                        ).toFixed(2)}</span>
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