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
import { FloatingPreview } from '@/components/FloatingPreview';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

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

// Also add back the sectionGradientStyles
const sectionGradientStyles = `
  relative z-10 w-full max-w-[1440px] mx-auto px-4 lg:px-8
  before:absolute before:-left-[200px] before:top-1/2 before:-translate-y-1/2 before:w-[400px] before:h-[400px]
  before:bg-gradient-to-r before:from-transparent before:via-red-900/10 before:to-transparent
  before:rounded-full before:blur-3xl before:-z-10
  after:absolute after:-right-[200px] after:top-1/2 after:-translate-y-1/2 after:w-[400px] after:h-[400px]
  after:bg-gradient-to-l after:from-transparent after:via-red-900/10 after:to-transparent
  after:rounded-full after:blur-3xl after:-z-10
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

// Add this component at the top level of your page
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

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.5,
      }}
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </motion.button>
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
    <div className="relative py-4">
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
          <Link 
            href={`/categories/${category.name.toLowerCase()}`}
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
          </Link>
        </motion.div>
      ))}
    </div>
  );
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
  );
};

// First, add this component near your other component definitions
const FeaturedCollection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Summer Collection */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-8 group"
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-white mb-4">Summer Collection 2024</h3>
          <p className="text-white/80 mb-6">Discover our latest Ethiopian-inspired designs</p>
          <Link
            href="/collections/summer-2024"
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

      {/* Traditional Collection */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-red-500 p-8 group"
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-white mb-4">Traditional Collection</h3>
          <p className="text-white/80 mb-6">Authentic Ethiopian cultural wear & accessories</p>
          <Link
            href="/collections/traditional"
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

// Add this testimonials data near your other constants
const testimonials = [
  {
    text: "Amazing marketplace! Found authentic Ethiopian products that I couldn't find anywhere else.",
    name: "Abebe Kebede",
    location: "Addis Ababa",
    avatar: "/images/avatars/avatar-1.jpg"
  },
  {
    text: "The quality of traditional clothing is exceptional. Fast delivery and great customer service!",
    name: "Sara Mohammed",
    location: "Dire Dawa",
    avatar: "/images/avatars/avatar-2.jpg"
  },
  {
    text: "AVRIO has transformed how I shop for Ethiopian fashion. Love the variety and authenticity.",
    name: "Dawit Haile",
    location: "Bahir Dar",
    avatar: "/images/avatars/avatar-3.jpg"
  }
];

// Add the TestimonialCarousel component
const TestimonialCarousel = () => {
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  return (
    <div className="relative overflow-hidden">
      {/* Update the gradient to be more subtle */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-pink-500/5 to-red-500/5 blur-[100px]"></div>
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
                className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/30 hover:border-gray-600/30 transition-colors group"
              >
                {/* Rest of the testimonial card content remains the same */}
                <div className="relative">
                  <svg 
                    className="absolute -top-4 -left-4 w-8 h-8 text-red-500/10 group-hover:text-red-500/20 transition-colors" 
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
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-red-500/10 group-hover:border-red-500/20 transition-colors">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      fill
                      className="object-cover"
                    />
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

export default function HomePage() {
  const { user } = useAuth();
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const router = useRouter();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [sellerImageLoading, setSellerImageLoading] = useState<{[key: string]: boolean}>({});
  const [currentFlashSaleIndex, setCurrentFlashSaleIndex] = useState(0);
  const [mostLikedProducts, setMostLikedProducts] = useState<PopularProduct[]>([]);

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
          products!inner (
            id,
            title,
            price,
            product_images (
              id,
              image_url
            ),
            likes:likes(count)
          )
        `)
        .eq('role', 'owner')
        .not('store_settings', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4);

      if (sellersError) throw sellersError;

      // Process sellers data
      const featuredSellers = sellersData?.map(seller => ({
        seller_id: seller.id,
        seller_name: seller.full_name,
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
      <section className="relative py-8">
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
              onTouchEnd={handleTouchEnd}
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

  const handleTouchEnd = () => {
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

  return (
    <div className="min-h-screen relative bg-gray-900 overflow-hidden w-full">
      <ScrollProgress />
      <FloatingPreview />
      <LiveVisitorCounter />  {/* Add this line */}
      <BackToTopButton />
      <FloatingChatButton />
      {loading && <LoadingOverlay />}
      
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
                  Discover Ethiopian Fashion & More
                </motion.h1>
                <motion.p 
                  className="text-lg md:text-xl text-gray-300 mb-6 md:mb-8 max-w-xl mx-auto md:mx-0"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  Shop the latest trends in fashion, electronics, and home goods from Ethiopian sellers
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
                      <div className="relative w-full pb-[100%]">
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          className="absolute inset-0 object-cover rounded-lg shadow-lg"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 20vw"
                          priority={index < 2}
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
      <AnimatedSection className="py-8 overflow-hidden" delay={0.2}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent pointer-events-none mix-blend-overlay"></div>
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
      <AnimatedSection className="py-8" delay={0.3}>
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
      {renderFlashSales()}

      <SectionDivider />  {/* Add this line */}

      {/* Featured Categories */}
      <AnimatedSection className="py-8" delay={0.3}>
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
                className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0"
                onTouchStart={(e) => handleTouchStart(e, categoriesRef)}
                onTouchMove={(e) => handleTouchMove(e, categoriesRef)}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
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
                      <Link
                        href={`/categories/${category.name.toLowerCase()}`}
                        className="block relative h-[200px] rounded-lg overflow-hidden group touch-pan-y"
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
                      </Link>
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
      <AnimatedSection className="py-8" delay={0.4}>
        <div className={sectionGradientStyles}>
          <div className="flex items-center justify-between mb-6">
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
              onTouchEnd={handleTouchEnd}
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
                        <div className="aspect-w-1 aspect-h-1 mb-2 relative">
                          <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-red-500/20 group-hover:border-red-500/40 transition-colors">
                            <Image
                              src={brand.store_settings.logo_url || PLACEHOLDER_IMAGE}
                              alt={brand.store_settings.name}
                              fill
                              className="object-cover transform group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <h3 className="text-sm font-medium text-white group-hover:text-red-400 transition-colors">
                            {brand.store_settings.name}
                          </h3>
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
      <AnimatedSection className="py-8" delay={0.5}>
        <ParallaxSection offset={30}>
          <div className={sectionGradientStyles}>
            <div className="flex items-center justify-between mb-6">
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
                className="relative overflow-x-auto hide-scrollbar touch-pan-x snap-x snap-mandatory px-4 md:px-0"
                onTouchStart={(e) => handleTouchStart(e, lovedProductsRef)}
                onTouchMove={(e) => handleTouchMove(e, lovedProductsRef)}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
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
                        <div className="aspect-w-1 aspect-h-1 relative bg-[#0A0A0A]">
                          <Image
                            src={cleanImageUrl(product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                            alt={product.title}
                            fill
                            className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <div className="p-4">
                          <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-500 mb-2">
                            {product.title}
                          </h3>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-white">
                              ETB {product.price.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center text-yellow-500">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="ml-1 text-xs">{product.average_rating?.toFixed(1) || '0.0'}</span>
                              </div>
                              <div className="flex items-center text-red-500">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                </svg>
                                <span className="ml-1 text-xs">{product.like_count}</span>
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
      <AnimatedSection className="py-8" delay={0.6}>
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
      <AnimatedSection className="py-8" delay={0.7}>
        <div className={sectionGradientStyles}>
          <TestimonialCarousel />
        </div>
      </AnimatedSection>

      <SectionDivider />

      {/* Download App Section */}
      <AnimatedSection className="py-8" delay={0.8}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent pointer-events-none mix-blend-overlay"></div>
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
                  <form className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="flex-1 px-4 py-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg focus:outline-none focus:border-red-500 text-white placeholder-gray-500"
                    />
                    <button
                      type="submit"
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Notify Me
                    </button>
                  </form>
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
      <AnimatedSection className="py-8" delay={0.8}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent pointer-events-none mix-blend-overlay"></div>
        <div className={sectionGradientStyles}>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Stay Updated
            </h2>
            <p className="text-gray-300 mb-8">
              Subscribe to our newsletter for exclusive deals and updates
            </p>
            <form className="max-w-md mx-auto">
              <div className="flex gap-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full focus:outline-none focus:border-red-500 text-white placeholder-gray-400"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
