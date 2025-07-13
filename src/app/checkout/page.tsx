'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { getFlashSalePrices } from '@/utils/flashSales';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { PaymentSettings as IPaymentSettings } from '@/types/cart';
import { PAYMENT_METHODS } from '@/utils/constants';
import { getTelebirrConfig, createOrder, applyFabricToken } from '@/lib/telebirr';
import React from 'react';

// Import or define PaymentMethodType
type PaymentMethodType = keyof typeof PAYMENT_METHODS;

interface ProductOwner {
  id: string;
  full_name: string;
  store_settings?: {
    name?: string;
  };
  payment_settings?: IPaymentSettings;
}

interface SellerOrder {
  sellerId: string;
  sellerName: string;
  product: {
    id: string;
    title: string;
    price: number;
    images?: { image_url: string; }[];
    owner: ProductOwner;
  };
  quantity: number;
  subtotal: number;
  platformFee: number;
  serviceFee: number;
  ethiopiaTax: number;
  deliveryFee: number;
  total: number;
  hasPaymentSettings: boolean;
}

interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  price: number;
  delivery_fee?: number;
  delivery_method?: 'delivery' | 'pickup';
  delivery_address?: {
    street?: string;
    city?: string;
    subCity?: string;
    wereda?: string;
    kebele?: string;
    houseNo?: string;
    [key: string]: string | undefined;
  };
  selected_size?: string;
  selected_color?: string;
  selected_variant_sku?: string;
  notes?: string;
  product: {
    id: string;
    title: string;
    price: number;
    delivery_fee?: number;
    images?: Array<{
      image_url: string;
    }>;
    owner?: {
      id: string;
      full_name: string;
      store_settings?: {
        name?: string;
      };
    };
  };
  flash_sale_price?: number;
}

