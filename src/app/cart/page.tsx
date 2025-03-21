'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { getFlashSalePrices } from '@/utils/flashSales';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const router = useRouter();
  const supabase = createClientComponent();
  
  useEffect(() => {
    fetchCartItems();
  }, []);
  
  const fetchCartItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Fetch cart items with product details
      const { data, error: fetchError } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(
            id, 
            title, 
            price,
            delivery_fee,
            images:product_images(*)
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (fetchError) throw fetchError;

      // Get flash sale prices for all products
      const productIds = data?.map(item => item.product.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);
      
      // Calculate subtotal and include delivery fee for each item
      const processedItems = data?.map(item => ({
        ...item,
        subtotal: item.quantity * (flashSalePrices[item.product.id] || item.product.price),
        delivery_fee: item.product.delivery_fee || 0,
        flash_sale_price: flashSalePrices[item.product.id]
      })) || [];
      
      setCartItems(processedItems);
      
    } catch (err) {
      console.error('Error fetching cart:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setIsUpdating(prev => ({ ...prev, [itemId]: true }));
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);
        
      if (error) throw error;
      
      // Update local state
      setCartItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                quantity: newQuantity,
                subtotal: newQuantity * item.product.price
              }
            : item
        )
      );
      
      // Trigger cart count update in the header
      window.dispatchEvent(new CustomEvent('cart-updated'));
      
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    } finally {
      setIsUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  };
  
  const removeItem = async (itemId: string) => {
    setIsUpdating(prev => ({ ...prev, [itemId]: true }));
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);
        
      if (error) throw error;
      
      // Update local state
      setCartItems(prev => prev.filter(item => item.id !== itemId));
      
      toast.success('Item removed from cart');
      
      // Trigger cart count update in the header
      window.dispatchEvent(new CustomEvent('cart-updated'));
      
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    } finally {
      setIsUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  };
  
  const proceedToCheckout = () => {
    setIsCheckingOut(true);
    router.push('/checkout');
  };
  
  // Calculate cart totals
  const calculateFees = () => {
    // Base calculations
    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const ethiopiaTax = subtotal * 0.15; // 15% VAT
    const platformCommission = subtotal * 0.03; // Changed from 5% to 3% platform fee
    const serviceFee = subtotal * 0.00; // 2% service fee
    // Sum up all delivery fees from products
    const deliveryFee = cartItems.reduce((sum, item) => sum + (item.delivery_fee || 0), 0);

    return {
      subtotal,
      ethiopiaTax,
      platformCommission,
      serviceFee,
      deliveryFee,
      total: subtotal + ethiopiaTax + platformCommission + serviceFee + deliveryFee
    };
  };

  // Use the calculated fees in your JSX
  const fees = calculateFees();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Cart Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Shopping Cart</h1>
          <button
            onClick={() => router.push('/products')}
            className="flex items-center text-green-600 hover:text-green-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Continue Shopping
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="bg-red-50 p-8 rounded-xl shadow-sm">
            <ErrorMessage message={error} />
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-xl shadow-sm">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
            <p className="text-gray-500 mb-8">
              Discover our amazing products and add them to your cart!
            </p>
            <button
              onClick={() => router.push('/products')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
            {/* Cart Items Section */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                <ul role="list" className="divide-y divide-gray-100">
                  {cartItems.map((item) => (
                    <li key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex gap-6">
                        {/* Product Image */}
                        <div className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                          {item.product?.images && item.product.images.length > 0 ? (
                            <Image
                              src={item.product.images[0].image_url}
                              alt={item.product.title}
                              width={128}
                              height={128}
                              className="w-full h-full object-center object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between">
                            <div>
                              <h3 className="text-xl font-medium text-gray-900 mb-1">
                                <button 
                                  onClick={() => router.push(`/products/${item.product.id}`)}
                                  className="hover:text-green-600 transition-colors"
                                >
                                  {item.product.title}
                                </button>
                              </h3>
                              {/* Price Display */}
                              <div className="flex items-baseline gap-2 mb-4">
                                {item.flash_sale_price ? (
                                  <>
                                    <span className="text-2xl font-bold text-red-600">
                                      ${item.flash_sale_price.toFixed(2)}
                                    </span>
                                    <span className="text-sm text-gray-500 line-through">
                                      ${item.product.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                      {Math.round(((item.product.price - item.flash_sale_price) / item.product.price) * 100)}% OFF
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-2xl font-bold text-gray-900">
                                    ${item.product.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls and Subtotal */}
                          <div className="mt-auto flex items-end justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  disabled={isUpdating[item.id] || item.quantity <= 1}
                                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                  -
                                </button>
                                <span className="px-4 py-2 text-gray-900 font-medium min-w-[3rem] text-center">
                                  {isUpdating[item.id] ? (
                                    <div className="h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                  ) : (
                                    item.quantity
                                  )}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={isUpdating[item.id]}
                                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                disabled={isUpdating[item.id]}
                                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                              >
                                {isUpdating[item.id] && item.quantity === 0 ? (
                                  <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  'Remove'
                                )}
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500 mb-1">Subtotal</p>
                              <p className="text-lg font-semibold text-gray-900">
                                ${item.subtotal.toFixed(2)}
                              </p>
                              {item.delivery_fee > 0 && (
                                <p className="text-sm text-gray-500 mt-1">
                                  +${item.delivery_fee.toFixed(2)} delivery
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>
                
                <div className="space-y-4">
                  {/* Summary Items */}
                  {[
                    { label: 'Subtotal', value: fees.subtotal },
                    { label: 'Ethiopia VAT (15%)', value: fees.ethiopiaTax },
                    { label: 'Platform Fee (3%)', value: fees.platformCommission },
                    { label: 'Service Fee (0%)', value: fees.serviceFee },
                    { label: 'Delivery', value: fees.deliveryFee },
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between text-gray-600">
                      <span>{item.label}</span>
                      <span>${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">
                        ${fees.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={proceedToCheckout}
                    disabled={isCheckingOut}
                    className="w-full mt-6 bg-green-600 rounded-lg py-4 px-6 text-white font-medium hover:bg-green-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-70 transition-colors"
                  >
                    {isCheckingOut ? (
                      <div className="flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </div>
                    ) : (
                      'Proceed to Checkout'
                    )}
                  </button>

                  {/* Security Badge */}
                  <div className="mt-6 flex items-center justify-center text-sm text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Secure checkout
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 