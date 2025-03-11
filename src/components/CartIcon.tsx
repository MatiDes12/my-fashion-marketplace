'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CartIcon() {
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponent();
  
  useEffect(() => {
    fetchCartCount();
    
    // Listen for cart updates
    window.addEventListener('cart-updated', fetchCartCount);
    
    return () => {
      window.removeEventListener('cart-updated', fetchCartCount);
    };
  }, []);
  
  const fetchCartCount = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setCartCount(0);
        return;
      }
      
      const { data, error } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      // Calculate total items in cart
      const totalItems = data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      setCartCount(totalItems);
      
    } catch (error) {
      console.error('Error fetching cart count:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      onClick={() => router.push('/cart')}
      className="relative p-2 text-gray-700 hover:text-indigo-600 transition-all duration-300 group"
      aria-label="Shopping Cart"
    >
      <div className="absolute -inset-2 bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 relative"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
        />
      </svg>
      
      {!loading && cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center transform scale-100 hover:scale-110 transition-transform duration-300">
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </button>
  );
} 