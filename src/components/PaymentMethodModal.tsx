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
import { MpesaService } from '@/lib/mpesa';
import { generateUniquePickupCode } from '@/utils/pickupCode';

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
  mpesa_settings?: {
    is_active: boolean;
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
    delivery_method?: 'home_delivery' | 'store_pickup' | 'delivery' | 'pickup';
    delivery_address?: any;
    selected_size?: string | null;
    selected_color?: string | null;
    selected_variant_sku?: string | null;
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
    name: 'Telebirr (Coming Soon)',
    logo: '/images/payment-methods/Telebirr-logo.png',
    isAvailable: false,
    description: 'Coming soon - Pay directly with your Telebirr mobile wallet'
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
    name: 'Commercial Bank of Ethiopia (Coming Soon)',
    logo: '/images/payment-methods/cbe-logo.png',
    isAvailable: false,
    description: 'Coming soon - Pay with CBE'
  },
  {
    id: 'AMOLE',
    name: 'Amole (Coming Soon)',
    logo: 'camole-logo.png',
    isAvailable: false,
    description: 'Coming soon - Pay with Amole'
  },
  {
    id: 'CASH',
    name: 'Cash on Delivery/Pickup',
    logo: '/images/payment-methods/cash-icon.jpg',
    isAvailable: true,
    description: 'Pay with cash when your order is delivered or during pickup'
  },
  {
    id: 'MPESA',
    name: 'M-PESA (Coming Soon)',
    logo: '/images/payment-methods/mpesa-logo.png',
    isAvailable: false,
    description: 'Coming soon - Pay with M-PESA mobile money'
  },
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
    .select(`
      delivery_method, 
      delivery_address, 
      delivery_fee,
      selected_size,
      selected_color,
      selected_variant_sku
    `)
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (error) throw error;
  return data;
};

// Add this function at the top of the component
const updateProductQuantities = async (
  productId: string, 
  orderQuantity: number,
  selectedSize?: string | null,
  selectedColor?: string | null,
  selectedSku?: string | null
) => {
  const supabase = createClientComponent();

  // Get current product data
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('quantity, available_variants')
    .eq('id', productId)
    .single();

  if (fetchError) throw fetchError;

  // Update main quantity
  const newQuantity = Math.max(0, (product.quantity || 0) - orderQuantity);

  // Update variant quantity if applicable
  let newVariants = product.available_variants || [];
  if (selectedSku && Array.isArray(newVariants)) {
    newVariants = newVariants.map((variant: any) => {
      if (variant.sku === selectedSku) {
        return {
          ...variant,
          quantity: Math.max(0, (variant.quantity || 0) - orderQuantity)
        };
      }
      return variant;
    });
  }

  // Update product
  const { error: updateError } = await supabase
    .from('products')
    .update({
      quantity: newQuantity,
      available_variants: newVariants
    })
    .eq('id', productId);

  if (updateError) throw updateError;
};

