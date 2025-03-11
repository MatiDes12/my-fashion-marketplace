'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';
import { useOwnerCheck } from '@/hooks/useOwnerCheck';
import CartIcon from './CartIcon';
import { getActiveFlashSale, getAllActiveFlashSales } from '@/utils/flashSales';
import CountdownTimer from './CountdownTimer';

interface FlashSale {
  title: string;
  description: string;
  discount_percentage: number;
  min_order_amount: number;
  free_shipping: boolean;
  end_time: string;
  id: string;
}

export default function Navigation() {
  const { user, setUser } = useAuth();
  const { isOwner } = useOwnerCheck();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const supabase = createClientComponent();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [currentFlashSaleIndex, setCurrentFlashSaleIndex] = useState(0);

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
    const fetchFlashSales = async () => {
      const sales = await getAllActiveFlashSales();
      setActiveFlashSales(sales || []);
    };
    
    fetchFlashSales();
    
    // Refresh flash sales every minute
    const interval = setInterval(fetchFlashSales, 60000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      {/* Top banner */}
      {activeFlashSales.length > 0 && (
        <div className="bg-red-600 text-white py-1 relative overflow-hidden">
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
                    <p className="text-sm animate-pulse">
                      🌟 {sale.title}! Up to {sale.discount_percentage}% OFF
                      {sale.free_shipping && ' + Free International Shipping'}
                      {sale.min_order_amount > 0 && 
                        ` on Orders Over $${sale.min_order_amount}`}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <CountdownTimer endTime={sale.end_time} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Dots indicator for multiple sales */}
          {activeFlashSales.length > 1 && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex space-x-1 pb-1">
              {activeFlashSales.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 w-1 rounded-full ${
                    index === currentFlashSaleIndex 
                      ? 'bg-white' 
                      : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {/* Main navigation content */}
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-red-600">AVRIO</span>
            <span className="text-sm text-gray-500">Global Marketplace</span>
          </Link>

          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="What are you looking for?"
                className="w-full px-4 py-2 border-2 border-red-600 rounded-full focus:outline-none focus:border-red-700"
              />
              <button className="absolute right-0 top-0 h-full px-6 bg-red-600 text-white rounded-r-full hover:bg-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right side navigation items */}
          <div className="flex items-center space-x-6">
            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="relative group">
                      {/* Dropdown trigger button */}
                      <button 
                        className="flex items-center space-x-1 text-gray-700 hover:text-red-600 p-2 rounded-lg hover:bg-gray-50"
                        aria-expanded="true"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="hidden md:inline">Account</span>
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown menu */}
                      <div 
                        className="absolute right-0 w-48 mt-1 py-2 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-in-out transform group-hover:translate-y-0 translate-y-2 z-50"
                        role="menu"
                        aria-orientation="vertical"
                      >
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
                    <Link href="/login" className="text-gray-700 hover:text-red-600">
                      Sign In
                    </Link>
                    <Link href="/signup" className="hidden md:inline-block px-4 py-2 text-white bg-red-600 rounded-full hover:bg-red-700">
                      Sign Up
                    </Link>
                  </div>
                )}
              </>
            )}

            <CartIcon />
            <LanguageSwitcher />
          </div>
        </div>

        {/* Categories bar - Updated with general categories */}
        <div className="hidden md:flex items-center space-x-8 mt-4 text-sm">
          <Link href="/products" className="text-gray-700 hover:text-red-600">All Categories</Link>
          <Link href="/products?category=electronics" className="text-gray-700 hover:text-red-600">Electronics</Link>
          <Link href="/products?category=home" className="text-gray-700 hover:text-red-600">Home & Living</Link>
          <Link href="/products?category=fashion" className="text-gray-700 hover:text-red-600">Fashion</Link>
          <Link href="/products?category=beauty" className="text-gray-700 hover:text-red-600">Beauty & Health</Link>
          <Link href="/products?category=sports" className="text-gray-700 hover:text-red-600">Sports & Outdoor</Link>
          <Link href="/products?category=toys" className="text-gray-700 hover:text-red-600">Toys & Games</Link>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="sm:hidden flex items-center">
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

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/products"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === '/products'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t('nav.products')}
            </Link>

            {!isLoading && user && (
              <>
                <Link
                  href="/orders"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname === '/orders'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t('nav.orders')}
                </Link>

                {isOwner && (
                  <Link
                    href="/dashboard"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      pathname === '/dashboard'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {t('nav.dashboard')}
                  </Link>
                )}
              </>
            )}

            <div className="px-3 py-2">
              <CartIcon />
            </div>

            {!isLoading && (
              <>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-100"
                  >
                    {t('nav.signout')}
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
                    >
                      {t('nav.signin')}
                    </Link>
                    <Link
                      href="/signup"
                      className="block px-3 py-2 rounded-md text-base font-medium text-white bg-gray-900 hover:bg-gray-800"
                    >
                      {t('nav.signup')}
                    </Link>
                  </>
                )}
              </>
            )}
            
            <div className="px-3 py-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 