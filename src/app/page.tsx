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

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

const APP_PREVIEW_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="600" viewBox="0 0 300 600"%3E%3Crect width="300" height="600" fill="%23f3f4f6"/%3E%3Ctext x="150" y="300" font-family="Arial" font-size="14" fill="%239ca3af" text-anchor="middle"%3EAVRIO App Preview%3C/text%3E%3C/svg%3E';

// Add this before the HomePage component
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

// Update the categories array
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

// Add this component at the top of your sections
const GlassBackground = ({ pattern }: { pattern: string }) => (
  <>
    <div className="absolute inset-0 bg-gradient-to-b from-white/80 to-white/40 backdrop-blur-xl transition-all duration-500 group-hover:backdrop-blur-2xl" />
    <div className={`absolute inset-0 bg-[url('/patterns/${pattern}.svg')] opacity-5 transition-opacity duration-500 group-hover:opacity-10`} />
  </>
);

// Update the PatternedSection component
const PatternedSection = ({ 
  pattern, 
  children, 
  className = "",
  colorScheme = "default"
}: { 
  pattern: string; 
  children: React.ReactNode; 
  className?: string;
  colorScheme?: "default" | "dark" | "warm" | "cool" | "accent";
}) => {
  // Define more subtle color schemes with higher transparency
  const colorSchemes = {
    default: "from-white/30 via-gray-50/20 to-white/30",
    dark: "from-gray-50/30 via-white/20 to-gray-50/30",
    warm: "from-rose-50/30 via-white/20 to-rose-50/30",
    cool: "from-blue-50/30 via-white/20 to-blue-50/30",
    accent: "from-purple-50/30 via-white/20 to-purple-50/30"
  };

  return (
    <section className={`relative overflow-hidden group ${className}`}>
      {/* Base background with higher transparency */}
      <div className="absolute inset-0 bg-white/10" />
      
      {/* Gradient overlay with subtle effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorSchemes[colorScheme]} animate-gradient`} />
      
      {/* Pattern overlay with increased visibility */}
      <div 
        className={`absolute inset-0 pattern-${pattern} opacity-[0.15] mix-blend-overlay`} 
        style={{ backgroundSize: '30px 30px' }}
      />
      
      {/* Enhanced glass effect container */}
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      
      {/* Inner container with refined glass effect */}
      <div className="relative z-10 max-w-[90vw] mx-auto">
        <div className="bg-white/20 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] 
          border border-white/30 p-8 
          transition-all duration-300 
          hover:bg-white/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          hover:border-white/40">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </section>
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
      <PatternedSection pattern="circuit" className="py-16" colorScheme="dark">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              Flash Deals
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-semibold animate-pulse">⚡ Limited Time Offers</span>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <button 
          onClick={() => scrollFlashSales('left')}
          className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-white/90 to-rose-50/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
        >
          <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button 
          onClick={() => scrollFlashSales('right')}
          className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-rose-50/90 to-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
        >
          <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Flash Sales Carousel */}
        <div 
          ref={flashSalesRef}
          className="relative flex space-x-6 overflow-x-hidden scroll-smooth py-4"
        >
          {allFlashProducts.map((flashProduct) => (
            <motion.div
              key={flashProduct.id}
              className="flex-none w-72"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                href={`/products/${flashProduct.product.id}`}
                className="block relative bg-gradient-to-b from-white/60 to-rose-50/60 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg border border-white/20 group"
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

                <div className="aspect-w-1 aspect-h-1 relative bg-gray-100">
                  <Image
                    src={cleanImageUrl(flashProduct.product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                    alt={flashProduct.product.title}
                    fill
                    className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <div className="p-4 bg-gradient-to-b from-white/60 to-rose-50/60 backdrop-blur-sm">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600">
                    {flashProduct.product.title}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-red-600">
                      ETB {flashProduct.special_price.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 line-through">
                      ETB {flashProduct.product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mt-6 space-x-2">
          {Array.from({ length: Math.ceil(allFlashProducts.length / 4) }).map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToFlashSalePage(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                currentFlashSalePage === index 
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 w-4' 
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </PatternedSection>
    );
  };

  // Add these state and refs for Flash Sales carousel
  const flashSalesRef = useRef<HTMLDivElement>(null);
  const [currentFlashSalePage, setCurrentFlashSalePage] = useState(0);

  const scrollFlashSales = (direction: 'left' | 'right') => {
    if (!flashSalesRef.current) return;
    
    const container = flashSalesRef.current;
    const scrollAmount = container.clientWidth;
    const totalProducts = getAllFlashSaleProducts().length;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentFlashSalePage(prev => Math.max(0, prev - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentFlashSalePage(prev => 
        Math.min(Math.ceil(totalProducts / 4) - 1, prev + 1)
      );
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
    const scrollAmount = container.clientWidth;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentPage(prev => Math.max(0, prev - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentPage(prev => Math.min(Math.ceil(categories.length / 4) - 1, prev + 1));
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

  // Add these scroll functions for Most Loved Products
  const scrollLovedProducts = (direction: 'left' | 'right') => {
    if (!lovedProductsRef.current) return;
    
    const container = lovedProductsRef.current;
    const scrollAmount = container.clientWidth;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentLovedPage(prev => Math.max(0, prev - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentLovedPage(prev => 
        Math.min(Math.ceil(popularProducts.length / 4) - 1, prev + 1)
      );
    }
  };

  const scrollToLovedPage = (pageIndex: number) => {
    if (!lovedProductsRef.current) return;
    
    const container = lovedProductsRef.current;
    const scrollAmount = container.clientWidth * pageIndex;
    
    container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    setCurrentLovedPage(pageIndex);
  };

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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="relative pt-16 md:pt-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center min-h-[calc(100vh-4rem)]">
              <div className="py-12 md:py-24">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                    Your One-Stop Shop for Everything in Ethiopia
                  </h1>
                  <p className="text-xl text-gray-300 mb-8">
                    Discover authentic Ethiopian products and shop from verified local sellers
                  </p>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/products"
                      className="btn-hover-effect inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Start Shopping
                      <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                    {(!user || (user?.user_metadata?.role !== 'owner')) && (
                      <Link
                        href="/signup?role=owner"
                        className="btn-hover-effect inline-flex items-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100"
                      >
                        Become a Seller
                      </Link>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative h-64"
                  >
                    <Image
                      src="/images/categories/electronics.jpg"
                      alt="Electronics"
                      fill
                      className="object-cover rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="relative h-64 mt-16"
                  >
                    <Image
                      src="/images/categories/modern.jpg"
                      alt="Modern Fashion"
                      fill
                      className="object-cover rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="relative h-64 -mt-16"
                  >
                    <Image
                      src="/images/categories/accessories.jpg"
                      alt="Accessories"
                      fill
                      className="object-cover rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="relative h-64"
                  >
                    <Image
                      src="/images/categories/beauty.jpg"
                      alt="Beauty"
                      fill
                      className="object-cover rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300"
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flash Sales Section */}
      {renderFlashSales()}

      {/* Featured Categories */}
      <PatternedSection pattern="grid" className="py-16" colorScheme="default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Shop by Category
          </h2>
          
          <div className="relative">
            {/* Navigation Buttons */}
            <button 
              onClick={() => scrollCategories('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button 
              onClick={() => scrollCategories('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Categories Carousel */}
            <div 
              ref={categoriesRef}
              className="flex space-x-6 overflow-x-hidden scroll-smooth py-4"
            >
              {categories.map((category) => (
                <motion.div
                  key={category.name}
                  className="flex-none w-72"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link
                    href={`/products?category=${category.name.toLowerCase()}`}
                    className="block relative overflow-hidden rounded-xl bg-white shadow-sm hover:shadow-xl transition-all duration-300"
                  >
                    <div className="aspect-w-16 aspect-h-9">
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <div className="flex items-center mb-2">
                            <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-white">
                              {category.icon}
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white">{category.name}</h3>
                          <p className="mt-1 text-sm text-gray-200 line-clamp-2">
                            {category.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({ length: Math.ceil(categories.length / 4) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToPage(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    currentPage === index ? 'bg-red-600 w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </PatternedSection>

      {/* Featured Brands */}
      <PatternedSection pattern="dots" className="py-16" colorScheme="warm">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Featured Brands
          </h2>
          <Link
            href="/stores"
            className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
          >
            View All
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="relative">
          {/* Navigation Buttons */}
          <button 
            onClick={() => scrollBrands('left')}
            className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-white/90 to-gray-50/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
          >
            <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={() => scrollBrands('right')}
            className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-gray-50/90 to-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
          >
            <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Brands Carousel */}
          <div 
            ref={brandsRef}
            className="relative flex space-x-6 overflow-x-hidden scroll-smooth py-4"
          >
            {featuredBrands.map((brand) => (
              <motion.div
                key={brand.seller_id}
                className="flex-none w-72"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link
                  href={`/stores/${brand.seller_id}`}
                  className="group"
                >
                  <div className="relative bg-white p-4 transition-all duration-300 hover:shadow-lg rounded-xl">
                    <div className="aspect-w-1 aspect-h-1 mb-4 relative">
                      <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-gray-100">
                        <Image
                          src={brand.store_settings.logo_url || PLACEHOLDER_IMAGE}
                          alt={brand.store_settings.name}
                          fill
                          className="object-cover transform group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-sm font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                        {brand.store_settings.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {brand.store_settings.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mt-6 space-x-2">
            {Array.from({ length: Math.ceil(featuredBrands.length / 4) }).map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToBrandsPage(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentBrandsPage === index 
                    ? 'bg-gradient-to-r from-gray-600 to-gray-800 w-4' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </PatternedSection>

      {/* Most Liked Products */}
      <PatternedSection pattern="squares" className="py-16" colorScheme="cool">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Most Loved Products
          </h2>
          <Link
            href="/products?sort=most-liked"
            className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
          >
            View All
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="relative">
          {/* Navigation Buttons */}
          <button 
            onClick={() => scrollLovedProducts('left')}
            className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-white/90 to-gray-50/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
          >
            <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={() => scrollLovedProducts('right')}
            className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-gray-50/90 to-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:from-white hover:to-white transition-all duration-300"
          >
            <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Products Carousel */}
          <div 
            ref={lovedProductsRef}
            className="relative flex space-x-6 overflow-x-hidden scroll-smooth py-4"
          >
            {popularProducts.map((product) => (
              <motion.div
                key={product.id}
                className="flex-none w-72"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link
                  href={`/products/${product.id}`}
                  className="block relative bg-gradient-to-b from-white/60 to-gray-50/60 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg border border-white/20 group"
                >
                  <div className="aspect-w-1 aspect-h-1 relative bg-gray-100">
                    <Image
                      src={cleanImageUrl(product.product_images[0]?.image_url) || PLACEHOLDER_IMAGE}
                      alt={product.title}
                      fill
                      className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-red-600 flex-1">
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
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        ETB {product.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mt-6 space-x-2">
            {Array.from({ length: Math.ceil(popularProducts.length / 4) }).map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToLovedPage(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentLovedPage === index 
                    ? 'bg-gradient-to-r from-gray-600 to-gray-800 w-4' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </PatternedSection>

      {/* Why Choose Us */}
      <PatternedSection pattern="circuit" className="py-16" colorScheme="accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Why Choose AVRIO
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </PatternedSection>

      {/* Download App Section */}
      <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Shop On The Go</h2>
              <p className="text-xl text-gray-300 mb-8">
                Download our mobile app for a better shopping experience
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="btn-hover-effect flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                  </svg>
                  App Store
                </button>
                <button className="btn-hover-effect flex items-center justify-center px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  Google Play
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-red-500 to-pink-500 opacity-20 blur-3xl rounded-full"></div>
              <Image
                src="/images/app/app-preview_1.jpg"
                alt="AVRIO Mobile App Preview"
                width={300}
                height={600}
                className="relative mx-auto transform hover:scale-105 transition-transform duration-300 rounded-3xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <PatternedSection pattern="dots" className="py-16" colorScheme="cool">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Stay Updated
            </h2>
            <p className="text-gray-600 mb-8">
              Subscribe to our newsletter for exclusive deals and updates
            </p>
            <form className="max-w-md mx-auto">
              <div className="flex gap-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-full focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="btn-hover-effect px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </PatternedSection>
    </div>
  );
}
