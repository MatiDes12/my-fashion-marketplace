'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { createClientComponent } from '@/lib/supabase';

export const FloatingPreview = () => {
  const supabase = createClientComponent();
  const [session, setSession] = useState<any>(null);
  const [lastViewedProduct, setLastViewedProduct] = useState<any>(null);

  useEffect(() => {
    // Get the current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      // Only get last viewed product if user is logged in
      if (session?.user) {
        const stored = localStorage.getItem('lastViewedProduct');
        if (stored) {
          setLastViewedProduct(JSON.parse(stored));
        }
      }
    });

    // Listen for session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session?.user) {
        setLastViewedProduct(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Only render if user is logged in and there's a last viewed product
  if (!session?.user || !lastViewedProduct) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 20, x: 20 }}
      className="fixed bottom-24 right-8 z-40 bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-gray-700/50 animate-float"
    >
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <Image
            src={lastViewedProduct.image || "/images/recently-viewed.jpg"}
            alt={lastViewedProduct.title || "Recently Viewed"}
            fill
            className="object-cover rounded-lg"
          />
        </div>
        <div>
          <p className="text-sm text-gray-300">Recently Viewed</p>
          <p className="text-white font-medium line-clamp-1">{lastViewedProduct.title}</p>
          <p className="text-sm text-red-400">ETB {lastViewedProduct.price?.toLocaleString()}</p>
        </div>
        <button 
          onClick={() => {
            setLastViewedProduct(null);
            localStorage.removeItem('lastViewedProduct');
          }}
          className="absolute -top-2 -right-2 bg-gray-700 rounded-full p-1 hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}; 