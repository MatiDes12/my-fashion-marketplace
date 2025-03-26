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
                        group flex items-center space-x-4 max-w-sm relative">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full 
                         shadow-md hover:bg-red-700 transition-colors z-10"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>

            <div className="relative w-16 h-16 flex-shrink-0">
              <Image
                src={preview.image_url}
                alt={preview.title}
                fill
                className="object-cover rounded-lg shadow-md"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600/80 font-medium mb-1">
                Recently Viewed
              </p>
              <h3 className="font-medium text-gray-900/90 group-hover:text-red-600 
                           transition-colors line-clamp-1">
                {preview.title}
              </h3>
              <p className="text-red-600/90 font-semibold mt-1">
                {formatCurrency(preview.price)}
              </p>
            </div>
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