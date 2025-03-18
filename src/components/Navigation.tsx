'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';
import { useOwnerCheck } from '@/hooks/useOwnerCheck';
import CartIcon from './CartIcon';
import { getActiveFlashSale, getAllActiveFlashSales } from '@/utils/flashSales';
import CountdownTimer from './CountdownTimer';
import { UserDetails } from '@/hooks/useUserDetails';
import { cleanImageUrl } from '@/utils/url';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
import { toast } from 'react-hot-toast';

interface StoreSettings {
  name: string;
  description?: string;
  logo_url?: string;
}

interface Owner {
  id: string;
  store_settings: StoreSettings;
}

interface Product {
  id: string;
  title: string;
  category?: string;
  product_images?: Array<{ image_url: string }>;
  owner?: Owner;
}

interface FlashSaleProduct {
  id: string;
  product: {
    id: string;
    title: string;
    price: number;
    description: string;
    product_images: {
      image_url: string;
    }[];
    owner?: {
      store_settings?: {
        name?: string;
      };
    };
  };
  special_price: number;
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  products?: FlashSaleProduct[];
}

interface SearchResult {
  id: string;
  title: string;
  category: string;
  store_name?: string;
  image_url?: string;
  is_category_link?: boolean;
  is_store?: boolean;
}

interface NavigationProps {
  userDetails: UserDetails | null;
}

interface ProductUser {
  id: string;
  store_settings: {
    name?: string;
  };
}

interface SearchProduct {
  id: string;
  title: string;
  category?: string;
  product_images?: Array<{
    image_url: string;
  }>;
  users: ProductUser;
}

const categories = [
  'All',
  'Clothing',
  'Electronics',
  'Home & Living',
  'Beauty',
  'Sports',
  'Books',
  'Toys',
  // Add more categories as needed
];

