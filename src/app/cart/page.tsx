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
    const platformCommission = subtotal * 0.05; // 5% platform fee
    const serviceFee = subtotal * 0.02; // 2% service fee
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
    <div className="min-h-screen bg-gray-50 pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="bg-red-50 p-6 rounded-lg shadow-sm">
            <ErrorMessage message={error} />
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Your cart is empty</h3>
            <p className="mt-1 text-sm text-gray-500">
              Looks like you haven't added any products to your cart yet.
            </p>
            <button
              onClick={() => router.push('/products')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
            <div className="lg:col-span-8">
              <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
                <ul role="list" className="divide-y divide-gray-200">
                  {cartItems.map((item) => (
                    <li key={item.id} className="p-6 flex flex-col sm:flex-row">
                      <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-md overflow-hidden">
                        {item.product?.images && item.product.images.length > 0 ? (
                          <Image
                            src={item.product.images[0].image_url}
                            alt={item.product.title}
                            width={96}
                            height={96}
                            className="w-full h-full object-center object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 ml-0 sm:ml-6 mt-4 sm:mt-0">
                        <div className="flex justify-between">
                          <h3 className="text-lg font-medium text-gray-900">
                            <button 
                              onClick={() => router.push(`/products/${item.product.id}`)}
                              className="hover:text-green-600"
                            >
                              {item.product.title}
                            </button>
                          </h3>
                          <div className="text-right">
                            <div className="flex flex-col">
                              {item.flash_sale_price ? (
                                <>
                                  <span className="text-lg font-medium text-red-600">
                                    ${item.flash_sale_price.toFixed(2)}
                                  </span>
                                  <span className="text-sm text-gray-500 line-through">
                                    ${item.product.price.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-red-600">
                                    {Math.round(((item.product.price - item.flash_sale_price) / item.product.price) * 100)}% OFF
                                  </span>
                                </>
                              ) : (
                                <span className="text-lg font-medium text-gray-900">
                                  ${item.product.price.toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                Subtotal: ${item.subtotal.toFixed(2)}
                              </span>
                            </div>
                            {item.delivery_fee > 0 && (
                              <p className="text-sm text-gray-500">
                                +${item.delivery_fee.toFixed(2)} delivery
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center border border-gray-300 rounded-md">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={isUpdating[item.id] || item.quantity <= 1}
                              className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              -
                            </button>
                            <span className="px-3 py-1 text-gray-700">
                              {isUpdating[item.id] ? (
                                <div className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto" />
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={isUpdating[item.id]}
                              className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={isUpdating[item.id]}
                            className="text-sm font-medium text-red-600 hover:text-red-500"
                          >
                            {isUpdating[item.id] && item.quantity === 0 ? (
                              <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              'Remove'
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={() => router.push('/products')}
                  className="text-sm font-medium text-green-600 hover:text-green-500"
                >
                  ← Continue Shopping
                </button>
              </div>
            </div>
            
            <div className="mt-8 lg:mt-0 lg:col-span-4">
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">Subtotal</p>
                    <p className="text-gray-900 font-medium">${fees.subtotal.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">Ethiopia VAT (15%)</p>
                    <p className="text-gray-900 font-medium">${fees.ethiopiaTax.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">Platform Fee (5%)</p>
                    <p className="text-gray-900 font-medium">${fees.platformCommission.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">Service Fee (2%)</p>
                    <p className="text-gray-900 font-medium">${fees.serviceFee.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">Delivery</p>
                    <p className="text-gray-900 font-medium">${fees.deliveryFee.toFixed(2)}</p>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                    <p className="text-lg font-medium text-gray-900">Total</p>
                    <p className="text-xl font-bold text-gray-900">${fees.total.toFixed(2)}</p>
                  </div>
                  
                  <button
                    onClick={proceedToCheckout}
                    disabled={isCheckingOut}
                    className="w-full mt-6 bg-green-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-70"
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
                  
                  <div className="mt-4 text-sm text-gray-500">
                    <p className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Secure payment
                    </p>

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