interface Product {
  id: string;
  title: string;
  price: number;
  quantity: number;
  images?: Array<{
    image_url: string;
  }>;
  owner: ProductOwner;
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();
  const [selectedDeliveryMethods, setSelectedDeliveryMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});
  const [showTerms, setShowTerms] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(
            id,
            title,
            price,
            delivery_fee,
            delivery_options,
            shipping_info,
            delivery_time,
            images:product_images(*),
            owner:users(
              id,
              full_name,
              store_settings,
              payment_settings(*)
            )
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Get flash sale prices
      const productIds = data?.map(item => item.product.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);
      
      // Process items with flash sale prices
      const processedItems = data?.map(item => ({
        ...item,
        flash_sale_price: flashSalePrices[item.product.id]
      })) || [];
      
      setCartItems(processedItems);
      
      // Set delivery methods from cart
      const methods: Record<string, 'delivery' | 'pickup'> = {};
      processedItems.forEach(item => {
        // Default to delivery if available, otherwise pickup
        if (item.product.delivery_options?.delivery) {
          methods[item.id] = 'delivery';
        } else if (item.product.delivery_options?.pickup) {
          methods[item.id] = 'pickup';
        }
      });
      setSelectedDeliveryMethods(methods);

    } catch (err) {
      console.error('Error fetching cart:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const calculateFees = (items: CartItem[]) => {
    let subtotal = 0;
    let deliveryFee = 0;
    let serviceFee = 0; // Will remain 0
    let vat = 0; // Add VAT (at 0%)

    items.forEach(item => {
      const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
      subtotal += itemSubtotal;

      if (item.delivery_method === 'delivery') {
        deliveryFee += (item.delivery_fee || 0);
      }

      // Service fee is now 0% for customers
      serviceFee = 0;
      
      // VAT at 0%
      vat = 0;
    });

    const total = subtotal + deliveryFee + serviceFee + vat;

    return {
      subtotal,
      deliveryFee,
      serviceFee,
      vat,
      total
    };
  };

  const updateProductQuantities = async (items: CartItem[]) => {
    try {
      for (const item of items) {
        const { error: updateError } = await supabase.rpc('update_product_quantity', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });
        
        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating product quantities:', error);
      throw error;
    }
  };

  const validateCheckout = (items: CartItem[]) => {
    const missingDeliveryMethod = items.some(item => !item.delivery_method);
    if (missingDeliveryMethod) {
      toast.error('Please select delivery method for all items in cart');
      router.push('/cart');
      return false;
    }
    return true;
  };

  const validateCheckoutData = (items: CartItem[]) => {
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error('Invalid quantity for product: ' + item.product?.title);
      }
      
      const price = item.flash_sale_price || item.product.price;
      if (price <= 0) {
        throw new Error('Invalid price for product: ' + item.product?.title);
      }

      if (item.delivery_fee && item.delivery_fee < 0) {
        throw new Error('Invalid delivery fee for product: ' + item.product?.title);
      }
    }
    return true;
  };

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);

      // Validate checkout data
      try {
        validateCheckoutData(cartItems);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Invalid checkout data');
        return;
      }

      // Validate delivery methods
      if (!validateCheckout(cartItems)) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please login to complete checkout');
      }

      // First check if all products have sufficient quantity
      for (const item of cartItems) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();
          
        if (!product || product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product?.title || 'product'}`);
        }
      }

      const fees = calculateFees(cartItems);

      // Create orders and update quantities
      for (const item of cartItems) {
        const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
        const serviceFee = itemSubtotal * 0.03; // Calculate 3% service fee
        
        // Create order
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: session.user.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total_price: itemSubtotal,
            platform_fee: 0, // Set to 0 explicitly
            service_fee: serviceFee, // Store the 3% service fee
            ethiopia_tax: 0, // Set to 0 explicitly
            delivery_fee: item.delivery_method === 'delivery' ? (item.product.delivery_fee || 0) : 0,
            order_status: 'pending',
            delivery_method: item.delivery_method === 'delivery' ? 'home_delivery' : 'store_pickup',
            delivery_address: item.delivery_address,
            selected_size: item.selected_size,
            selected_color: item.selected_color,
            selected_variant_sku: item.selected_variant_sku
          });

        if (orderError) throw orderError;

        // Create transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            order_id: item.id, // Assuming you have the order ID
            subtotal: itemSubtotal, // Original product price * quantity
            platform_fee: 0, // Set to 0 explicitly
            service_fee: serviceFee, // Same 3% service fee as order
            vat_amount: 0, // Set to 0 explicitly
            delivery_fee: item.delivery_method === 'delivery' ? (item.product.delivery_fee || 0) : 0,
            total_amount: itemSubtotal + (item.delivery_method === 'delivery' ? (item.product.delivery_fee || 0) : 0)
          });

        if (transactionError) throw transactionError;

        // Update product quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({
            quantity: item.quantity
          })
          .eq('id', item.product_id)
          .neq('quantity', 0);

        if (updateError) throw updateError;
      }

      // Clear the cart
      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', session.user.id);

      if (clearCartError) {
        throw new Error('Failed to clear cart');
      }

      // Update UI
      window.dispatchEvent(new CustomEvent('cart-updated'));
      toast.success('Order placed successfully!');
      router.push('/orders');

    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodSelect = async (methodId: PaymentMethodType, phoneNumber?: string) => {
    try {
      if (methodId === 'TELEBIRR') {
        if (!phoneNumber) {
          throw new Error('Phone number is required for Telebirr payment');
        }

        // Process each seller's items
        for (const seller of sellers) {
          try {
            const paymentUrl = await createTelebirrOrder({
              title: `Order #${Date.now()}-${seller.sellerId.substring(0, 4)}`,
              amount: seller.total,
              sellerId: seller.sellerId,
              owner: seller.owner
            });

            // Redirect to payment page
            window.location.href = paymentUrl;
            return;
          } catch (error) {
            console.error('Payment error:', error);
            toast.error('Failed to initialize payment. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  const fees = calculateFees(cartItems);

  const calculateSellerTotals = (items: CartItem[]) => {
    const sellerGroups = items.reduce((acc, item) => {
      if (!item.product?.owner) return acc;
      
      const sellerId = item.product.owner.id;
      const sellerName = item.product.owner.store_settings?.name || item.product.owner.full_name;
      
      if (!acc[sellerId]) {
        acc[sellerId] = {
          sellerId,
          sellerName,
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          serviceFee: 0,
          vat: 0,
          total: 0,
          owner: item.product.owner,
          products: [] // Array to hold multiple products from same seller
        };
      }
      
      // Add the item to the seller's items and products array
      acc[sellerId].items.push(item);
      acc[sellerId].products.push({
        id: item.product.id,
        title: item.product.title,
        price: item.flash_sale_price || item.product.price,
        quantity: item.quantity,
        images: item.product.images,
        selected_size: item.selected_size,
        selected_color: item.selected_color,
        selected_variant_sku: item.selected_variant_sku,
        delivery_method: item.delivery_method,
        delivery_address: item.delivery_address,
        owner: item.product.owner
      });
      
      // Calculate prices
      const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
      acc[sellerId].subtotal += itemSubtotal;
      
      if (item.delivery_method === 'delivery') {
        acc[sellerId].deliveryFee += (item.delivery_fee || 0);
      }
      
      // Calculate total
      acc[sellerId].total = acc[sellerId].subtotal + acc[sellerId].deliveryFee;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(sellerGroups);
  };

  const sellers = calculateSellerTotals(cartItems);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Checkout Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Checkout</h1>
            <p className="mt-2 text-gray-600">Complete your purchase securely</p>
          </div>
          <button
            onClick={() => router.push('/cart')}
            className="flex items-center text-green-600 hover:text-green-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Return to Cart
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-7">
            {/* Order Items */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Items</h2>
                <div className="divide-y divide-gray-100">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-4 flex items-start space-x-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                        {item.product?.images?.[0]?.image_url ? (
                          <img
                            src={item.product.images[0].image_url}
                            alt={item.product?.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-gray-900">
                          {item.product?.title || 'Product Not Found'}
                        </h3>
                        
                        {/* Product Options */}
                        <div className="mt-1 space-y-1">
                          <p className="text-sm text-gray-500">
                            Quantity: {item.quantity}
                          </p>
                          {item.selected_size && (
                            <p className="text-sm text-gray-500">
                              Size: <span className="font-medium">{item.selected_size}</span>
                            </p>
                          )}
                          {item.selected_color && (
                            <p className="text-sm text-gray-500">
                              Color: <span className="font-medium">{item.selected_color}</span>
                            </p>
                          )}
                          {item.selected_variant_sku && !item.selected_size && !item.selected_color && (
                            <p className="text-sm text-gray-500">
                              Variant: <span className="font-medium">{item.selected_variant_sku}</span>
                            </p>
                          )}
                        </div>

                        {item.product?.owner?.store_settings?.name && (
                          <p className="mt-1 text-sm text-gray-500">
                            Seller: {item.product.owner.store_settings.name}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="flex-shrink-0 text-right">
                        {item.flash_sale_price && item.flash_sale_price !== item.product.price && (
                          <p className="text-sm text-gray-500 line-through">
                            ETB {item.product.price.toFixed(2)}
                          </p>
                        )}
                        <p className={`text-base font-medium ${
                          item.flash_sale_price ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          ETB {((item.flash_sale_price || item.product.price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Seller Information */}
            {sellers.map((seller) => (
              <div key={seller.sellerId} className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Seller: {seller.sellerName}
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-gray-900">ETB {seller.subtotal.toFixed(2)}</span>
                    </div>
                    {seller.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Delivery Fee</span>
                        <span className="text-gray-900">ETB {seller.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Service Fee (0%)</span>
                      <span className="text-gray-900">ETB {seller.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">VAT (0%)</span>
                      <span className="text-gray-900">ETB {seller.vat.toFixed(2)}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-base font-medium">
                        <span className="text-gray-900">Seller Total</span>
                        <span className="text-gray-900">ETB {seller.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary - Right Column */}
          <div className="lg:col-span-5">
            <div className="sticky top-24">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-4">
                  {/* Summary Items */}
                  {[
                    { 
                      label: 'Subtotal', 
                      value: fees.subtotal 
                    },
                    ...(Object.values(selectedDeliveryMethods).includes('delivery') 
                      ? [{ 
                          label: 'Delivery Fee', 
                          value: fees.deliveryFee,
                          className: 'text-gray-600'
                        }] 
                      : []
                    ),
                    { 
                      label: 'Service Fee (0%)',
                      value: fees.serviceFee,
                      className: 'text-gray-600'
                    },
                    {
                      label: 'VAT (0%)',
                      value: fees.vat,
                      className: 'text-gray-600'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between text-gray-600">
                      <span>{item.label}</span>
                      <span className={item.className}>
                        ETB {item.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">
                        ETB {fees.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Section */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>
                  {/* Terms and Service Agreement */}
                  <div className="flex items-center mt-6 mb-4">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={e => setAgreedToTerms(e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-700">
                      I agree to the{' '}
                      <button
                        type="button"
                        className="text-green-600 hover:underline"
                        onClick={() => setShowTerms(true)}
                      >
                        Terms and Service
                      </button>
                    </label>
                  </div>
                  {/* Terms Modal */}
                  {showTerms && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
                        <button
                          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowTerms(false)}
                        >
                          <span className="sr-only">Close</span>
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <h2 className="text-xl font-semibold mb-4">Terms and Service</h2>
                        <div className="max-h-96 overflow-y-auto text-sm text-gray-700 space-y-2">
                          <p>By placing your order, you agree to our marketplace's Terms and Service. Please read them carefully before proceeding.</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>All sales are subject to our return and refund policy.</li>
                            <li>Ensure your delivery address and contact information are accurate.</li>
                            <li>Payments are processed securely through our payment partners.</li>
                            <li>Disputes will be handled according to our dispute resolution process.</li>
                            <li>Your data will be handled in accordance with our privacy policy.</li>
                          </ul>
                          <p>For full details, visit our <a href="/terms" className="text-green-600 hover:underline" target="_blank">Terms and Service</a> page.</p>
                        </div>
                        <div className="mt-6 flex justify-end">
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                            onClick={() => setShowTerms(false)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={!agreedToTerms || isProcessing}
                    className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing Payment...
                      </div>
                    ) : (
                      'Select Payment Method'
                    )}
                  </button>

                  {/* Security Badges */}
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-center text-sm text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Secure Payment Processing
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      By completing your purchase, you agree to our{' '}
                      <a href="/terms" className="text-green-600 hover:text-green-700">
                        Terms of Service
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSelectMethod={handlePaymentMethodSelect}
        isProcessing={isProcessing}
        sellers={sellers.map(seller => ({
          sellerId: seller.sellerId,
          sellerName: seller.sellerName,
          products: seller.products.map((product: Product) => ({
            ...product,
            owner: seller.owner
          })),
          subtotal: seller.subtotal,
          total: seller.total,
          platformFee: seller.platformFee,
          serviceFee: seller.serviceFee,
          ethiopiaTax: seller.ethiopiaTax,
          deliveryFee: seller.deliveryFee,
          owner: seller.owner
        }))}
      />
    </div>
  );
}

async function createTelebirrOrder({ title, amount, sellerId, owner }: {
  title: string;
  amount: number;
  sellerId: string;
  owner: ProductOwner;
}) {
  try {
    // Get Telebirr config
    const config = await getTelebirrConfig();

    // Get fabric token
    const tokenResult = await applyFabricToken({
      baseUrl: config.baseUrl,
      fabricAppId: config.fabricAppId,
      appSecret: config.appSecret,
    });

    // Create order and get payment URL
    const paymentUrl = await createOrder({
      config,
      fabricToken: tokenResult.token,
      title,
      amount: amount.toString(),
    });

    return paymentUrl;

  } catch (error) {
    console.error('Telebirr payment error:', error);
    throw new Error('Failed to create Telebirr order');
  }
} 