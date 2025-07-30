'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatETB } from '@/utils/currency';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getActiveFlashSale, getFlashSalePrices, getAllActiveFlashSales } from '@/utils/flashSales';
import ProductImage from '@/components/ProductImage';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import CountdownTimer from '@/components/CountdownTimer';
import { cleanImageUrl } from '@/utils/url';
import { useAuth } from '@/contexts/AuthContext';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useScroll, useTransform } from 'framer-motion';
import FloatingGradient from '@/components/FloatingGradient';
import ParallaxSection from '@/components/ParallaxSection';
import ScrollProgress from '@/components/ScrollProgress';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { EMAIL_CONFIG } from '@/config/email';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

const APP_PREVIEW_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="600" viewBox="0 0 300 600"%3E%3Crect width="300" height="600" fill="%23f3f4f6"/%3E%3Ctext x="150" y="300" font-family="Arial" font-size="14" fill="%239ca3af" text-anchor="middle"%3EAVRIO App Preview%3C/text%3E%3C/svg%3E';

// Add the carouselStyles object
const carouselStyles = {
  container: `
    relative overflow-x-auto scroll-smooth py-8
    snap-x snap-mandatory
    scrollbar-none
    mx-0  // Remove negative margins
    w-full  // Ensure full width
  `,
  wrapper: `
    flex gap-4 md:gap-8
    px-4 md:px-8  // Adjust padding
    md:transition-transform duration-300 ease-in-out
    w-full  // Ensure full width
  `,
  card: `
    flex-none w-[280px] md:w-80
    transform transition-all duration-500
    snap-center  // Change to snap-center for better mobile experience
    first:pl-0  // Remove padding from first card
  `,
  brandCard: `
    flex-none w-[200px] md:w-56 transform transition-all duration-500
    snap-start
  `,
  navButton: `
    hidden md:flex  // Hide on mobile, show on desktop
    absolute top-1/2 -translate-y-1/2 z-20 
    bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
    rounded-full p-4 shadow-lg shadow-red-500/20
    hover:from-red-500 hover:to-pink-500 
    transition-all duration-300
    text-white
  `,
  progressDot: `
    hidden md:block  // Hide on mobile, show on desktop
    w-2 h-2 rounded-full transition-all duration-300
    bg-gradient-to-r from-red-500/30 to-pink-500/30
  `,
  progressDotActive: `
    w-8 bg-gradient-to-r from-red-500 to-pink-500
    shadow-lg shadow-red-500/50
  `,
};

// Replace the existing sectionGradientStyles with this simplified version
const sectionGradientStyles = `
  relative z-10 w-full max-w-[1440px] mx-auto px-4 lg:px-8
`;

// Add back the FloatingElement component
const FloatingElement: React.FC<{ delay?: number; className?: string }> = ({ delay = 0, className = "" }) => {
  return (
    <div 
      className={`absolute w-24 h-24 rounded-full mix-blend-overlay pointer-events-none ${className}`}
      style={{
        animation: `float 6s ease-in-out ${delay}s infinite`,
        background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.15), transparent 70%)'
      }}
    />
  );
};

// Update the ScrollIndicator component
const ScrollIndicator = () => {
  return (
    <motion.div 
      className="absolute bottom-16 md:bottom-27 left-[47%] -translate-x-1/2 flex flex-col items-center" // Changed from left-1/2 to left-[40%]
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="flex flex-col items-center"
      >
        <span className="text-white/60 text-xs md:text-sm mb-2 font-medium">
          Scroll to explore
        </span>
        <svg 
          className="w-5 h-5 md:w-6 md:h-6 text-white/60" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 14l-7 7m0 0l-7-7m7 7V3" 
          />
        </svg>
      </motion.div>
    </motion.div>
  );
};

// Update the interface for featured sellers
interface FeaturedSeller {
  seller_id: string;
  seller_name: string;
  verification_status: string;  // Add this line
  store_settings: {
    name: string;
    logo_url: string;
    description: string;
  };
  top_product: {
    id: string;
    title: string;
    price: number;
    images: Array<{ image_url: string }>;
    like_count: number;
  };
}

// Add this interface for product images
interface ProductImage {
  id: string;
  image_url: string;
  is_model_picture?: boolean;
}

// Update the PopularProduct interface
interface PopularProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  created_at: string;
  product_images: ProductImage[];
  likes: Array<{ id: string }>;
  like_count?: number;
  flash_sale_price?: number;
  users: {
    id: string;
    full_name: string;
    email: string;
    store_settings?: {
      name: string;
      logo_url: string;
      description: string;
    };
  };
  average_rating?: number;
  ratings?: Array<{
    rating: number;
  }>;
  combined_score?: number;
}

interface FlashSaleProduct {
  id: string;
  product_id: string;
  special_price: number;
  product: {
    id: string;
    title: string;
    price: number;
    description: string;
    product_images: {
      id: string;
      image_url: string;
    }[];
    owner?: {
      store_settings?: {
        name?: string;
      };
    };
  };
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  store_id: string;
  store_name: string;
  created_by: string;
  products: FlashSaleProduct[];
}

// Add the categories array
const categories = [
  {
    name: 'Electronics',
    description: 'Phones, Laptops, Gadgets & More',
    image: '/images/categories/electronics.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: 'Traditional Wear',
    description: 'Habesha Kemis, Tilfi & Cultural Clothing',
    image: '/images/categories/traditional.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21L3 16.5M13 21l-4-4.5M3 16.5l3.5-3.5M21 16.5L17.5 13M13 21l4-4.5M17.5 13l-3.5-3.5M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2M3 7l4.5 4.5M21 7l-4.5 4.5" />
      </svg>
    )
  },
  {
    name: 'Modern Fashion',
    description: 'Contemporary Clothing & Accessories',
    image: '/images/categories/fashion.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  {
    name: 'Home & Living',
    description: 'Furniture, Decor & Kitchen Items',
    image: '/images/categories/home.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: 'Beauty & Health',
    description: 'Cosmetics, Personal Care & Wellness',
    image: '/images/categories/beauty.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )
  },
  {
    name: 'Toys & Games',
    description: 'Kids Toys, Board Games & Entertainment',
    image: '/images/categories/toys.jpg',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

// Also add the features array
const features = [
  {
    title: "Secure Payments",
    description: "Safe and secure payments with Telebirr, CBE, and other Ethiopian banks",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Fast Delivery",
    description: "Quick delivery across Ethiopia with real-time tracking",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Quality Products",
    description: "Curated selection of authentic Ethiopian and international products",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  }
];

const AnimatedSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = "", delay = 0 }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 100 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
};

// Add these interfaces near the top of the file
interface TouchPosition {
  startX: number;
  startY: number;
  startTime: number;
}


// Replace the BackToTopButton component with this simplified version
const BackToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="always-visible-element"
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '20px',
        zIndex: 9999,
        padding: '0.75rem',
        borderRadius: '9999px',
        background: 'linear-gradient(to right, rgb(220, 38, 38), rgb(219, 39, 119))',
        color: 'white',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
};

const FloatingChatButton = () => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 left-8 z-50 p-4 rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
    >
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-3 py-1 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        Need help?
      </div>
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </motion.button>
  );
};