export default function Navigation({ userDetails }: NavigationProps) {
  const { user, setUser } = useAuth();
  const { isOwner } = useOwnerCheck();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const supabase = createClientComponent();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [currentFlashSaleIndex, setCurrentFlashSaleIndex] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);

  // Check auth status on component mount and when pathname changes
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Navigation - Auth check:", !!session);
        
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error checking auth in Navigation:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, setUser]);

  useEffect(() => {
    fetchFlashDeals();
    const interval = setInterval(fetchFlashDeals, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []); // Empty dependency array since we want to fetch on mount

  useEffect(() => {
    if (user) {
      fetchCartCount();
    }
  }, [user]);

  useEffect(() => {
    fetchCartCount();
    
    // Listen for cart updates
    window.addEventListener('cart-updated', fetchCartCount);
    return () => window.removeEventListener('cart-updated', fetchCartCount);
  }, []);

  const fetchCartCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { count, error } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id);

      if (error) throw error;
      setCartCount(count || 0);
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  const fetchFlashDeals = async () => {
    try {
      setIsLoading(true);
      const { data: flashSalesData, error } = await supabase
        .from('flash_sales')
        .select(`
          *,
          products:flash_sale_products(
            id,
            special_price,
            product:products(
              id,
              title,
              price,
              description,
              product_images(image_url),
              owner:users(
                store_settings
              )
            )
          )
        `)
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString())
        .lte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (flashSalesData && flashSalesData.length > 0) {
        const processedSales = flashSalesData.map(sale => ({
          id: String(sale.id),
          title: sale.title,
          description: sale.description,
          discount_percentage: Number(sale.discount_percentage),
          start_time: sale.start_time,
          end_time: sale.end_time,
          products: sale.products?.map((p: FlashSaleProduct) => ({
            id: String(p.id),
            product: {
              id: String(p.product.id),
              title: p.product.title,
              price: Number(p.product.price),
              description: p.product.description,
              product_images: p.product.product_images || [],
              owner: p.product.owner
            },
            special_price: Number(p.special_price)
          }))
        }));

        console.log('Processed flash sales:', processedSales);
        setActiveFlashSales(processedSales);
      }
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeFlashSales.length <= 1) return;

    // Rotate every 5 seconds
    const rotationInterval = setInterval(() => {
      setCurrentFlashSaleIndex((prevIndex) => 
        prevIndex === activeFlashSales.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(rotationInterval);
  }, [activeFlashSales.length]);

  const handleSignOut = async () => {
    try {
      console.log("Signing out...");
      window.location.href = '/logout';
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleCategoryClick = (category: string) => {
    // Navigate to products page with category filter
    router.push(`/products?category=${category.toLowerCase()}`);
  };

  // Update the handleResultClick function
  const handleResultClick = async (e: React.MouseEvent, result: SearchResult) => {
    e.preventDefault();
    setIsNavigating(true);
    
    const targetUrl = result.is_store 
      ? `/stores/${result.id}`
      : result.is_category_link
      ? `/products?category=${encodeURIComponent(result.category.toLowerCase())}`
      : `/products/${result.id}`;

    // Wait for navigation to complete before hiding search
      try {
        await router.push(targetUrl);
      // Only hide search after successful navigation
      setIsMobileSearchVisible(false);
      setSearchResults([]);
      setSearchQuery('');
      } catch (error) {
        console.error('Navigation error:', error);
        window.location.href = targetUrl;
      } finally {
      setIsNavigating(false);
      }

    closeMenu();
  };

  // Update the click outside handler to not close immediately on mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target as Node) &&
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        // Add a small delay on mobile to allow for tap events
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
        setTimeout(() => {
            setIsMobileSearchVisible(false);
          setSearchResults([]);
            setSearchQuery('');
        }, 200);
        } else {
          setIsMobileSearchVisible(false);
          setSearchResults([]);
          setSearchQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update the shouldShowSearch function
  const shouldShowSearch = () => {
    // Add cart to the list of paths where search should be hidden
    const noSearchPaths = ['/cart', '/checkout', '/login', '/signup', '/auth'];
    return !noSearchPaths.some(path => pathname.startsWith(path));
  };

  // Update the search function
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (pathname.startsWith('/stores')) {
        // Search for stores using JSONB containment
        const { data: stores, error } = await supabase
          .from('users')
          .select(`
            id,
            store_settings
          `)
          .eq('role', 'owner')
          .not('store_settings', 'is', null)
          // Use ->> operator to access JSONB text value
          .ilike('store_settings->>name', `%${query}%`)
          .limit(8);

        if (error) throw error;

        const formattedResults = stores
          .filter(store => store.store_settings?.name)
          .map(store => ({
            id: store.id,
            title: store.store_settings.name,
            description: store.store_settings.description || '',
            image_url: store.store_settings.logo_url,
            category: 'Brand',
            is_store: true
          }));

        setSearchResults(formattedResults);
      } else {
        // Search for products
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          title,
          category,
          product_images (
            image_url
          ),
            owner:users!inner (
            id,
            store_settings
          )
        `)
          .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
        .eq('is_active', true)
          .limit(8);

      if (error) throw error;

        // Filter products after fetching to include store name search
        const formattedResults = (products as unknown as {
          id: string;
          title: string;
          category: string;
          product_images: { image_url: string }[];
          owner: { id: string; store_settings: { name: string } };
        }[])
        .filter(product => {
            const storeName = product.owner?.store_settings?.name?.toLowerCase() || '';
          return (
            product.title.toLowerCase().includes(query.toLowerCase()) ||
              (product.category || '').toLowerCase().includes(query.toLowerCase()) ||
            storeName.includes(query.toLowerCase())
          );
        })
        .map(product => ({
          id: product.id,
          title: product.title,
          category: product.category || 'Uncategorized',
            store_name: product.owner?.store_settings?.name,
          image_url: product.product_images?.[0]?.image_url
        }));

        // Add category suggestions
        const categoryMatches = PRODUCT_CATEGORIES
          .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
          .map(cat => ({
            id: `cat-${cat}`,
            title: cat,
            category: cat,
            is_category_link: true
          }));

        setSearchResults([...categoryMatches, ...formattedResults]);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchVisible(!isMobileSearchVisible);
    if (!isMobileSearchVisible) {
      // Reset search when opening
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[90] bg-white shadow-sm">
      {/* Flash Sale Banner */}
      {activeFlashSales.length > 0 && !isLoading && (
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white py-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/patterns/circuit.svg')] opacity-10"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {activeFlashSales.map((sale, index) => (
              <div
                key={sale.id}
                className={`transition-all duration-500 ${
                  index === currentFlashSaleIndex 
                    ? 'opacity-100 transform translate-y-0' 
                    : 'opacity-0 absolute top-0 left-0 right-0 transform -translate-y-full'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    {sale.products?.[0] && (
                      <Link 
                        href={`/products/${sale.products[0].product.id}`}
                        className="group inline-flex items-center hover:text-red-100"
                      >
                        <span className="animate-pulse mr-2">⚡</span>
                        <span className="font-medium">
                          Flash Sale: {sale.products[0].product.owner?.store_settings?.name || 'Store'}
                        </span>
                        <span className="mx-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                          {sale.discount_percentage}% OFF
                          </span>
                          <span className="line-through text-red-200">
                            {sale.products[0].product.price} ETB
                          </span>
                        <span className="ml-2 font-bold group-hover:underline">
                          now {sale.products[0].special_price} ETB!
                          </span>
                      </Link>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <CountdownTimer endTime={sale.end_time} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
          {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-tr from-red-600 to-pink-600 rounded-lg transform group-hover:rotate-6 transition-transform"></div>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">A</span>
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  AVRIO
                </span>
                <span className="block text-xs text-gray-500">Global Marketplace</span>
              </div>
          </Link>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8" ref={searchRef}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder={pathname === '/stores' ? "Search brands..." : "What are you looking for?"}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 pl-10 pr-12 border-2 border-gray-200 rounded-full focus:outline-none focus:border-red-500 transition-colors"
              />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                </div>
                {isSearching ? (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5">
                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    onClick={() => handleSearch(searchQuery)}
                  >
                    Search
              </button>
                )}

                {/* Desktop Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div ref={searchContainerRef} className="absolute mt-2 w-full bg-white rounded-lg shadow-lg z-50">
                    {isNavigating && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    )}
                    <div className="py-1">
                      {searchResults.map((result) => 
                        result.is_store ? (
                          <Link
                            key={result.id}
                            href={`/stores/${result.id}`}
                            className="flex items-center px-4 py-2 hover:bg-gray-50"
                            onClick={(e) => handleResultClick(e, result)}
                          >
                            <div className="flex-shrink-0 h-10 w-10 relative">
                              {result.image_url ? (
                                <Image
                                  src={cleanImageUrl(result.image_url)}
                                  alt={result.title}
                                  fill
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center text-white text-xl font-bold">
                                  {result.title[0]}
                                </div>
                              )}
                            </div>
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">{result.title}</p>
                              <p className="text-xs text-gray-500">Brand</p>
                            </div>
                          </Link>
                        ) : result.is_category_link ? (
                          // Category link
                          <Link
                            key={result.id}
                            href={`/products?category=${encodeURIComponent(result.category.toLowerCase())}`}
                            className="flex items-center px-4 py-3 hover:bg-red-50 border-b"
                            onClick={(e) => handleResultClick(e, result)}
                          >
                            <div className="flex items-center text-red-600">
                              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <span className="font-medium">{result.title}</span>
                            </div>
                          </Link>
                        ) : (
                          // Regular product link
                          <Link
                            key={result.id}
                            href={`/products/${result.id}`}
                            className="flex items-center px-4 py-2 hover:bg-gray-50"
                            onClick={(e) => handleResultClick(e, result)}
                          >
                            {result.image_url && (
                              <div className="flex-shrink-0 h-10 w-10 relative">
                                <Image
                                  src={cleanImageUrl(result.image_url)}
                                  alt={result.title}
                                  fill
                                  className="rounded-md object-cover"
                                />
                              </div>
                            )}
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">{result.title}</p>
                              <div className="flex items-center text-xs text-gray-500">
                                <span>{result.category}</span>
                                {result.store_name && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{result.store_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>

            {/* Right Navigation Items */}
          <div className="flex items-center space-x-6">
            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    {/* Add Store Icon */}
                    <Link
                      href="/stores"
                      className="hidden md:flex items-center text-gray-700 hover:text-red-600 transition-colors"
                    >
                      <div className="relative">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
                          />
                        </svg>
                      </div>
                      <span className="hidden lg:inline ml-1">Stores</span>
                    </Link>

                    {/* Add Flash Sale Icon */}
                    <Link
                      href="/flash-sales"
                      className="hidden md:flex items-center text-gray-700 hover:text-red-600 transition-colors"
                    >
                      <div className="relative">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M13 10V3L4 14h7v7l9-11h-7z" 
                          />
                        </svg>
                        {activeFlashSales.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <span className="hidden lg:inline ml-1">Flash Sales</span>
                    </Link>
                    {/* Existing Cart Icon */}
                    <Link href="/cart" className="flex items-center text-gray-700 hover:text-red-600 transition-colors">
                      <div className="relative">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {cartCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                            {cartCount}
                          </span>
                        )}
                      </div>
                      <span className="hidden lg:inline ml-1">Cart</span>
                    </Link>

                    {/* Rest of the account menu */}
                    <div className="relative group">
                        <button className="flex items-center space-x-1 text-gray-700 hover:text-red-600">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                          </div>
                          <span className="hidden md:inline font-medium">Account</span>
                      </button>

                        {/* Dropdown Menu */}
                        <div className="absolute right-0 w-48 mt-2 py-2 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-in-out transform group-hover:translate-y-0 translate-y-2">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.user_metadata?.full_name || 'Account User'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>

                        <div className="py-1">
                          <Link 
                            href="/orders" 
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            My Orders
                          </Link>

                          <Link 
                            href="/profile" 
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile Settings
                          </Link>

                          {isOwner && (
                            <Link 
                              href="/dashboard" 
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                              </svg>
                              Dashboard
                            </Link>
                          )}
                        </div>

                        <div className="py-1 border-t border-gray-100">
                          <button
                            onClick={handleSignOut}
                            className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                      <Link 
                        href="/login" 
                        className="text-gray-700 hover:text-red-600 font-medium transition-colors"
                      >
                      Sign In
                    </Link>
                      <Link 
                        href="/signup" 
                        className="hidden md:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all"
                      >
                        Get Started
                    </Link>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Border after main navigation */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Categories Navigation */}
          <div className="hidden md:flex items-center space-x-8 h-12">
            {PRODUCT_CATEGORIES.slice(0, 5).map((category) => (
            <Link 
                key={category}
                href={`/products?category=${category.toLowerCase()}`}
                className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-red-600 group"
              >
                <span>{category}</span>
              </Link>
            ))}

            {/* More Categories Dropdown */}
            <div className="relative group">
              <button className="flex items-center space-x-1 text-gray-700 hover:text-red-600">
                <span>More</span>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 hidden group-hover:block z-50">
                {PRODUCT_CATEGORIES.slice(5).map((category) => (
                  <Link
                    key={category}
                    href={`/products?category=${category.toLowerCase()}`}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
                  >
                    {category}
            </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile buttons */}
      <div className="sm:hidden flex items-center gap-2">
        {shouldShowSearch() && (
          <button
            onClick={toggleMobileSearch}
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
          >
            <span className="sr-only">Toggle search</span>
            <svg 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          </button>
        )}
        
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
        >
          <span className="sr-only">Open main menu</span>
          <svg
            className="h-6 w-6"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Search Bar - Only show when search is toggled */}
      {shouldShowSearch() && isMobileSearchVisible && (
        <div 
          ref={searchContainerRef}
          className="md:hidden fixed inset-x-0 top-[64px] z-[85] bg-white border-b border-gray-200"
          style={{
            top: activeFlashSales.length > 0 ? '116px' : '64px'
          }}
        >
          <div className="px-4 py-3">
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                placeholder={pathname.startsWith('/stores') ? "Search brands..." : "What are you looking for?"}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 pl-10 pr-12 border-2 border-gray-200 rounded-full focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white shadow-xl rounded-b-xl max-h-[60vh] overflow-y-auto border border-gray-100">
                    {searchResults.map((result) => 
                      result.is_store ? (
                        <Link
                          key={result.id}
                          href={`/stores/${result.id}`}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          onClick={(e) => handleResultClick(e, result)}
                        >
                      <div className="flex-shrink-0 h-12 w-12 relative">
                            {result.image_url ? (
                              <Image
                                src={cleanImageUrl(result.image_url)}
                                alt={result.title}
                                fill
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center text-white text-xl font-bold">
                                {result.title[0]}
                              </div>
                            )}
                          </div>
                      <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-gray-900">{result.title}</p>
                            <p className="text-xs text-gray-500">Brand</p>
                          </div>
                        </Link>
                      ) : result.is_category_link ? (
                        <Link
                          key={result.id}
                          href={`/products?category=${encodeURIComponent(result.category.toLowerCase())}`}
                      className="flex items-center px-4 py-3 hover:bg-red-50 border-b border-gray-100"
                          onClick={(e) => handleResultClick(e, result)}
                        >
                          <div className="flex items-center text-red-600">
                        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="font-medium">{result.title}</span>
                          </div>
                        </Link>
                      ) : (
                        <Link
                          key={result.id}
                          href={`/products/${result.id}`}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          onClick={(e) => handleResultClick(e, result)}
                        >
                      <div className="flex-shrink-0 h-12 w-12 relative">
                          {result.image_url && (
                              <Image
                                src={cleanImageUrl(result.image_url)}
                                alt={result.title}
                                fill
                            className="rounded-lg object-cover"
                              />
                          )}
                      </div>
                      <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-gray-900">{result.title}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                              <span>{result.category}</span>
                              {result.store_name && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{result.store_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                )}
              </div>
                    )}
                  </div>
                </div>
              )}

      {/* Mobile Sidebar Menu */}
      <div 
        className={`fixed inset-0 z-50 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:hidden`}
      >
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={closeMenu}
        />
        
        {/* Menu content */}
        <div className="relative w-[85%] max-w-sm h-full bg-white shadow-xl overflow-y-auto">
          <div className="px-4 py-6">
            {/* User section */}
            {user ? (
              <div className="mb-6">
                <div className="flex items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100">
                  <div className="flex-shrink-0 h-12 w-12 relative">
                    {userDetails?.avatar_url ? (
                      <Image
                        src={cleanImageUrl(userDetails.avatar_url)}
                        alt="Profile"
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-xl font-bold">
                        {userDetails?.full_name?.[0] || user.email?.[0]?.toUpperCase()}
            </div>
                    )}
          </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">
                      {userDetails?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <Link
                  href="/auth/login"
                  onClick={closeMenu}
                  className="block w-full px-4 py-3 text-center font-medium text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl shadow-sm transition-all duration-300"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={closeMenu}
                  className="block w-full px-4 py-3 text-center font-medium text-red-600 border-2 border-red-600 hover:bg-red-50 rounded-xl transition-all duration-300"
                >
                  Create Account
                </Link>
        </div>
      )}

            {/* Main Navigation */}
            <nav className="space-y-2">
              <Link 
                href="/products" 
                onClick={closeMenu}
                className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300"
              >
                <svg className="w-6 h-6 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="font-medium">All Products</span>
              </Link>
              
              <Link 
                href="/flash-sales" 
                onClick={closeMenu}
                className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300"
              >
                <svg className="w-6 h-6 mr-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">Flash Sales</span>
                {activeFlashSales.length > 0 && (
                  <span className="ml-auto bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </Link>
              
              <Link 
                href="/stores" 
                onClick={closeMenu}
                className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300"
              >
                <svg className="w-6 h-6 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium">Stores</span>
              </Link>

              {/* Cart Link with Badge */}
              <Link 
                href="/cart" 
                onClick={closeMenu}
                className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300"
              >
                <svg className="w-6 h-6 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-medium">Cart</span>
                {cartCount > 0 && (
                  <span className="ml-auto bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
            </nav>

            {/* Categories Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="px-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Categories
              </h3>
              <div className="mt-4 flex flex-wrap gap-2 px-4">
                {PRODUCT_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      handleCategoryClick(category);
                      closeMenu();
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-300"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout Button */}
            {user && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    handleSignOut();
                    closeMenu();
                  }}
                  className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-300"
                >
                  <svg className="w-6 h-6 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 