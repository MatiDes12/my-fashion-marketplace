'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { TelebirrPayment } from '@/lib/telebirr';
import { config } from '@/config/env';
import { getFlashSalePrices } from '@/utils/flashSales';
import { createTelebirrOrder } from '@/lib/telebirr-client';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { CartItem, SellerOrder } from '@/types/cart';

interface Seller {
  id: string;
  name: string;
  hasPaymentSettings: boolean;
  total: number;
  items: CartItem[];
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();

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
          product:products (
            id,
            title,
            description,
            price,
            owner:users (
              id,
              full_name,
              payment_settings(telebirr_settings)
            ),
            images:product_images (
              image_url
            )
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Get flash sale prices
      const productIds = data.map(item => item.product.id);
      const flashSalePrices = await getFlashSalePrices(productIds);

      // Process items with flash sale prices
      const processedItems = data.map(item => ({
        ...item,
        price: flashSalePrices[item.product.id] || item.product.price,
        original_price: item.product.price,
        product: {
          ...item.product,
          title: item.product.title,
          description: item.product.description,
          images: item.product.images,
          owner: item.product.owner
        }
      }));

      setCartItems(processedItems);

    } catch (error) {
      console.error('Error fetching cart:', error);
      setError('Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const calculateFees = (items: CartItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const ethiopiaTax = subtotal * 0.15; // 15% VAT
    const platformCommission = subtotal * 0.05; // 5% platform fee
    const serviceFee = subtotal * 0.02; // 2% service fee
    const deliveryFee = items.reduce((sum, item) => sum + (item.delivery_fee || 0), 0);

    return {
      subtotal,
      ethiopiaTax,
      platformCommission,
      serviceFee,
      deliveryFee,
      total: subtotal + ethiopiaTax + platformCommission + serviceFee + deliveryFee
    };
  };

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please login to complete checkout');
      }

      const fees = calculateFees(cartItems);

      // Create orders for each cart item
      for (const item of cartItems) {
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: session.user.id,
            product_id: item.product_id,
            quantity: item.quantity,
            total_price: item.quantity * item.price,
            platform_fee: (item.quantity * item.price) * 0.05, // Store platform fee
            service_fee: (item.quantity * item.price) * 0.02, // Store service fee
            ethiopia_tax: (item.quantity * item.price) * 0.15, // Store VAT
            delivery_fee: fees.deliveryFee / cartItems.length, // Split delivery fee among items
            order_status: 'pending'
          });

        if (orderError) throw orderError;
      }

      // Clear the cart
      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', session.user.id);

      if (clearCartError) {
        throw new Error('Failed to clear cart');
      }

      // Update UI to reflect empty cart
      window.dispatchEvent(new CustomEvent('cart-updated'));
      
      toast.success('Order placed successfully!');
      router.push('/orders');

    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodSelect = async (methodId: string, sellerId: string) => {
    try {
      setIsProcessing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please login to complete checkout');
      }

      let firstSellerCheckoutUrl: string | null = null;

      switch (methodId) {
        case 'telebirr':
          // Process each seller's items
          for (const seller of sellers) {
            const checkoutUrl = await createTelebirrOrder({
              title: `Order #${Date.now()}-${seller.id.substring(0, 4)}`,
              amount: seller.total,
              sellerId: seller.id
            });

            if (!firstSellerCheckoutUrl) {
              firstSellerCheckoutUrl = checkoutUrl;
            }

            // Create orders
            const { error: orderError } = await supabase
              .from('orders')
              .insert(seller.items.map(item => ({
                user_id: session.user.id,
                product_id: item.product_id,
                seller_id: seller.id,
                quantity: item.quantity,
                total_price: item.quantity * item.price,
                order_status: 'pending',
                payment_url: checkoutUrl
              })));

            if (orderError) throw orderError;
          }

          // Redirect to first seller's payment
          if (firstSellerCheckoutUrl) {
            window.location.href = firstSellerCheckoutUrl;
          }
          break;

        case 'cbe':
        case 'paypal':
          toast.error('This payment method is not available yet');
          break;

        default:
          throw new Error('Invalid payment method');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const fees = calculateFees(cartItems);

  const sellers = Object.values(cartItems.reduce<Record<string, SellerOrder>>((acc, item) => {
    if (!item.product?.owner) return acc;
    
    const sellerId = item.product.owner.id;
    const sellerName = item.product.owner.store_settings?.name || item.product.owner.full_name || 'Unknown Seller';
    
    if (!acc[sellerId]) {
      acc[sellerId] = {
        id: sellerId,
        name: sellerName,
        hasPaymentSettings: Boolean(
          item.product.owner.payment_settings?.telebirr_settings?.is_active
        ),
        subtotal: 0,
        platformFee: 0,
        serviceFee: 0,
        ethiopiaTax: 0,
        deliveryFee: 0,
        total: 0,
        items: []
      };
    }
    
    const itemSubtotal = item.quantity * item.price;
    acc[sellerId].items.push(item);
    acc[sellerId].subtotal += itemSubtotal;
    acc[sellerId].platformFee += itemSubtotal * 0.05;
    acc[sellerId].serviceFee += itemSubtotal * 0.02;
    acc[sellerId].ethiopiaTax += itemSubtotal * 0.15;
    acc[sellerId].deliveryFee += item.delivery_fee || 0;
    acc[sellerId].total = (
      acc[sellerId].subtotal + 
      acc[sellerId].platformFee + 
      acc[sellerId].serviceFee + 
      acc[sellerId].ethiopiaTax + 
      acc[sellerId].deliveryFee
    );
    
    return acc;
  }, {}));

  return (
    <div className="min-h-screen bg-gray-50 pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cart Items */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between py-4">
                  <div>
                    <h3 className="text-sm font-medium">
                      {item.product?.title || 'Product Not Found'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.price !== item.product?.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ${item.product?.price?.toFixed(2) || '0.00'}
                      </p>
                    )}
                    <p className={`text-sm font-medium ${
                      item.price !== item.product?.price ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${fees.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </div>
              ) : (
                'Complete Purchase'
              )}
            </button>
            <p className="mt-4 text-sm text-gray-500 text-center">
              By completing your purchase, you agree to our terms of service.
            </p>
          </div>
        </div>
      </div>

      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSelectMethod={handlePaymentMethodSelect}
        isProcessing={isProcessing}
        sellers={sellers}
      />
    </div>
  );
} 