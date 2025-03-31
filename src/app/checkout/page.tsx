'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { getFlashSalePrices } from '@/utils/flashSales';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { CartItem, PaymentSettings } from '@/types/cart';
import { PAYMENT_METHODS } from '@/utils/constants';
import { getTelebirrConfig, createOrder, applyFabricToken } from '@/lib/telebirr';

// Import or define PaymentMethodType
type PaymentMethodType = keyof typeof PAYMENT_METHODS;

interface ProductOwner {
  id: string;
  full_name: string;
  store_settings?: {
    name?: string;
  };
  payment_settings?: PaymentSettings;
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

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();
  const [selectedDeliveryMethods, setSelectedDeliveryMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});

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
    let serviceFee = 0;

    items.forEach(item => {
      const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
      subtotal += itemSubtotal;

      // Use saved delivery method from database
      if (item.delivery_method === 'delivery') {
        deliveryFee += (item.delivery_fee || 0);
      }

      serviceFee += itemSubtotal * 0.03;
    });

    const total = subtotal + deliveryFee + serviceFee;

    return {
      subtotal,
      deliveryFee,
      serviceFee,
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

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);

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
        // Create order
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: session.user.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total_price: item.quantity * item.price,
            platform_fee: (item.quantity * item.price) * 0.03, // Store platform fee
            service_fee: (item.quantity * item.price) * 0.00, // Store service fee
            ethiopia_tax: (item.quantity * item.price) * 0.15, // Store VAT
            delivery_fee: fees.deliveryFee / cartItems.length, // Split delivery fee among items
            order_status: 'pending'
          });

        if (orderError) throw orderError;

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
          total: 0,
          owner: {
            ...item.product.owner,
            payment_settings: item.product.owner.payment_settings
          },
          products: [],
          hasPaymentSettings: Boolean(
            item.product.owner.payment_settings?.telebirr_settings?.is_active ||
            item.product.owner.payment_settings?.bank_settings?.is_active ||
            item.product.owner.payment_settings?.cbe_birr_settings?.is_active ||
            item.product.owner.payment_settings?.amole_settings?.is_active ||
            item.product.owner.payment_settings?.chapa_settings?.is_active
          )
        };
      }
      
      acc[sellerId].items.push(item);
      acc[sellerId].products.push({
        id: item.product.id,
        title: item.product.title,
        price: item.flash_sale_price || item.product.price,
        quantity: item.quantity,
        images: item.product.images
      });
      
      const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
      acc[sellerId].subtotal += itemSubtotal;
      
      if (item.delivery_method === 'delivery') {
        acc[sellerId].deliveryFee += (item.delivery_fee || 0);
      }
      
      acc[sellerId].serviceFee += itemSubtotal * 0.03;
      
      acc[sellerId].total = acc[sellerId].subtotal + 
                           acc[sellerId].deliveryFee + 
                           acc[sellerId].serviceFee;
      
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
                        <p className="mt-1 text-sm text-gray-500">
                          Quantity: {item.quantity}
                        </p>
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
                      <span className="text-gray-600">Service Fee (3%)</span>
                      <span className="text-gray-900">ETB {seller.serviceFee.toFixed(2)}</span>
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
                      label: 'Service Fee (3%)', 
                      value: fees.serviceFee,
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
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={isProcessing}
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
          ...seller,
          product: {
            id: seller.products[0].id,
            title: seller.products[0].title,
            price: seller.products[0].price,
            images: seller.products[0].images,
            owner: {
              id: seller.owner.id,
              full_name: seller.owner.full_name,
              store_settings: seller.owner.store_settings,
              payment_settings: seller.owner.payment_settings
            }
          }
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