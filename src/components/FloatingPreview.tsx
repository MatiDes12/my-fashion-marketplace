'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/utils/currency';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ProductPreview {
  id: string;
  title: string;
  price: number;
  image_url: string;
  timeViewed: number;
}

export function FloatingPreview() {
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only show on landing page and reset dismissed state on path change
    if (pathname !== '/') {
      setPreview(null);
      setIsDismissed(false);
      return;
    }

    // Get recently viewed products from localStorage
    const recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    if (recentlyViewed.length > 0) {
      // Get the most recently viewed product
      const mostRecent = recentlyViewed[recentlyViewed.length - 1];
      setPreview(mostRecent);
      
      // Set a timeout to auto-dismiss after 20 seconds
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 5000);

      // Clean up timer on unmount or when pathname changes
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDismissed(true);
  };

  if (!preview || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        className="fixed left-6 bottom-24 z-50"
      >
        <Link href={`/products/${preview.id}`}>
          <div className="backdrop-blur-md bg-white/30 rounded-xl shadow-lg p-4 
                        border border-white/20 hover:bg-white/40 transition-all duration-300
                        group flex items-center space-x-4 max-w-[280px] relative">
            {/* Progress bar for auto-dismiss */}
            <div className="absolute top-0 left-0 h-[2px] bg-red-500/20 w-full rounded-t-xl overflow-hidden">
              <div 
                className="h-full bg-red-500 w-full origin-left"
                style={{
                  animation: 'shrink 20s linear forwards'
                }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full 
                         shadow-md hover:bg-red-700 transition-colors z-10"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>

            {/* Product Image */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <Image
                src={preview.image_url}
                alt={preview.title}
                fill
                className="object-cover rounded-lg shadow-md"
              />
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600/80 font-medium mb-1">
                Recently Viewed
              </p>
              <h3 className="font-medium text-gray-900/90 group-hover:text-red-600 
                           transition-colors truncate max-w-[160px]">
                {preview.title}
              </h3>
              <p className="text-red-600/90 font-semibold mt-1">
                {formatCurrency(preview.price)}
              </p>
            </div>

            {/* Hover tooltip for full title */}
            <div className="absolute left-1/2 -top-12 -translate-x-1/2 opacity-0 
                          group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap">
                {preview.title}
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>

            {/* View Again Badge */}
            <motion.div
              className="absolute -right-2 -top-8 opacity-0 group-hover:opacity-100
                         transition-opacity duration-200"
              whileHover={{ scale: 1.1 }}
            >
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full shadow-md">
                View Again
              </span>
            </motion.div>
          </div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
} 