// Update the SectionDivider component
const SectionDivider = () => {
  return (
    <div className="relative py-2"> {/* Changed from py-4 to py-2 */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-800"></div>
      </div>
      <div className="relative flex justify-center">
        <div className="px-4 bg-gray-900">
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-ping opacity-20"></div>
        <div className="relative bg-gradient-to-r from-red-600 to-pink-600 p-8 rounded-full animate-pulse">
          <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

const AnimatedTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-2xl font-bold text-white relative inline-block"
    >
      {children}
      <motion.div
        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-pink-500"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
      />
    </motion.h2>
  );
};

// First, add this component near your other component definitions
const AchievementBadges = () => {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex flex-wrap justify-center gap-2 md:gap-4 px-2 md:px-0">
        {[
          { icon: "🏆", label: "Best Marketplace 2023", color: "from-yellow-600 to-amber-600" },
          { icon: "⭐", label: "4.9/5 Customer Rating", color: "from-purple-600 to-pink-600" },
          { icon: "🔒", label: "Secure Payments", color: "from-green-600 to-emerald-600" },
          { icon: "🚚", label: "Fast Delivery", color: "from-blue-600 to-cyan-600" },
        ].map((badge, index) => (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100 rounded-full"></div>
            <div className={`
              flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm 
              px-3 py-1.5 md:px-4 md:py-2 rounded-full
              border border-gray-700/50
              hover:border-gray-600/50
              transition-all duration-300
              group-hover:transform group-hover:scale-105
              shadow-lg hover:shadow-xl
              min-w-[120px] md:min-w-[140px]
              justify-center
            `}>
              <span className="text-base md:text-xl">{badge.icon}</span>
              <span className="text-xs md:text-sm text-white whitespace-nowrap">{badge.label}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// First, add this component near your other component definitions
const CategoryBubbles = () => {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter(); // Add this

  useEffect(() => {
    // Set initial value
    setIsMobile(window.innerWidth < 768);

    // Add resize listener
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCategoryClick = async (categoryName: string) => {
    try {
      // Navigate to products page with category filter
      const formattedCategory = categoryName === 'All' ? 'all' : categoryName.toLowerCase();
      await router.push(`/products?category=${formattedCategory}`);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback
      window.location.href = `/products?category=${categoryName.toLowerCase()}`;
    }
  };

  return (
    <div className="relative h-24 overflow-visible">
      {categories.map((category, index) => (
        <motion.div
          key={category.name}
          className="absolute"
          style={{
            left: `${(index * 20) + (isMobile ? 1.5 : 8)}%`,
            top: `${Math.sin(index) * 20 + 50}%`,
            zIndex: 10,
          }}
          whileHover={{ scale: 1.1 }}
          animate={{
            y: [0, -10, 0],
            transition: {
              duration: 2,
              repeat: Infinity,
              delay: index * 0.2,
              ease: "easeInOut"
            },
          }}
        >
          <button 
            onClick={() => handleCategoryClick(category.name)}
            className="group relative block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative bg-gray-800/80 backdrop-blur-sm rounded-full p-4 border border-gray-700/50 group-hover:bg-gray-800/90 transition-colors">
              <div className="w-10 h-10 flex items-center justify-center text-white group-hover:text-red-400 transition-colors">
                {category.icon}
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white">
                {category.name}
              </div>
            </div>
          </button>
        </motion.div>
      ))}
    </div>
  ); // Add semicolon here
};

// Add this component near your other component definitions
const LiveVisitorCounter = () => {
  const [visitorCount, setVisitorCount] = useState(1234);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-[100px] md:top-[120px] left-4 md:left-8 z-40 bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-700/50 transform hover:scale-105 transition-all duration-300"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs md:text-sm text-white whitespace-nowrap">
          {visitorCount.toLocaleString()} shoppers online
        </span>
      </div>
    </motion.div>
  ); // Add semicolon here
};

// Update the FeaturedCollection component
const FeaturedCollection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Home & Living Collection */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-8 group"
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-white mb-4">Home & Living Collection</h3>
          <p className="text-white/80 mb-6">Discover our curated home decor and furniture</p>
          <Link
            href="/collections/home-living"
            className="inline-flex items-center bg-white text-gray-900 px-6 py-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            Explore Now
            <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
      </motion.div>

      {/* Clothing Collection */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-red-500 p-8 group"
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-white mb-4">Clothing Collection</h3>
          <p className="text-white/80 mb-6">Explore our trending fashion & apparel</p>
          <Link
            href="/collections/clothing"
            className="inline-flex items-center bg-white text-gray-900 px-6 py-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            View Collection
            <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
      </motion.div>
    </div>
  );
};

// Add the testimonials data at the top level, before any component definitions
const testimonials: {
  text: string;
  name: string;
  location: string;
  avatar?: string;
}[] = [
  {
    text: "Amazing marketplace! Found authentic Ethiopian products that I couldn't find anywhere else.",
    name: "Abebe Kebede",
    location: "Addis Ababa"
  },
  {
    text: "የባህላዊ ልብሶች ጥራት አስደናቂ ነው። ፈጣን አድራሻ እና ጥሩ የደንበኞች አገልግሎት!",
    name: "Sara Mohammed",
    location: "Dire Dawa"
  },
  {
    text: "AVRIO has transformed how I shop for Ethiopian fashion. Love the variety and authenticity.",
    name: "Dawit Haile",
    location: "Bahir Dar"
  }
];

// Update the TestimonialCarousel component to use TypeScript types
const TestimonialCarousel = () => {
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  return (
    <div className="relative overflow-hidden">
      <div className="relative">
        <h3 className="text-3xl font-bold text-white text-center mb-8">
          What Our Customers Say
        </h3>
        
        <div 
          ref={testimonialsRef}
          className="relative overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-colors group"
              >
                <div className="relative">
                  <svg 
                    className="absolute -top-4 -left-4 w-8 h-8 text-gray-500/10 group-hover:text-gray-500/20 transition-colors" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <p className="text-gray-300 italic mb-6 relative z-10">
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 
                    border-gray-700/50 group-hover:border-gray-600/50 
                    transition-colors bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                    {testimonial.avatar ? (
                      <Image
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-lg">
                        {testimonial.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{testimonial.name}</p>
                    <p className="text-sm text-gray-400">{testimonial.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add interfaces at the top of the file
interface PolicyModalContent {
  title: string;
  content: React.ReactNode;
}

// Move PolicyModal component outside of HomePage
const PolicyModal = ({ 
  isOpen, 
  onClose, 
  policy 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  policy: PolicyModalContent;
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-white shadow-xl transition-all">
                {policy.content}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Move policy content components outside of HomePage
const PrivacyPolicyContent = () => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Privacy Policy</h3>
    <div className="space-y-2 text-sm text-gray-300">
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <h4 className="font-medium text-white">Information We Collect</h4>
      <p>We collect information that you provide directly to us, including:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Name and contact information</li>
        <li>Delivery address and phone number</li>
        <li>Payment information (processed securely through our payment partners)</li>
        <li>Shopping preferences and history</li>
      </ul>

      <h4 className="font-medium text-white mt-4">How We Use Your Information</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Process your orders and payments</li>
        <li>Communicate about your orders and account</li>
        <li>Send you marketing communications (with your consent)</li>
        <li>Improve our services and user experience</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Data Security</h4>
      <p>We implement appropriate security measures to protect your personal information.</p>
    </div>
  </div>
);

const TermsOfServiceContent = () => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Terms of Service</h3>
    <div className="space-y-2 text-sm text-gray-300">
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <h4 className="font-medium text-white">Agreement to Terms</h4>
      <p>By accessing or using AVRIO, you agree to be bound by these terms.</p>

      <h4 className="font-medium text-white mt-4">User Accounts</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>You must provide accurate account information</li>
        <li>You are responsible for maintaining account security</li>
        <li>We reserve the right to suspend or terminate accounts</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Product Listings</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>All product descriptions must be accurate</li>
        <li>Prices and availability are subject to change</li>
        <li>We reserve the right to refuse any order</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Dispute Resolution</h4>
      <p>Any disputes will be resolved in accordance with Ethiopian law.</p>
    </div>
  </div>
);

const ShippingPolicyContent = () => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Shipping & Delivery Policy</h3>
    <div className="space-y-2 text-sm text-gray-300">
      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <h4 className="font-medium text-white">Delivery Options</h4>
      <p>Each seller on AVRIO can offer different delivery methods:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Store Pickup - Collect your order directly from the seller's location</li>
        <li>Local Delivery - Available in selected areas, delivered by the seller</li>
        <li>Shipping - Nationwide delivery through our shipping partners</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Delivery Information</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Available delivery options will be shown on each product page</li>
        <li>Delivery fees and times vary by seller and location</li>
        <li>Some sellers may offer free delivery above a minimum order value</li>
        <li>Estimated delivery times are provided at checkout</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Store Pickup</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Available during the seller's business hours</li>
        <li>Pickup location and instructions provided after order confirmation</li>
        <li>Bring your order confirmation and ID for collection</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Local Delivery</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Delivery radius and fees set by individual sellers</li>
        <li>Delivery times arranged directly with the seller</li>
        <li>Real-time tracking where available</li>
      </ul>

      <h4 className="font-medium text-white mt-4">Order Tracking</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Track orders through your AVRIO account</li>
        <li>Receive SMS/email updates on order status</li>
        <li>Contact seller directly for specific delivery queries</li>
      </ul>

      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-300">
          <strong className="text-white">Note:</strong> Delivery options, times, and fees are set by individual sellers. 
          Please check the specific delivery information on each product page or contact the seller directly for detailed shipping information.
        </p>
      </div>
    </div>
  </div>
);

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [sellerImageLoading, setSellerImageLoading] = useState<{[key: string]: boolean}>({});
  const [currentFlashSaleIndex, setCurrentFlashSaleIndex] = useState(0);
  const [mostLikedProducts, setMostLikedProducts] = useState<PopularProduct[]>([]);
  const [activePolicy, setActivePolicy] = useState<PolicyModalContent | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showMobilePopup, setShowMobilePopup] = useState(false);

  const subscriptionTiers = [
    {
      name: 'Basic',
      price: formatETB(500),
      period: 'month',
      description: 'Perfect for small Ethiopian boutiques',
      features: [
        'List up to 20 products',
        'Basic Amharic & English AI descriptions',
        'Basic analytics',
        'WhatsApp support',
        'Telebirr integration'
      ],
      cta: 'Start Selling',
      highlighted: false
    },
    {
      name: 'Pro',
      price: formatETB(1500),
      period: 'month',
      description: 'For growing Ethiopian businesses',
      features: [
        'List up to 100 products',
        'Advanced Amharic & English AI descriptions',
        'AI-powered pricing suggestions',
        'Priority support',
        'Custom storefront',
        'Advanced analytics',
        'CBE & Telebirr integration',
        'SMS notifications'
      ],
      cta: 'Go Pro',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: formatETB(5000),
      period: 'month',
      description: 'For large Ethiopian retailers',
      features: [
        'Unlimited products',
        'Full AI suite with Amharic support',
        'Dedicated account manager',
        'API access',
        'Custom integrations',
        'Advanced fraud protection',
        'All payment methods',
        'Multi-store management'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ];

  // First, add a loading state for each image category
  const [loadingStates, setLoadingStates] = useState({
    electronics: true,
    fashion: true,
    home: true,
    beauty: true,
    flashSale: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch featured sellers (owners with store settings)
      const { data: sellersData, error: sellersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          store_settings,
          verification_status,
          products (
            id,
            title,
            price,
            product_images (
              id,
              image_url
            ),
            likes (count)
          )
        `)
        .eq('role', 'owner')
        .eq('is_verified', true)
        .neq('verification_status', 'needs_reconsideration')
        .not('store_settings', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4);

      if (sellersError) throw sellersError;

      // Process sellers data
      const featuredSellers = sellersData?.map(seller => ({
        seller_id: seller.id,
        seller_name: seller.full_name,
        verification_status: seller.verification_status || '',  // Change this line
        store_settings: seller.store_settings,
        top_product: {
          id: seller.products[0]?.id,
          title: seller.products[0]?.title,
          price: seller.products[0]?.price,
          images: seller.products[0]?.product_images || [],
          like_count: seller.products[0]?.likes?.[0]?.count || 0
        }
      })) || [];

      setFeaturedBrands(featuredSellers);
      setSellerImageLoading(
        featuredSellers.reduce((acc, seller) => ({
          ...acc,
          [seller.seller_id]: true
        }), {})
      );

      // Fetch popular products
      await fetchPopularProducts();

      // Fetch most liked products
      const { data: likedProducts, error: likedError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          description,
          price,
          category,
          owner_id,
          created_at,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          users (
            id,
            full_name,
            email,
            store_settings
          ),
          likes (
            id
          )
        `)
        .eq('is_active', true)
        .gt('quantity', 0);

      if (likedError) throw likedError;
      // Sort products by like count in JavaScript
      const processedLikedProducts = (likedProducts || [])
        .map(product => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: product.price,
          category: product.category,
          owner_id: product.owner_id,
          created_at: product.created_at,
          product_images: product.product_images,
          users: {
            id: product.users[0]?.id || '',
            full_name: product.users[0]?.full_name || '',
            email: product.users[0]?.email || '',
            store_settings: product.users[0]?.store_settings
          },
          likes: product.likes,
          like_count: product.likes?.length || 0
        }))
        .sort((a, b) => b.like_count - a.like_count)
        .slice(0, 10);

      setMostLikedProducts(processedLikedProducts);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          likes (count),
          ratings (
            rating
          ),
          users (
            id,
            full_name,
            email,
            store_settings
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process products and calculate combined score
      const processedProducts = products?.map(product => {
        const likeCount = product.likes?.[0]?.count || 0;
        const ratings = product.ratings || [];
        const averageRating = ratings.length > 0
          ? ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratings.length
          : 0;
        
        const normalizedLikes = Math.min(likeCount / 20, 5);
        const combinedScore = (normalizedLikes + averageRating) / 2;

        return {
          ...product,
          like_count: likeCount,
          average_rating: averageRating,
          combined_score: combinedScore,
          product_images: product.product_images?.map((img: ProductImage) => ({
            ...img,
            image_url: cleanImageUrl(img.image_url)
          }))
        };
      }) || [];

      const sortedProducts = processedProducts.sort((a, b) => 
        (b.combined_score || 0) - (a.combined_score || 0)
      );
      
      setPopularProducts(sortedProducts.slice(0, 6));
    } catch (error) {
      console.error('Error fetching popular products:', error);
    }
  };

  useEffect(() => {
    const fetchFlashSales = async () => {
      try {
        const { data: flashSales, error } = await supabase
          .from('flash_sales')
          .select(`
            *,
            products:flash_sale_products (
              id,
              product_id,
              special_price,
              product:products (
                id,
                title,
                price,
                description,
                product_images (
                  id,
                  image_url
                )
              )
            )
          `)
          .eq('is_active', true)
          .gte('end_time', new Date().toISOString())
          .lte('start_time', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;
        setActiveFlashSales(flashSales || []);
      } catch (err) {
        console.error('Error fetching flash sales:', err);
      }
    };

    fetchFlashSales();
  }, []);

  // First, create a function to get all flash sale products
  const getAllFlashSaleProducts = () => {
    return activeFlashSales.reduce((allProducts, flashSale) => {
      return [...allProducts, ...(flashSale.products || [])];
    }, [] as FlashSaleProduct[]);
  };

  // Then update the renderFlashSales function
  const renderFlashSales = () => {
    if (!activeFlashSales.length) return null;

    const allFlashProducts = getAllFlashSaleProducts();

    return (
      <section className="relative py-6">
        <div className={sectionGradientStyles}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <AnimatedTitle>
                Flash Deals
              </AnimatedTitle>
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-semibold animate-pulse">⚡ Limited Time Offers</span>
              </div>
            </div>
          </div>

          {/* Carousel Container */}
          <div className="relative">
            {/* Navigation Buttons - Positioned outside */}
            <button 
              onClick={() => scrollFlashSales('left')}
              className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 z-20 
                bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                rounded-full p-4 shadow-lg shadow-red-500/20
                hover:from-red-500 hover:to-pink-500 
                transition-all duration-300
                text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button 
              onClick={() => scrollFlashSales('right')}
              className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 z-20 
                bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                rounded-full p-4 shadow-lg shadow-red-500/20
                hover:from-red-500 hover:to-pink-500 
                transition-all duration-300
                text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Flash Sales Carousel */}
            <div 
              ref={flashSalesRef}
              className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0"
              onTouchStart={(e) => handleTouchStart(e, flashSalesRef)}
              onTouchMove={(e) => handleTouchMove(e, flashSalesRef)}
              onTouchEnd={(e) => handleTouchEnd(e, flashSalesRef)}
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <div className={`
                flex gap-3 md:gap-4 pb-3 min-w-full
                ${allFlashProducts.length <= 4 ? 'md:justify-center' : ''}
              `}>
                {allFlashProducts.map((flashProduct, index) => (
                  <motion.div
                    key={flashProduct.id}
                    className="flex-none w-[280px] md:w-[320px] snap-center first:ml-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Link
                      href={`/products/${flashProduct.product.id}`}
                      className="block relative bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-gray-800/70 group"
                    >
                      {/* Countdown Timer */}
                      <div className="absolute top-2 right-2 z-10">
                        <CountdownTimer 
                          endTime={activeFlashSales[0]?.end_time || ''} 
                          className="text-xs bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full"
                        />
                      </div>

                      {/* Discount Badge */}
                      <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                      </div>

                      <div className="aspect-w-1 aspect-h-1 relative bg-[#0A0A0A]">
                        <Image
                          src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                          alt={flashProduct.product.title}
                          fill
                          className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-500">
                            {flashProduct.product.title}
                          </h3>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                              ETB {flashProduct.special_price.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Progress Dots */}
            <div className="hidden md:flex justify-center mt-6 space-x-2">
              {Array.from({ length: Math.ceil(allFlashProducts.length / 4) }).map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => scrollToFlashSalePage(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 
                    ${currentFlashSalePage === index 
                      ? 'w-8 bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50'
                      : 'bg-gradient-to-r from-red-500/30 to-pink-500/30'
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Mobile swipe indicator */}
          <div className="md:hidden flex justify-center mt-3">
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Swipe to explore
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // Add these state and refs for Flash Sales carousel
  const flashSalesRef = useRef<HTMLDivElement>(null);
  const [currentFlashSalePage, setCurrentFlashSalePage] = useState(0);

  const scrollFlashSales = (direction: 'left' | 'right') => {
    if (!flashSalesRef.current) return;
    
    const container = flashSalesRef.current;
    const scrollAmount = window.innerWidth < 768
      ? container.clientWidth * 0.8  // Mobile: scroll 80% of container
      : container.clientWidth;       // Desktop: scroll full container

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    if (direction === 'left') {
      const newScroll = Math.max(0, currentScroll - scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentFlashSalePage(Math.floor(newScroll / scrollAmount));
    } else {
      const newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentFlashSalePage(Math.floor(newScroll / scrollAmount));
    }
  };

  const scrollToFlashSalePage = (pageIndex: number) => {
    if (!flashSalesRef.current) return;
    
    const container = flashSalesRef.current;
    const scrollAmount = container.clientWidth * pageIndex;
    
    container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    setCurrentFlashSalePage(pageIndex);
  };

  // Add these functions inside your HomePage component
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categoriesRef.current) return;
    
    const container = categoriesRef.current;
    const scrollAmount = window.innerWidth < 768 
      ? container.clientWidth * 0.8  // Mobile: scroll 80% of container
      : container.clientWidth;       // Desktop: scroll full container

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    if (direction === 'left') {
      const newScroll = Math.max(0, currentScroll - scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentPage(Math.floor(newScroll / scrollAmount));
    } else {
      const newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentPage(Math.floor(newScroll / scrollAmount));
    }
  };

  const scrollToPage = (pageIndex: number) => {
    if (!categoriesRef.current) return;
    
    const container = categoriesRef.current;
    const scrollAmount = container.clientWidth * pageIndex;
    
    container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    setCurrentPage(pageIndex);
  };

  // Add this ref and state for Most Loved Products carousel
  const lovedProductsRef = useRef<HTMLDivElement>(null);
  const [currentLovedPage, setCurrentLovedPage] = useState(0);

  // First, update the scroll function for Trending Products
  const scrollLovedProducts = (direction: 'left' | 'right') => {
    if (!lovedProductsRef.current) return;
    
    const container = lovedProductsRef.current;
    const scrollAmount = window.innerWidth < 768
      ? container.clientWidth * 0.8  // Mobile: scroll 80% of container
      : container.clientWidth;       // Desktop: scroll full container

    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    if (direction === 'left') {
      const newScroll = Math.max(0, currentScroll - scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentLovedPage(Math.floor(newScroll / scrollAmount));
    } else {
      const newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
      setCurrentLovedPage(Math.floor(newScroll / scrollAmount));
    }
  };

  // Update the Trending Products carousel structure
  <div 
    ref={lovedProductsRef}
    className={carouselStyles.container}
  >
    <div 
      className={`
        ${carouselStyles.wrapper}
        ${popularProducts.length <= 4 ? 'md:justify-center' : ''}
      `}
    >
      {popularProducts.map((product, index) => (
        <motion.div
          key={product.id}
          className={`
            ${carouselStyles.card}
            ${index === 0 ? 'ml-0' : ''}  // Ensure first card has no margin
          `}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link
            href={`/products/${product.id}`}
            className="block relative bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-gray-800/70 group"
          >
            <div className="aspect-w-1 aspect-h-1 relative bg-[#0A0A0A]">
              <Image
                src={cleanImageUrl(product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                alt={product.title}
                fill
                className="object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-500">
                  {product.title}
                </h3>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {product.average_rating?.toFixed(1) || '0.0'}
                  </div>
                  <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                    {product.like_count}
                  </div>
                  <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                    ETB {product.price.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  </div>

  // Update the useEffect to properly reset scroll position
  useEffect(() => {
    const resetScroll = () => {
      if (lovedProductsRef.current) {
        lovedProductsRef.current.scrollLeft = 0;
        // Force a reflow to ensure scroll position is reset
        lovedProductsRef.current.offsetHeight;
      }
    };

    resetScroll();
    
    // Also reset on window resize
    window.addEventListener('resize', resetScroll);
    return () => window.removeEventListener('resize', resetScroll);
  }, [popularProducts]); // Reset when products change

  // Update the progress indicator
  <div className="hidden md:flex justify-center mt-6 space-x-2">
    {Array.from({ length: Math.ceil(popularProducts.length / 4) }).map((_, index) => (
      <motion.button
        key={index}
        onClick={() => {
          if (!lovedProductsRef.current) return;
          const scrollAmount = lovedProductsRef.current.clientWidth * index;
          lovedProductsRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
          setCurrentLovedPage(index);
        }}
        className={`${carouselStyles.progressDot} ${
          currentLovedPage === index ? carouselStyles.progressDotActive : ''
        }`}
      />
    ))}
  </div>

  // Add these refs and states at the top of your component
  const brandsRef = useRef<HTMLDivElement>(null);
  const [currentBrandsPage, setCurrentBrandsPage] = useState(0);

  // Add these scroll functions for Featured Brands
  const scrollBrands = (direction: 'left' | 'right') => {
    if (!brandsRef.current) return;
    
    const container = brandsRef.current;
    const scrollAmount = container.clientWidth;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentBrandsPage(prev => Math.max(0, prev - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentBrandsPage(prev => 
        Math.min(Math.ceil(featuredBrands.length / 4) - 1, prev + 1)
      );
    }
  };

  const scrollToBrandsPage = (pageIndex: number) => {
    if (!brandsRef.current) return;
    
    const container = brandsRef.current;
    const scrollAmount = container.clientWidth * pageIndex;
    
    container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    setCurrentBrandsPage(pageIndex);
  };

  // Add a useEffect to ensure first card is visible on mobile
  useEffect(() => {
    const resetScroll = () => {
      if (window.innerWidth < 768) {  // Mobile only
        if (flashSalesRef.current) flashSalesRef.current.scrollLeft = 0;
        if (categoriesRef.current) categoriesRef.current.scrollLeft = 0;
        if (brandsRef.current) brandsRef.current.scrollLeft = 0;
        if (lovedProductsRef.current) lovedProductsRef.current.scrollLeft = 0;
      }
    };

    resetScroll();
    window.addEventListener('resize', resetScroll);
    return () => window.removeEventListener('resize', resetScroll);
  }, []);

  // Add this useEffect to handle initial scroll position and touch events
  useEffect(() => {
    const resetScroll = () => {
      if (lovedProductsRef.current) {
        // Reset scroll position to 0
        lovedProductsRef.current.scrollLeft = 0;
        
        // Add touch event handling for mobile
        let startX: number;
        let scrollLeft: number;
        
        const handleTouchStart = (e: TouchEvent) => {
          startX = e.touches[0].pageX - lovedProductsRef.current!.offsetLeft;
          scrollLeft = lovedProductsRef.current!.scrollLeft;
        };
        
        const handleTouchMove = (e: TouchEvent) => {
          if (!startX) return;
          
          const x = e.touches[0].pageX - lovedProductsRef.current!.offsetLeft;
          const walk = (x - startX) * 2; // Scroll speed multiplier
          lovedProductsRef.current!.scrollLeft = scrollLeft - walk;
          
          // Prevent page scrolling while swiping carousel
          e.preventDefault();
        };
        
        lovedProductsRef.current.addEventListener('touchstart', handleTouchStart);
        lovedProductsRef.current.addEventListener('touchmove', handleTouchMove);
        
        return () => {
          lovedProductsRef.current?.removeEventListener('touchstart', handleTouchStart);
          lovedProductsRef.current?.removeEventListener('touchmove', handleTouchMove);
        };
      }
    };

    resetScroll();
    
    // Also reset scroll position when window is resized
    window.addEventListener('resize', resetScroll);
    return () => window.removeEventListener('resize', resetScroll);
  }, [popularProducts]); // Reset when products change

  // Add these new refs for touch handling
  const touchStartRef = useRef<TouchPosition | null>(null);
  const isSwiping = useRef(false);

  // Add this function to handle touch events
  const handleTouchStart = (e: React.TouchEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now()
    };
  };

  const handleTouchMove = (e: React.TouchEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!touchStartRef.current || !ref.current || isSwiping.current) return;

    const touchEnd = e.touches[0];
    const deltaX = touchStartRef.current.startX - touchEnd.clientX;
    const deltaY = touchStartRef.current.startY - touchEnd.clientY;
    const deltaTime = Date.now() - touchStartRef.current.startTime;

    // Check if horizontal scroll should be triggered
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && deltaTime < 300) {
      isSwiping.current = true;
      
      if (deltaX > 0) {
        // Swipe left, go right
        if (ref === categoriesRef) scrollCategories('right');
        if (ref === flashSalesRef) scrollFlashSales('right');
      } else {
        // Swipe right, go left
        if (ref === categoriesRef) scrollCategories('left');
        if (ref === flashSalesRef) scrollFlashSales('left');
      }

      // Reset after animation
      setTimeout(() => {
        isSwiping.current = false;
        touchStartRef.current = null;
      }, 300);
    }
  };

  // Update the handleTouchEnd function to accept the event and ref parameters
  const handleTouchEnd = (e: React.TouchEvent, ref: React.RefObject<HTMLDivElement>) => {
    touchStartRef.current = null;
    isSwiping.current = false;
  };

  // Add these refs and states at the top of your component
  const touchStartX = useRef<number | null>(null);

  // Add touch event handlers in useEffect
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartX.current) return;

      const touchEndX = e.touches[0].clientX;
      const diffX = touchStartX.current - touchEndX;

      if (diffX > 50) {
        scrollCategories('right');
        scrollFlashSales('right');
      } else if (diffX < -50) {
        scrollCategories('left');
        scrollFlashSales('left');
      }

      touchStartX.current = null;
    };

    const categoryContainer = categoriesRef.current;
    const flashSaleContainer = flashSalesRef.current;

    if (categoryContainer) {
      categoryContainer.addEventListener('touchstart', handleTouchStart);
      categoryContainer.addEventListener('touchmove', handleTouchMove);
    }

    if (flashSaleContainer) {
      flashSaleContainer.addEventListener('touchstart', handleTouchStart);
      flashSaleContainer.addEventListener('touchmove', handleTouchMove);
    }

    return () => {
      if (categoryContainer) {
        categoryContainer.removeEventListener('touchstart', handleTouchStart);
        categoryContainer.removeEventListener('touchmove', handleTouchMove);
      }
      if (flashSaleContainer) {
        flashSaleContainer.removeEventListener('touchstart', handleTouchStart);
        flashSaleContainer.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, []);

  // Add the handleCategoryClick function here
  const handleCategoryClick = async (categoryName: string) => {
    try {
      // Navigate to products page with category filter
      const formattedCategory = categoryName === 'All' ? 'all' : categoryName.toLowerCase();
      await router.push(`/products?category=${formattedCategory}`);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback
      window.location.href = `/products?category=${categoryName.toLowerCase()}`;
    }
  };

  const handleSubscribe = async (email: string, type: 'notify_me' | 'newsletter') => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setSubscriptionLoading(true);
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      toast.success(data.message);
      if (type === 'notify_me') {
        setNotifyEmail('');
      } else {
        setNewsletterEmail('');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(notifyEmail, 'notify_me');
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(newsletterEmail, 'newsletter');
  };

  // Add a useEffect for mobile swipe on brandsRef (Featured Brands)
  useEffect(() => {
    const brandsContainer = brandsRef.current;
    if (!brandsContainer) return;

    let startX: number;
    let scrollLeft: number;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].pageX - brandsContainer.offsetLeft;
      scrollLeft = brandsContainer.scrollLeft;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startX === undefined) return;
      const x = e.touches[0].pageX - brandsContainer.offsetLeft;
      const walk = (x - startX) * 2; // Scroll speed multiplier
      brandsContainer.scrollLeft = scrollLeft - walk;
      e.preventDefault(); // Prevent page scroll
    };

    brandsContainer.addEventListener('touchstart', handleTouchStart);
    brandsContainer.addEventListener('touchmove', handleTouchMove);

    return () => {
      brandsContainer.removeEventListener('touchstart', handleTouchStart);
      brandsContainer.removeEventListener('touchmove', handleTouchMove);
    };
  }, [featuredBrands.length]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowMobilePopup(true);
    }
  }, []);

  return (
    <>
      {showMobilePopup && (
        <div className="fixed top-0 left-0 w-full z-[9999] flex justify-center items-center px-2 py-3 bg-yellow-100 border-b border-yellow-300 shadow-lg animate-fadeIn">
          <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto">
            <span className="text-sm font-semibold text-yellow-800 text-center">
              For better interaction and smooth experience, we recommend using a computer or laptop until the mobile version is fixed.<br/>
              <span className="block mt-1 text-xs font-normal text-yellow-700">የተሻለ ተግባራዊነት እና ምቹ አገልግሎት ለማግኘት እስከ mobile እትክክል እስኪሻሽ ድረስ ኮምፒውተር/ላፕቶፕ መጠቀም ይመከራል።</span>
            </span>
            <button
              className="mt-2 px-4 py-1.5 rounded bg-yellow-300 text-yellow-900 font-medium hover:bg-yellow-400 transition"
              onClick={() => setShowMobilePopup(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="min-h-screen relative bg-gray-900 overflow-hidden w-full">
        <ScrollProgress />
        <BackToTopButton />

        
        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-4rem)] flex items-center text-white pt-16 sm:pt-20 md:pt-0">
          <div className="relative w-full py-8 md:py-16">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Text Content */}
                <div className="relative z-10 text-center md:text-left mt-8 sm:mt-12 md:mt-0">
                  <motion.h1
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    Discover Ethiopian Products & More
                  </motion.h1>
                  <motion.p
                    className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 max-w-xl mx-auto md:mx-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    Shop the latest in electronics, home goods, fashion, and more from Ethiopian sellers
                  </motion.p>
                  <motion.div 
                    className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Link
                      href="/products"
                      className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg text-white font-medium hover:from-red-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                    >
                      Start Shopping
                      <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                    {!user && (
                      <Link
                        href="/signup?role=owner"
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                      >
                        Become a Seller
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </Link>
                    )}
                  </motion.div>
                </div>

                {/* Image Grid */}
                <div className="relative mt-8 md:mt-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                    {[
                      { src: '/images/categories/electronics.jpg', alt: 'Electronics', delay: 0.2 },
                      { src: '/images/categories/modern.jpg', alt: 'Modern Fashion', delay: 0.4 },
                      { src: '/images/categories/accessories.jpg', alt: 'Accessories', delay: 0.6 },
                      { src: '/images/categories/beauty.jpg', alt: 'Beauty', delay: 0.8 }
                    ].map((image, index) => (
                      <motion.div
                        key={image.alt}
                        className={`relative ${
                          index % 2 === 1 ? 'mt-4 sm:mt-8 md:mt-12' : index === 2 ? '-mt-4 sm:-mt-8 md:-mt-12' : ''
                        }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: image.delay }}
                        whileHover={{ scale: 1.05 }}
                      >
                        {/* Update the image container */}
                        <div className="relative w-full pt-[100%]">
                          <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 20vw"
                            className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg"
                            priority={index === 0}
                            quality={75}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator - Hide on mobile */}
          <div className="hidden md:block">
            <ScrollIndicator />
          </div>
        </section>

        {/* Category Bubbles - moved here */}
        <div className="relative -mt-12 mb-8"> {/* Added mb-8 for bottom margin */}
          <CategoryBubbles />
        </div>

        <SectionDivider />
        
        {/* Stats Section */}
        <AnimatedSection className="py-6 overflow-hidden" delay={0.2}>
          <div className={sectionGradientStyles}>
            {/* Achievement Badges */}
            <div className="mb-12">
              <AchievementBadges />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">10K+</div>
                <div className="text-sm text-gray-400">Active Users</div>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">5K+</div>
                <div className="text-sm text-gray-400">Products Listed</div>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">1K+</div>
                <div className="text-sm text-gray-400">Verified Sellers</div>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">4.8</div>
                <div className="text-sm text-gray-400">Average Rating</div>
              </motion.div>
            </div>
          </div>
        </AnimatedSection>

        <SectionDivider />
        
        {/* Featured Collections */}
        <AnimatedSection className="py-6" delay={0.3}>
          <div className={sectionGradientStyles}>
            <div className="flex items-center justify-between mb-6">
              <AnimatedTitle>
                Featured Collections
              </AnimatedTitle>
            </div>
            <FeaturedCollection />
          </div>
        </AnimatedSection>

        <SectionDivider />
        
        {/* Flash Sales Section */}
        {activeFlashSales.length > 0 && (
          <>
            <AnimatedSection className="py-3" delay={0.4}>
              <div className={sectionGradientStyles}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <AnimatedTitle>
                      Flash Deals
                    </AnimatedTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 text-sm font-semibold animate-pulse">⚡ Limited Time</span>
                    </div>
                  </div>
                </div>

                {/* Flash Sales Carousel */}
                <div className="relative">
                  {/* Navigation Buttons */}
                  <button 
                    onClick={() => scrollFlashSales('left')}
                    className={`${carouselStyles.navButton} left-0 -translate-x-full`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => scrollFlashSales('right')}
                    className={`${carouselStyles.navButton} right-0 translate-x-full`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Flash Sales Products */}
                  <div 
                    ref={flashSalesRef}
                    className={carouselStyles.container}
                    onTouchStart={(e) => handleTouchStart(e, flashSalesRef)}
                    onTouchMove={(e) => handleTouchMove(e, flashSalesRef)}
                    onTouchEnd={(e) => handleTouchEnd(e, flashSalesRef)}
                  >
                    <div className={`
                      ${carouselStyles.wrapper}
                      ${getAllFlashSaleProducts().length <= 4 ? 'md:justify-center' : ''}
                    `}>
                      {getAllFlashSaleProducts().map((flashProduct, index) => (
                        <motion.div
                          key={flashProduct.id}
                          className="flex-none w-[240px] md:w-[280px] snap-center first:ml-0"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <Link
                            href={`/products/${flashProduct.product.id}`}
                            className="block relative bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-gray-800/70 group"
                          >
                            {/* Countdown Timer */}
                            <div className="absolute top-2 right-2 z-10">
                              <CountdownTimer 
                                endTime={activeFlashSales[0]?.end_time || ''} 
                                className="text-xs bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full"
                              />
                            </div>

                            {/* Discount Badge */}
                            <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                              -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}%
                            </div>

                            <div className="aspect-w-1 aspect-h-1 relative bg-[#0A0A0A]">
                              <Image
                                src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                                alt={flashProduct.product.title}
                                fill
                                className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>

                            <div className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-500">
                                  {flashProduct.product.title}
                                </h3>
                                <div className="flex-shrink-0">
                                  <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                                    ETB {flashProduct.special_price.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Progress Dots */}
                  <div className="hidden md:flex justify-center mt-4 space-x-2">
                    {Array.from({ length: Math.ceil(getAllFlashSaleProducts().length / 4) }).map((_, index) => (
                      <motion.button
                        key={index}
                        onClick={() => scrollToFlashSalePage(index)}
                        className={`${carouselStyles.progressDot} ${
                          currentFlashSalePage === index ? carouselStyles.progressDotActive : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </AnimatedSection>
            <SectionDivider />
          </>
        )}

        {/* Featured Categories */}
        <AnimatedSection className="py-4" delay={0.3}> {/* Changed from py-6 to py-4 */}
          <ParallaxSection>
            <div className={sectionGradientStyles}>
              <div className="flex items-center justify-between mb-6">
                <AnimatedTitle>
                  Featured Categories
                </AnimatedTitle>
              </div>
              
              <div className="relative">
                {/* Navigation Buttons */}
                <button 
                  onClick={() => scrollCategories('left')}
                  className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 z-20 
                    bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                    rounded-full p-4 shadow-lg shadow-red-500/20
                    hover:from-red-500 hover:to-pink-500 
                    transition-all duration-300
                    text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button 
                  onClick={() => scrollCategories('right')}
                  className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 z-20 
                    bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                    rounded-full p-4 shadow-lg shadow-red-500/20
                    hover:from-red-500 hover:to-pink-500 
                    transition-all duration-300
                    text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Categories Carousel */}
                <div 
                  ref={categoriesRef}
                  className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0 scroll-smooth"
                  onTouchStart={(e) => handleTouchStart(e, categoriesRef)}
                  onTouchMove={(e) => handleTouchMove(e, categoriesRef)}
                  onTouchEnd={(e) => handleTouchEnd(e, categoriesRef)}
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className={`
                    flex gap-3 md:gap-4 pb-3 min-w-full
                    ${categories.length <= 4 ? 'md:justify-center' : ''}
                  `}>
                    {categories.map((category, index) => (
                      <motion.div
                        key={category.name}
                        className="flex-none w-[280px] md:w-[320px] snap-center first:ml-0"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <button
                          onClick={() => handleCategoryClick(category.name)}
                          className="block relative h-[200px] rounded-lg overflow-hidden group touch-pan-y w-full"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10"></div>
                          <Image
                            src={category.image}
                            alt={category.name}
                            fill
                            className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                            <div className="flex items-center gap-2 text-white mb-2">
                              {category.icon}
                              <h3 className="text-lg font-medium">{category.name}</h3>
                            </div>
                            <p className="text-sm text-gray-300">{category.description}</p>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Progress Dots */}
                <div className="hidden md:flex justify-center mt-6 space-x-2">
                  {Array.from({ length: Math.ceil(categories.length / 4) }).map((_, index) => (
                    <motion.button
                      key={index}
                      onClick={() => scrollToPage(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 
                        ${currentPage === index 
                          ? 'w-8 bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50'
                          : 'bg-gradient-to-r from-red-500/30 to-pink-500/30'
                          }`}
                    />
                  ))}
                </div>

                {/* Mobile swipe indicator */}
                <div className="md:hidden flex justify-center mt-3">
                  <div className="text-gray-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Swipe to explore
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </ParallaxSection>
        </AnimatedSection>

        <SectionDivider />

        {/* Featured Brands */}
        <AnimatedSection className="py-4" delay={0.4}> {/* Changed from py-6 to py-4 */}
          <div className={sectionGradientStyles}>
            <div className="flex items-center justify-between mb-4"> {/* Changed from mb-6 to mb-4 */}
              <AnimatedTitle>
                Featured Brands
              </AnimatedTitle>
            </div>
            <div className="relative">
              {/* Navigation Buttons */}
              <button 
                onClick={() => scrollBrands('left')}
                className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 z-20 
                  bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                  rounded-full p-4 shadow-lg shadow-red-500/20
                  hover:from-red-500 hover:to-pink-500 
                  transition-all duration-300
                  text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                onClick={() => scrollBrands('right')}
                className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 z-20 
                  bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                  rounded-full p-4 shadow-lg shadow-red-500/20
                  hover:from-red-500 hover:to-pink-500 
                  transition-all duration-300
                  text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Brands Carousel */}
              <div 
                ref={brandsRef}
                className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0"
                onTouchStart={(e) => handleTouchStart(e, brandsRef)}
                onTouchMove={(e) => handleTouchMove(e, brandsRef)}
                onTouchEnd={(e) => handleTouchEnd(e, brandsRef)}
              >
                <div className={`
                  flex gap-3 md:gap-4 pb-3 min-w-full
                  ${featuredBrands.length <= 4 ? 'md:justify-center' : ''}
                  ${featuredBrands.length === 1 ? 'justify-center' : ''}
                `}>
                  {featuredBrands.map((brand, index) => (
                    <motion.div
                      key={brand.seller_id}
                      className="flex-none w-[200px] md:w-[240px] snap-center first:ml-0"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={`/stores/${brand.seller_id}`}
                        className="group block"
                      >
                        <div className="relative bg-gray-800/50 backdrop-blur-sm p-3 transition-all duration-300 hover:bg-gray-800/70 rounded-xl">
                          {/* Update the image container: show initial if no logo_url */}
                          <div className="relative w-full pt-[100%] rounded-full overflow-hidden border-2 border-red-500/20 group-hover:border-red-500/40 transition-colors flex items-center justify-center">
                            {brand.store_settings.logo_url ? (
                              <Image
                                src={cleanImageUrl(brand.store_settings.logo_url)}
                                alt={brand.store_settings.name}
                                fill
                                sizes="(max-width: 640px) 200px, 240px"
                                className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-r from-gray-800 to-gray-900 select-none">
                                {brand.store_settings.name?.[0]?.toUpperCase() || brand.seller_name?.[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          {/* Rest of the brand card content */}
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <h3 className="text-sm font-medium text-white group-hover:text-red-400 transition-colors">
                                {brand.store_settings.name}
                              </h3>
                              {brand.verification_status === 'verified' && (
                                <div className="relative group/tooltip">
                                  <svg 
                                    className="w-4 h-4 text-blue-500" 
                                    viewBox="0 0 20 20" 
                                    fill="currentColor"
                                    aria-label="Verified Seller"
                                  >
                                    <path 
                                      fillRule="evenodd" 
                                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                                      clipRule="evenodd" 
                                    />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    Verified Seller
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-400 group-hover:text-gray-300 line-clamp-2">
                              {brand.store_settings.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Progress Dots */}
              <div className="hidden md:flex justify-center mt-6 space-x-2">
                {Array.from({ length: Math.ceil(featuredBrands.length / 4) }).map((_, index) => (
                  <motion.button
                    key={index}
                    onClick={() => scrollToBrandsPage(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 
                      ${currentBrandsPage === index 
                        ? 'w-8 bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50'
                        : 'bg-gradient-to-r from-red-500/30 to-pink-500/30'
                        }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>

        <SectionDivider />

        {/* Most Liked Products */}
        <AnimatedSection className="py-4" delay={0.5}> {/* Changed from py-6 to py-4 */}
          <ParallaxSection offset={30}>
            <div className={sectionGradientStyles}>
              <div className="flex items-center justify-between mb-4"> {/* Changed from mb-6 to mb-4 */}
                <div className="flex items-center gap-4">
                  <AnimatedTitle>
                    Trending Products
                  </AnimatedTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-semibold animate-pulse">🔥 Hot Items</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                {/* Navigation Buttons */}
                <button 
                  onClick={() => scrollLovedProducts('left')}
                  className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 z-20 
                    bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                    rounded-full p-4 shadow-lg shadow-red-500/20
                    hover:from-red-500 hover:to-pink-500 
                    transition-all duration-300
                    text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button 
                  onClick={() => scrollLovedProducts('right')}
                  className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 z-20 
                    bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm 
                    rounded-full p-4 shadow-lg shadow-red-500/20
                    hover:from-red-500 hover:to-pink-500 
                    transition-all duration-300
                    text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Products Carousel */}
                <div 
                  ref={lovedProductsRef}
                  className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0 scroll-smooth"
                  onTouchStart={(e) => handleTouchStart(e, lovedProductsRef)}
                  onTouchMove={(e) => handleTouchMove(e, lovedProductsRef)}
                  onTouchEnd={(e) => handleTouchEnd(e, lovedProductsRef)}
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className={`
                    flex gap-3 md:gap-4 pb-3 min-w-full
                    ${popularProducts.length <= 4 ? 'md:justify-center' : ''}
                  `}>
                    {popularProducts.map((product, index) => (
                      <motion.div
                        key={product.id}
                        className="flex-none w-[280px] md:w-[320px] snap-center first:ml-0"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link
                          href={`/products/${product.id}`}
                          className="block relative bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-gray-800/70 group"
                        >
                          {/* Updated image container */}
                          <div className="relative w-full pt-[100%] bg-gray-900">
                            {product.product_images && product.product_images[0] ? (
                              <Image
                                src={cleanImageUrl(product.product_images[0].image_url)}
                                alt={product.title}
                                fill
                                sizes="(max-width: 640px) 280px, 320px"
                                priority={index < 2}
                                quality={75}
                                className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = PLACEHOLDER_IMAGE;
                                }}
                              />
                            ) : (
                              // Placeholder for products without images
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <svg
                                  className="w-12 h-12 text-gray-600"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            )}

                            {/* Category tag */}
                            <div className="absolute top-2 left-2 z-10">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-800">
                                {product.category}
                              </span>
                            </div>

                            {/* Flash sale badge */}
                            {product.flash_sale_price && (
                              <div className="absolute top-2 right-2 z-10">
                                <div className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                                  SALE
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Rest of your existing product card content */}
                          <div className="p-4">
                            {/* Title */}
                            <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-500 mb-3">
                              {product.title}
                            </h3>

                            {/* Price section */}
                            <div className="flex items-center justify-between mb-3">
                              {product.flash_sale_price ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-red-500">
                                    ETB {product.flash_sale_price.toLocaleString()}
                                  </span>
                                  <span className="text-sm text-gray-400 line-through">
                                    ETB {product.price.toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-white">
                                  ETB {product.price.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {/* Rating and Likes */}
                            <div className="flex items-center justify-between border-t border-gray-700/50 pt-3">
                              <div className="flex items-center gap-3">
                                {/* Rating */}
                                <div className="flex items-center">
                                  <svg 
                                    className="w-4 h-4 text-yellow-500" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="ml-1 text-sm text-gray-300">
                                    {product.average_rating?.toFixed(1) || '0.0'}
                                  </span>
                                </div>

                                {/* Likes */}
                                <div className="flex items-center">
                                  <svg 
                                    className="w-4 h-4 text-red-500" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                  </svg>
                                  <span className="ml-1 text-sm text-gray-300">
                                    {product.like_count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Progress Dots */}
                <div className="hidden md:flex justify-center mt-6 space-x-2">
                  {Array.from({ length: Math.ceil(popularProducts.length / 4) }).map((_, index) => (
                    <motion.button
                      key={index}
                      onClick={() => {
                        if (!lovedProductsRef.current) return;
                        const scrollAmount = lovedProductsRef.current.clientWidth * index;
                        lovedProductsRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
                        setCurrentLovedPage(index);
                      }}
                      className={`w-2 h-2 rounded-full transition-all duration-300 
                        ${currentLovedPage === index 
                          ? 'w-8 bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50'
                          : 'bg-gradient-to-r from-red-500/30 to-pink-500/30'
                          }`}
                    />
                  ))}
                </div>

                {/* Mobile swipe indicator */}
                <div className="md:hidden flex justify-center mt-3">
                  <div className="text-gray-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Swipe to explore
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </ParallaxSection>
        </AnimatedSection>

        <SectionDivider />

        {/* Why Choose Us */}
        <AnimatedSection className="py-6" delay={0.6}>
          <ParallaxSection offset={40}>
            <div className={sectionGradientStyles}>
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Why Choose AVRIO
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {features.map((feature) => (
                  <div key={feature.title} className="text-center bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-6">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-300">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ParallaxSection>
        </AnimatedSection>

        <SectionDivider />

        {/* Testimonials Section */}
        <AnimatedSection className="py-6" delay={0.7}>
          <div className={sectionGradientStyles}>
            <TestimonialCarousel />
          </div>
        </AnimatedSection>

        <SectionDivider />

        {/* Download App Section */}
        <AnimatedSection className="py-6" delay={0.8}>
          <div className={sectionGradientStyles}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-6">Shop On The Go</h2>
                  <p className="text-xl text-gray-300 mb-8">
                    Our mobile app is coming soon! Get ready for a better shopping experience
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      disabled
                      className="btn-hover-effect flex items-center justify-center px-6 py-3 bg-gray-800 text-gray-400 rounded-lg relative overflow-hidden group cursor-not-allowed"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-pink-500/10 animate-pulse"></div>
                      <div className="flex items-center">
                        <svg className="w-6 h-6 mr-2 opacity-50" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                        </svg>
                        <div>
                          <div className="text-xs">Coming soon on</div>
                          <div className="text-sm font-semibold">App Store</div>
                        </div>
                      </div>
                    </button>
                    <button 
                      disabled
                      className="btn-hover-effect flex items-center justify-center px-6 py-3 bg-gray-800 text-gray-400 rounded-lg relative overflow-hidden group cursor-not-allowed"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-pink-500/10 animate-pulse"></div>
                      <div className="flex items-center">
                        <svg className="w-6 h-6 mr-2 opacity-50" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                        </svg>
                        <div>
                          <div className="text-xs">Coming soon on</div>
                          <div className="text-sm font-semibold">Google Play</div>
                        </div>
                      </div>
                    </button>
                  </div>
                  {/* Add a notification signup */}
                  <div className="mt-8">
                    <p className="text-sm text-gray-400 mb-4">
                      Be the first to know when our app launches!
                    </p>
                    {/* Notify Me form */}
                    <motion.form 
                      onSubmit={handleNotifySubmit}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="max-w-md mx-auto w-full"
                    >
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                        <input
                          type="email"
                          placeholder="Enter your email"
                          value={notifyEmail}
                          onChange={(e) => setNotifyEmail(e.target.value)}
                          className="flex-1 px-4 sm:px-6 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full focus:outline-none focus:border-red-500 text-white placeholder-gray-400 w-full"
                          disabled={subscriptionLoading}
                        />
                        <button
                          type="submit"
                          disabled={subscriptionLoading}
                          className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full hover:from-red-500 hover:to-pink-500 transition-colors transform hover:scale-105 duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {subscriptionLoading ? 'Subscribing...' : 'Notify Me'}
                        </button>
                      </div>
                    </motion.form>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-red-500 to-pink-500 opacity-20 blur-3xl rounded-full"></div>
                  <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-3xl p-4 border border-gray-700/50">
                    <Image
                      src="/images/app/app-preview.jpg"
                      alt="AVRIO Mobile App Preview"
                      width={300}
                      height={600}
                      className="relative mx-auto transform hover:scale-105 transition-transform duration-300 rounded-2xl shadow-2xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-3xl flex items-end justify-center pb-8">
                      <div className="text-center bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full">
                        <p className="text-sm font-medium text-white">Coming Soon</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <SectionDivider />

        {/* Newsletter Section */}
        <AnimatedSection className="relative py-12 w-full"> {/* Updated padding and added relative */}
          <div className={sectionGradientStyles}>
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Added relative and adjusted max-width */}
              <div className="text-center">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-3xl md:text-4xl font-bold text-white mb-4"
                >
                  Stay Updated
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-gray-300 mb-8"
                >
                  Subscribe to our newsletter for exclusive deals and updates
                </motion.p>
                {/* Newsletter form */}
                <motion.form 
                  onSubmit={handleNewsletterSubmit}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="max-w-md mx-auto w-full"
                >
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="flex-1 px-4 sm:px-6 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full focus:outline-none focus:border-red-500 text-white placeholder-gray-400 w-full"
                      disabled={subscriptionLoading}
                    />
                    <button
                      type="submit"
                      disabled={subscriptionLoading}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full hover:from-red-500 hover:to-pink-500 transition-colors transform hover:scale-105 duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {subscriptionLoading ? 'Subscribing...' : 'Subscribe'}
                    </button>
                  </div>
                </motion.form>
              </div>
            </div>
          </div>
          
          {/* Add decorative elements */}
          <div className="absolute -top-40 left-0 right-0 bottom-0 bg-gradient-to-b from-transparent to-gray-900/50 pointer-events-none"></div>
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-red-500/20 rounded-full filter blur-3xl animate-pulse"></div>
            <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-pink-500/20 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
          </div>
        </AnimatedSection>

        <SectionDivider />

        {/* Footer Section */}
        <footer className="relative py-12 w-full border-t border-gray-800">
          <div className={sectionGradientStyles}>
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8 px-4 sm:px-6 lg:px-8">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">AVRIO</h3>
                <p className="text-gray-400 text-sm">
                  Your premier destination for Ethiopian fashion and lifestyle products.
                </p>
                <div className="flex space-x-4">
                  {/* Social Media Links */}
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <span className="sr-only">Facebook</span>
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <span className="sr-only">Instagram</span>
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    <span className="sr-only">Twitter</span>
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/products" className="text-gray-400 hover:text-white transition-colors">
                      Shop
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h3>
                <ul className="space-y-2">
                  {PRODUCT_CATEGORIES
                    .filter(category => 
                      // Filter to show only main categories
                      ['Traditional Wear', 'Modern Fashion', 'Home & Living', 'Beauty & Personal Care']
                      .includes(category)
                    )
                    .map((category: string) => (
                      <li key={category}>
                        <Link 
                          href={`/products?category=${category.toLowerCase()}`}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {category}
                  </Link>
                </li>
                ))}
                <li>
                  <Link 
                    href="/products"
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    View All Categories
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact Us</h3>
              <ul className="space-y-2">
                <li className="text-gray-400">
                  <span className="block">Addis Ababa, Ethiopia</span>
                </li>
                <li>
                  <a href="tel:+251912841237" className="text-gray-400 hover:text-white transition-colors">
                    +251 91 284 1237
                  </a>
                </li>
                <li>
                  <a href={`mailto:${EMAIL_CONFIG.SUPPORT}`} className="text-gray-400 hover:text-white transition-colors">
                    {EMAIL_CONFIG.SUPPORT}
                  </a>
                </li>
              </ul>
            </div>

            {/* Security */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Security</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/security-policy" className="text-gray-400 hover:text-white transition-colors">
                    Security Policy
                  </Link>
                </li>
                <li>
                  <Link href="/.well-known/security.txt" className="text-gray-400 hover:text-white transition-colors">
                    Security.txt
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/careers" className="text-gray-400 hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            {/* Telegram Integration */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Stay Connected</h3>
              <div className="space-y-3">
                <a 
                  href="https://t.me/Avrioxshop_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>Get Telegram Updates</span>
                </a>
                <p className="text-xs text-gray-500">
                  Get instant notifications about orders, deliveries, and exclusive offers!
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} AVRIO. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <button 
                  onClick={() => setActivePolicy({ 
                    title: 'Privacy Policy', 
                    content: <PrivacyPolicyContent /> 
                  })}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Privacy Policy
                </button>
                <button 
                  onClick={() => setActivePolicy({ 
                    title: 'Terms of Service', 
                    content: <TermsOfServiceContent /> 
                  })}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Terms of Service
                </button>
                <button 
                  onClick={() => setActivePolicy({ 
                    title: 'Shipping Policy', 
                    content: <ShippingPolicyContent /> 
                  })}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Shipping Policy
                </button>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-red-500/5 rounded-full filter blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full filter blur-3xl"></div>
          </div>
        </div>
      </footer>

      {/* Add the modal */}
      {activePolicy && (
        <PolicyModal
          isOpen={!!activePolicy}
          onClose={() => setActivePolicy(null)}
          policy={activePolicy}
        />
      )}
    </div>
  </>
  );
}

  // Test comment for CI/CD
