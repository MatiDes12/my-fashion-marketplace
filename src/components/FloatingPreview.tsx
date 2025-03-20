'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface RecentProduct {
  id: string;
  title: string;
  image: string;
  price: number;
  timeViewed: number;
}

export const FloatingPreview = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [recentProduct, setRecentProduct] = useState<RecentProduct | null>(null);

  useEffect(() => {
    // Get recent products from localStorage
    const recentProducts = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    
    if (recentProducts.length > 0) {
      // Show the most recent product
      const mostRecent = recentProducts[recentProducts.length - 1];
      setRecentProduct(mostRecent);
      
      // Show after 2 seconds
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);

      // Hide after 10 seconds
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 10000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  if (!recentProduct) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 right-8 z-40 max-w-sm"
        >
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-gray-700/50">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src={recentProduct.image}
                  alt={recentProduct.title}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 mb-1">Recently Viewed</p>
                <p className="text-white font-medium truncate">
                  {recentProduct.title}
                </p>
                <p className="text-red-400 text-sm mt-1">
                  ETB {recentProduct.price.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 