// Add this validation function
const validateOrderData = (sellers: SellerOrder[]) => {
  for (const seller of sellers) {
    // Validate totals
    if (seller.subtotal <= 0) throw new Error('Invalid subtotal amount');
    if (seller.total <= 0) throw new Error('Invalid total amount');
    if (seller.serviceFee < 0) throw new Error('Invalid service fee');
    if (seller.platformFee < 0) throw new Error('Invalid platform fee');
    if (seller.deliveryFee < 0) throw new Error('Invalid delivery fee');
    if (seller.ethiopiaTax < 0) throw new Error('Invalid tax amount');

    // Validate products
    for (const product of seller.products) {
      if (product.quantity <= 0) throw new Error('Invalid product quantity');
      if (product.price <= 0) throw new Error('Invalid product price');
    }
  }
  return true;
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
  console.log('Sellers products:', sellers.map(seller => seller.products));

  // Get available payment methods for the seller
  const getAvailablePaymentMethods = () => {
    if (!sellers || sellers.length === 0) return [];

    // Get the first seller's payment settings
    const seller = sellers[0];
    const paymentSettings = seller.products[0]?.owner?.payment_settings;

    console.log('Payment Settings:', paymentSettings); // Add this for debugging

    // Return all payment methods, but mark only Cash and Chapa as available
    return paymentMethods.filter(method => 
      method.id === 'CASH' || method.id === 'CHAPA'
    );
  };

  // Get the available payment methods
  const availablePaymentMethods = getAvailablePaymentMethods();

  const handleSubmit = async () => {
    try {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

      // Validate order data before proceeding
      try {
        validateOrderData(sellers);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Invalid order data');
      return;
    }

    if (selectedMethod === 'CASH') {
      try {
        setLocalProcessing(true);
        const supabase = createClientComponent();
        const txRef = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Get customer's store settings to access their phone number
          const { data: customerData, error: customerError } = await supabase
            .from('users')
            .select('store_settings')
            .eq('id', userDetails?.id)
            .single();

          if (customerError) {
            console.error('Error fetching customer data:', customerError);
          }

          const customerPhone = customerData?.store_settings?.phone || null;

        // Process each seller's orders
        for (const seller of sellers) {
          for (const product of seller.products) {
            // Generate unique tx_ref for each variant
            const variantSuffix = product.selected_variant_sku 
              ? `-${product.selected_variant_sku.replace(/[^a-zA-Z0-9]/g, '')}` 
              : product.selected_size 
                ? `-${product.selected_size.replace(/[^a-zA-Z0-9]/g, '')}` 
                : product.selected_color 
                  ? `-${product.selected_color.replace(/[^a-zA-Z0-9]/g, '')}` 
                  : '-default';
            
            const uniqueTxRef = `${txRef}${variantSuffix}`;

            // Check for active flash sale for this product
            const { data: flashSaleData, error: flashSaleError } = await supabase
              .from('flash_sale_products')
              .select(`
                special_price,
                flash_sales!inner (
                  id,
                  title,
                  discount_percentage,
                  start_time,
                  end_time,
                  is_active
                )
              `)
                .eq('product_id', product.id)
              .eq('flash_sales.is_active', true)
              .gte('flash_sales.end_time', new Date().toISOString())
              .lte('flash_sales.start_time', new Date().toISOString())
                .single();

            // Determine pricing with proper decimal handling
            const originalPrice = Number(product.price);
            const flashSalePrice = flashSaleData?.special_price ? Number(flashSaleData.special_price) : null;
            const hasFlashSale = flashSalePrice !== null && flashSalePrice < originalPrice;
            const actualPrice = hasFlashSale ? flashSalePrice : originalPrice;
            
            // Calculate amounts with proper decimal handling
            const itemSubtotal = Number((product.quantity * actualPrice).toFixed(2));
            const serviceFee = Number((itemSubtotal * 0.03).toFixed(2)); // 3% service fee
            const itemDeliveryFee = Number(seller.deliveryFee || 0);
            const itemTotal = Number((itemSubtotal + itemDeliveryFee).toFixed(2));
            const sellerPayoutAmount = Number((itemTotal - serviceFee).toFixed(2));

              // Update product quantities first
              await updateProductQuantities(
                product.id,
                product.quantity,
              product.selected_size,
              product.selected_color,
              product.selected_variant_sku
              );
            
            // Add debug logging
            console.log('Creating order with delivery method:', product.delivery_method);
            console.log('Will generate pickup code:', product.delivery_method === 'pickup' || product.delivery_method === 'store_pickup');

            // Create order with product data
            const pickupCode = product.delivery_method === 'pickup' || product.delivery_method === 'store_pickup' 
              ? await generateUniquePickupCode()
              : null;

            console.log('Generated pickup code:', pickupCode);

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
                payment_reference: uniqueTxRef,
                tx_ref: uniqueTxRef,
                receipt_url: `/api/receipts/cash/${uniqueTxRef}`,
                delivery_method: product.delivery_method === 'delivery' || product.delivery_method === 'home_delivery' 
                  ? 'home_delivery' 
                  : 'store_pickup',
                delivery_address: product.delivery_address,
                selected_size: product.selected_size,
                selected_color: product.selected_color,
                selected_variant_sku: product.selected_variant_sku,
                pickup_code: pickupCode
              })
              .select()
              .single();

            if (orderError) throw orderError;

            // Create transaction with flash sale information
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
                  customer_phone: customerPhone,
                seller_payout_amount: sellerPayoutAmount,
                seller_payout_status: 'pending',
                platform_payout_status: 'pending',
                flash_sale_applied: hasFlashSale,
                original_price: hasFlashSale ? originalPrice : null,
                flash_sale_price: hasFlashSale ? flashSalePrice : null,
                flash_sale_discount_percentage: hasFlashSale && flashSaleData?.flash_sales?.[0]?.discount_percentage 
                  ? flashSaleData.flash_sales[0].discount_percentage 
                  : null,
                flash_sale_title: hasFlashSale && flashSaleData?.flash_sales?.[0]?.title 
                  ? flashSaleData.flash_sales[0].title 
                  : null
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
        
        // Redirect to receipt page first - use the first order's tx_ref for the main redirect
        const firstOrderTxRef = sellers[0]?.products[0]?.selected_variant_sku 
          ? `${txRef}-${sellers[0].products[0].selected_variant_sku.replace(/[^a-zA-Z0-9]/g, '')}` 
          : sellers[0]?.products[0]?.selected_size 
            ? `${txRef}-${sellers[0].products[0].selected_size.replace(/[^a-zA-Z0-9]/g, '')}` 
            : sellers[0]?.products[0]?.selected_color 
              ? `${txRef}-${sellers[0].products[0].selected_color.replace(/[^a-zA-Z0-9]/g, '')}` 
              : `${txRef}-default`;
        
        window.location.href = `/api/receipts/cash/${firstOrderTxRef}?redirect=/orders?payment_success=true%26tx_ref=${firstOrderTxRef}`;

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

      /* Commented out Telebirr payment handling
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
      */

      /* Commented out M-PESA payment handling
      if (selectedMethod === 'MPESA') {
    try {
      setLocalProcessing(true);
      const supabase = createClientComponent();
          const txRef = `MPESA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create orders first
      for (const seller of sellers) {
        for (const product of seller.products) {
              const cartItemDetails = await getCartItemDetails(userDetails?.id!, product.id);
          
          const itemSubtotal = product.quantity * product.price;
          const serviceFee = itemSubtotal * 0.03;
          const itemDeliveryFee = cartItemDetails.delivery_fee || 0;
          const itemTotal = itemSubtotal + itemDeliveryFee;

              // Map the delivery method to match the constraint
              const mappedDeliveryMethod = cartItemDetails.delivery_method === 'delivery' 
                ? 'home_delivery' 
                : 'store_pickup';

              // Create order
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
              tx_ref: txRef,
              payment_status: 'pending',
              order_status: 'pending',
                  delivery_method: mappedDeliveryMethod,
              delivery_address: cartItemDetails.delivery_address,
            })
            .select()
            .single();

          if (orderError) throw orderError;

              // Create transaction with payment_method
          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              order_id: order.id,
                  payment_method: 'MPESA',
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
                  customer_phone: phoneNumber,
              seller_payout_amount: itemTotal - serviceFee
            });

          if (transactionError) throw transactionError;
            }
          }

          // Initiate M-PESA payment
          const totalAmount = sellers.reduce((sum, seller) => 
            sum + seller.total, 0
          );

          // Format phone number for sandbox (should be Ethiopian number format)
          const formattedPhone = phoneNumber.startsWith('+251') 
            ? phoneNumber.substring(1) 
            : phoneNumber.startsWith('251') 
              ? phoneNumber 
              : `251${phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber}`;

          // First initiate the STK push
          const mpesaResponse = await MpesaService.initiateSTKPush(
            formattedPhone,
            totalAmount,
            txRef
          );

          if (mpesaResponse.ResponseCode === '0') {
            // Store payment info
            localStorage.setItem('pendingPayment', JSON.stringify({
              tx_ref: txRef,
              amount: totalAmount,
              items: sellers
            }));

            // Clear cart
            if (userDetails?.id) {
              await clearCart(userDetails.id);
            }

            toast.success('Please check your phone for the M-PESA prompt');
            onClose();
          } else {
            throw new Error(mpesaResponse.ResponseDescription);
          }
        } catch (error) {
          console.error('M-PESA payment error:', error);
          toast.error(error instanceof Error ? error.message : 'Payment failed');
        } finally {
          setLocalProcessing(false);
        }
      }
      */

    // Handle other payment methods...
    try {
      await onSelectMethod(selectedMethod);
      onClose();
      } catch (error) {
        console.error('Payment error:', error);
        setError(error instanceof Error ? error.message : 'Payment failed');
      }
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
        sum + seller.total, 0
      );
      const txRef = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const supabase = createClientComponent();

      // Get customer's store settings to access their phone number
      const { data: customerData, error: customerError } = await supabase
        .from('users')
        .select('store_settings')
        .eq('id', userDetails.id)
        .single();

      if (customerError) {
        console.error('Error fetching customer data:', customerError);
      }

      const customerPhone = customerData?.store_settings?.phone || null;

      // Clean up expired orders first
      const { error: cleanupError } = await supabase
        .from('temporary_orders')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (cleanupError) {
        console.error('Error cleaning up expired orders:', cleanupError);
      }

      // Store order data in temporary_orders table
      console.log('Processing sellers:', sellers.length);
      for (const seller of sellers) {
        console.log('Processing seller:', seller.sellerName, 'with products:', seller.products.length);
        for (const product of seller.products) {
          console.log('Processing product:', product.title, 'with variant:', {
            selected_size: product.selected_size,
            selected_color: product.selected_color,
            selected_variant_sku: product.selected_variant_sku
          });
          
          // Use the product data directly instead of trying to match cart items
          const itemSubtotal = product.quantity * product.price;
          const serviceFee = itemSubtotal * 0.03;
          const itemDeliveryFee = seller.deliveryFee || 0;
          const itemTotal = itemSubtotal + itemDeliveryFee;
            
          console.log('Creating temporary order for product:', {
            productId: product.id,
            quantity: product.quantity,
            total: itemTotal,
            variant: {
              size: product.selected_size,
              color: product.selected_color,
              sku: product.selected_variant_sku
            }
          });

          // Create temporary order for this product
          const { error: tempOrderError } = await supabase
            .from('temporary_orders')
            .insert({
              tx_ref: txRef,
              user_id: userDetails.id,
              product_id: product.id,
              quantity: product.quantity,
              total_price: itemTotal,
              platform_fee: 0,
              service_fee: serviceFee,
              ethiopia_tax: 0,
              delivery_fee: itemDeliveryFee,
              delivery_method: product.delivery_method === 'delivery' ? 'home_delivery' : 'store_pickup',
              delivery_address: product.delivery_address,
              selected_size: product.selected_size,
              selected_color: product.selected_color,
              selected_variant_sku: product.selected_variant_sku,
              customer_phone: customerPhone,
              seller_id: product.owner.id,
              expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
            });

          if (tempOrderError) {
            console.error('Error creating temporary order:', tempOrderError);
            throw tempOrderError;
          }
        }
      }

      // Initialize Chapa payment
      const response = await fetch('/api/payments/chapa/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount.toString(),
          email: userDetails.email,
          full_name: userDetails.full_name,
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
        // Close modal
        onClose();

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
      <Dialog as="div" className="fixed inset-0 z-[100] mt-16 sm:mt-0" onClose={onClose}>
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

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-y-auto rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 max-h-[calc(100vh-8rem)]">
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
                            <div 
                              key={`${product.id}-${product.selected_variant_sku || 'default'}-${product.selected_size || 'default'}-${product.selected_color || 'default'}`} 
                              className="flex justify-between items-center"
                            >
                              <div>
                                <span className="font-medium">
                                  {product.title}
                                  {product.selected_variant_sku && (
                                    <span className="text-sm text-gray-500 ml-2">
                                      ({product.selected_variant_sku})
                                    </span>
                                  )}
                                </span>
                                <p className="text-sm text-gray-500">
                                  Quantity: {product.quantity}
                                  {(product.selected_size || product.selected_color) && (
                                    <span>
                                      {product.selected_size && ` | Size: ${product.selected_size}`}
                                      {product.selected_color && ` | Color: ${product.selected_color}`}
                                    </span>
                                  )}
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
                              if (method.isAvailable) {
                              setSelectedMethod(method.id);
                              setError('');
                              }
                            }}
                            className={`flex items-center p-4 border rounded-lg ${
                              selectedMethod === method.id 
                                ? 'border-blue-500 bg-blue-50' 
                                : method.isAvailable 
                                  ? 'border-gray-200 hover:border-blue-200'
                                  : 'border-gray-200 opacity-75 cursor-not-allowed'
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
                              <div className="flex items-center gap-2">
                              <h3 className="font-medium">{method.name}</h3>
                                {!method.isAvailable && (
                                  <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
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