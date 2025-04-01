'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { getFlashSalePrices } from '@/utils/flashSales';
import AddressSelectionModal from '@/components/AddressSelectionModal';
import StoreLocationMap from '@/components/StoreLocationMap';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface CartItem {
  id: string;
  delivery_method: 'home_delivery' | 'store_pickup';
  product: {
    id: string;
    title: string;
    price: number;
    owner: {
      store_settings?: {
        address?: {
          street?: string;
          city?: string;
          subCity?: string;
          wereda?: string;
          kebele?: string;
        }
      }
    }
  };
  quantity: number;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [userAddress, setUserAddress] = useState<any>(null);
  const [selectedDeliveryMethods, setSelectedDeliveryMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'customer' | null>(null);
  
  const router = useRouter();
  const supabase = createClientComponent();
  
  useEffect(() => {
    fetchCartItems();
    fetchUserAddress();
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
      
      const { data, error: fetchError } = await supabase
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
              store_settings
            )
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (fetchError) throw fetchError;

      // Get flash sale prices
      const productIds = data?.map(item => item.product.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);
      
      // Process items and set delivery methods from database
      const processedItems = data?.map(item => ({
        ...item,
        subtotal: item.quantity * (flashSalePrices[item.product.id] || item.product.price),
        flash_sale_price: flashSalePrices[item.product.id]
      })) || [];
      
      setCartItems(processedItems);

      // Set delivery methods from database
      const methods: Record<string, 'delivery' | 'pickup'> = {};
      processedItems.forEach(item => {
        if (item.delivery_method) {
          methods[item.id] = item.delivery_method;
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
  
  const fetchUserAddress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData, error } = await supabase
        .from('users')
        .select('role, store_settings')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user address:', error);
        return;
      }

      if (userData?.store_settings?.address) {
        console.log('Found user address:', userData.store_settings.address);
        setUserAddress(userData.store_settings.address);
      }
    } catch (err) {
      console.error('Error in fetchUserAddress:', err);
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
    let subtotal = 0;
    let deliveryFee = 0;
    let serviceFee = 0;
    let vat = 0;

    cartItems.forEach(item => {
      const itemSubtotal = item.quantity * (item.flash_sale_price || item.product.price);
      subtotal += itemSubtotal;

      // Only add delivery fee if home delivery is selected for this item
      if (selectedDeliveryMethods[item.id] === 'delivery') {
        deliveryFee += (item.product.delivery_fee || 0);
      }

      // Service fee is now 0% for customers
      serviceFee = 0;
      
      // VAT at 0%
      vat = 0;
    });

    // Calculate total
    const total = subtotal + deliveryFee + serviceFee + vat;

    return {
      subtotal,
      deliveryFee,
      serviceFee,
      vat,
      total
    };
  };

  // Use the calculated fees in your JSX
  const fees = calculateFees();
  
  const getFullAddress = (address: any) => {
    // Debug logs
    console.log('Input address:', address);
    
    if (!address || !('0' in address)) {
      console.log('No numbered address found');
      return null;
    }
    
    const numberedKeys = Object.keys(address).filter(key => !isNaN(Number(key)));
    console.log('Numbered keys:', numberedKeys);
    
    const sortedKeys = numberedKeys.sort((a, b) => Number(a) - Number(b));
    console.log('Sorted keys:', sortedKeys);
    
    const addressChars = sortedKeys.map(key => {
      console.log(`Key ${key}:`, address[key]);
      return address[key];
    });
    console.log('Address chars:', addressChars);
    
    const result = addressChars.join('');
    console.log('Final result:', result);
    
    return result;
  };
  
  const handleDeliveryMethodSelect = async (itemId: string, method: 'delivery' | 'pickup') => {
    try {
      // Get the cart item
      const cartItem = cartItems.find(item => item.id === itemId);
      if (!cartItem) return;

      // Determine the address based on delivery method
      let deliveryAddress = null;
      if (method === 'delivery') {
        // Use user's delivery address
        deliveryAddress = userAddress;
      } else if (method === 'pickup') {
        // Use store's address
        deliveryAddress = cartItem.product.owner?.store_settings?.address;
      }

      // Update database
      const { error } = await supabase
        .from('cart_items')
        .update({ 
          delivery_method: method,
          delivery_address: deliveryAddress,
          delivery_fee: method === 'delivery' ? 
            cartItems.find(item => item.id === itemId)?.product.delivery_fee || 0 : 
            0
        })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setSelectedDeliveryMethods(prev => ({
        ...prev,
        [itemId]: method
      }));

      // Update cart items with new delivery address
      setCartItems(prev => prev.map(item => 
        item.id === itemId
          ? { 
              ...item, 
              delivery_method: method,
              delivery_address: deliveryAddress,
              delivery_fee: method === 'delivery' ? item.product.delivery_fee || 0 : 0
            }
          : item
      ));

    } catch (err) {
      console.error('Error updating delivery method:', err);
      toast.error('Failed to update delivery method');
    }
  };

  // Add this useEffect to monitor state changes
  useEffect(() => {
    console.log('Cart items updated:', cartItems);
    console.log('User address:', userAddress);
    console.log('Selected delivery methods:', selectedDeliveryMethods);
  }, [cartItems, userAddress, selectedDeliveryMethods]);

  // Add this helper function at the top of the component
  const getDeliveryTimeText = (time: string) => {
    switch (time) {
      case '1-2':
        return '1-2 business days';
      case '3-5':
        return '3-5 business days';
      case '5-7':
        return '5-7 business days';
      case '7-14':
        return '1-2 weeks';
      default:
        return time;
    }
  };

  // When creating the order, include the delivery information
  const createOrder = async (cartItem: CartItem) => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        // ... existing order fields ...
        delivery_method: cartItem.delivery_method,
        delivery_address: cartItem.delivery_method === 'home_delivery'
          ? userAddress // Use existing userAddress state
          : cartItem.product.owner?.store_settings?.address, // Use store address from product owner
        delivery_fee: cartItem.delivery_method === 'home_delivery' ? 12.00 : 0,
      })
      .select()
      .single();
  };

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
                                      ETB {item.flash_sale_price.toFixed(2)}
                                    </span>
                                    <span className="text-sm text-gray-500 line-through">
                                      ETB {item.product.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                      {Math.round(((item.product.price - item.flash_sale_price) / item.product.price) * 100)}% OFF
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-2xl font-bold text-gray-900">
                                    ETB {item.product.price.toFixed(2)}
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
                                ETB {item.subtotal.toFixed(2)}
                              </p>
                              {item.delivery_fee > 0 && (
                                <div className="text-sm text-gray-500">
                                  +ETB {item.delivery_fee.toFixed(2)} delivery
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Delivery Method Selection */}
                          <div className="mt-4 border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-medium text-gray-900">Delivery Method</h4>
                            <div className="mt-2 space-y-3">
                              {item.product?.delivery_options?.delivery && (
                                <div>
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="radio"
                                      id={`delivery-${item.id}`}
                                      name={`delivery-method-${item.id}`}
                                      checked={selectedDeliveryMethods[item.id] === 'delivery'}
                                      onChange={() => handleDeliveryMethodSelect(item.id, 'delivery')}
                                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor={`delivery-${item.id}`} className="text-sm text-gray-700">
                                      Home Delivery (ETB {item.product.delivery_fee?.toFixed(2) || '0.00'})
                                    </label>
                                  </div>

                                  {/* Show delivery address when home delivery is selected */}
                                  {selectedDeliveryMethods[item.id] === 'delivery' && (
                                    <div className="ml-7 mt-2">
                                      {item.delivery_address ? (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <p className="text-sm text-gray-900">Delivery Address:</p>
                                              {/* Handle numbered array format */}
                                              {Object.keys(item.delivery_address).some(key => !isNaN(Number(key))) ? (
                                                <p className="text-sm text-gray-600">
                                                  {getFullAddress(item.delivery_address)}
                                                </p>
                                              ) : null}
                                              <p className="text-sm text-gray-600">
                                                {item.delivery_address.city}
                                              </p>
                                              <p className="text-sm text-gray-500">
                                                Wereda {item.delivery_address.wereda}, 
                                                Kebele {item.delivery_address.kebele}
                                              </p>
                                              {item.delivery_address.houseNo && (
                                                <p className="text-sm text-gray-500">
                                                  House No: {item.delivery_address.houseNo}
                                                </p>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => {
                                                setActiveProductId(item.id);
                                                setShowAddressModal(true);
                                              }}
                                              className="text-sm text-green-600 hover:text-green-700"
                                            >
                                              Change
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setActiveProductId(item.id);
                                            setShowAddressModal(true);
                                          }}
                                          className="text-sm text-green-600 hover:text-green-700"
                                        >
                                          + Add Delivery Address
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {item.product?.delivery_options?.pickup && (
                                <div>
                                  <div className="flex items-center space-x-3">
                                    <input
                                      type="radio"
                                      id={`pickup-${item.id}`}
                                      name={`delivery-method-${item.id}`}
                                      checked={selectedDeliveryMethods[item.id] === 'pickup'}
                                      onChange={() => handleDeliveryMethodSelect(item.id, 'pickup')}
                                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor={`pickup-${item.id}`} className="text-sm text-gray-700">
                                      Store Pickup
                                    </label>
                                  </div>

                                  {selectedDeliveryMethods[item.id] === 'pickup' && (
                                    <div className="ml-7 mt-2">
                                      <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                                        <div>
                                          <p className="text-sm text-gray-900 font-medium">Pickup Location:</p>
                                          {/* Debug log */}
                                          {console.log('Store address:', item.product.owner?.store_settings?.address)}
                                          {item.product.owner?.store_settings?.address && 
                                            getFullAddress(item.product.owner.store_settings.address) && (
                                            <p className="text-sm text-gray-900">
                                              {getFullAddress(item.product.owner.store_settings.address)}
                                            </p>
                                          )}
                                          <p className="text-sm text-gray-600">
                                            {item.product.owner?.store_settings?.address?.subCity}, 
                                            {item.product.owner?.store_settings?.address?.city}
                                          </p>
                                          <p className="text-sm text-gray-500">
                                            Wereda {item.product.owner?.store_settings?.address?.wereda}, 
                                            Kebele {item.product.owner?.store_settings?.address?.kebele}
                                          </p>
                                          {item.product.shipping_info?.processing_time && (
                                            <p className="text-sm text-gray-500 mt-1">
                                              Processing time: {item.product.shipping_info.processing_time}
                                            </p>
                                          )}
                                        </div>

                                        {/* Store Location Map */}
                                        {item.product.owner?.store_settings?.address && (
                                          <StoreLocationMap 
                                            address={item.product.owner.store_settings.address}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
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

                  {/* Checkout Button */}
                  <button
                    onClick={proceedToCheckout}
                    disabled={isCheckingOut || !Object.keys(selectedDeliveryMethods).length}
                    className="w-full mt-6 bg-green-600 rounded-lg py-4 px-6 text-white font-medium 
                      hover:bg-green-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500 
                      disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCheckingOut ? (
                      <div className="flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </div>
                    ) : !Object.keys(selectedDeliveryMethods).length ? (
                      'Select delivery method to continue'
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
      <AddressSelectionModal
        isOpen={showAddressModal}
        onClose={() => {
          setShowAddressModal(false);
          setActiveProductId(null);
        }}
        currentAddress={userAddress}
        onAddressSelect={(address) => {
          if (activeProductId) {
            setCartItems(prev => 
              prev.map(item => 
                item.id === activeProductId 
                  ? { ...item, deliveryAddress: address }
                  : item
              )
            );
          }
          setUserAddress(address);
          setShowAddressModal(false);
          setActiveProductId(null);
        }}
      />
    </div>
  );
} 