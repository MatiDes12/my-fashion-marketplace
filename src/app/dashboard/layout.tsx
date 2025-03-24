'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import { AuthChangeEvent } from '@supabase/supabase-js';
import { useUserDetails } from '@/hooks/useUserDetails';
import { cleanImageUrl } from '@/utils/url';
import { motion } from 'framer-motion';

interface UserData {
  role: string;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
}

const UnverifiedHeader = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[30] bg-white shadow-sm backdrop-blur-sm bg-white/90">
      <div className="flex items-center justify-between px-4 py-2 h-16 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-1">
            <Image
              src="/images/brand/logo.png"
              alt="Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Seller Verification</h1>
            <p className="text-sm text-gray-500">Complete verification to access dashboard</p>
          </div>
        </div>
        <Link
          href="/"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100/80 transition-all"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { userDetails } = useUserDetails();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccess = async () => {
      setIsLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Verify the user's role and verification status
        const { data, error } = await supabase
          .from('users')
          .select('role, is_verified, verification_status')
          .eq('id', session.user.id)
          .single() as { data: UserData | null; error: any };
        
        if (error) {
          console.error('Error fetching user role:', error);
          router.push('/login?message=Error verifying permissions');
          return;
        }
        
        if (data?.role !== 'owner') {
          router.push('/?message=Access denied');
          return;
        }

        // Only show sidebar if verified
        setIsVerified(data.is_verified);
        
        // User is authorized
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/login?message=Authentication error');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAccess();
    
    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login?message=You have been signed out');
      } else if (event === 'TOKEN_REFRESHED' && !session) {
        router.push('/login?message=Session expired');
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }
  
  // Don't render anything if not authorized
  if (!isAuthorized) {
    return null;
  }

  // For verification pages, only show minimal layout
  if (pathname === '/dashboard/verify' || pathname === '/dashboard/verification-pending') {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  // If not verified, don't show the sidebar
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gray-50">
        <UnverifiedHeader />
        <main className="pt-16">
          {children}
        </main>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Products', href: '/dashboard/products', icon: ProductsIcon },
    { name: 'Orders', href: '/dashboard/orders', icon: OrdersIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: AnalyticsIcon },
    { 
      name: 'Marketing', 
      href: '/dashboard/marketing', 
      icon: MarketingIcon,
      subItems: [
        {
          name: 'Flash Sales',
          href: '/dashboard/marketing/flash-sales',
          icon: LightningBoltIcon,
          current: pathname === '/dashboard/marketing/flash-sales'
        }
      ]
    },
    { name: 'Payment Settings', href: '/dashboard/payment-settings', icon: PaymentSettingsIcon },
    { name: 'Subscription', href: '/dashboard/subscription', icon: SubscriptionIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: SettingsIcon },
  ];

  const DashboardHeader = () => {
    return (
      <div className="fixed top-0 left-0 right-0 z-[30] bg-white shadow-sm backdrop-blur-sm bg-white/90">
        <div className="flex items-center justify-between px-4 py-2 h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100/80 transition-all cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="p-1">
                <Image
                  src="/images/brand/logo.png"
                  alt="Avrio"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">Business Dashboard</h1>
                <p className="text-sm text-gray-500">Manage your store</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100/80 transition-all"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Fixed Header - lower z-index */}
      <div className="fixed top-0 left-0 right-0 z-[30] bg-white shadow-sm backdrop-blur-sm bg-white/90">
        <DashboardHeader />
      </div>

      {/* Desktop Sidebar - higher z-index */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 z-[40]">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto">
          {/* User Profile Section - Moved to top */}
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 relative">
                {userDetails?.avatar_url ? (
                  <Image
                    src={cleanImageUrl(userDetails.avatar_url)}
                    alt="Profile"
                    fill
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-red-500 to-red-600 flex items-center justify-center text-white text-xl font-bold">
                    {userDetails?.full_name?.[0] || 'S'}
                  </div>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {userDetails?.full_name || 'Store Owner'}
                </p>
                <p className="text-xs text-gray-500">Store Manager</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-grow flex flex-col pt-5">
            <nav className="flex-1 px-3 pb-4 space-y-1">
              {navigation.map((item) => (
                <div key={item.name}>
                  <Link
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      pathname === item.href
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${
                        pathname === item.href
                          ? 'text-red-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                  {item.subItems && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                            subItem.current
                              ? 'bg-red-50 text-red-700'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <subItem.icon
                            className={`mr-3 flex-shrink-0 h-4 w-4 ${
                              subItem.current
                                ? 'text-red-500'
                                : 'text-gray-400 group-hover:text-gray-500'
                            }`}
                          />
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Bottom Section */}
            <div className="p-4">
              <div className="p-4 bg-gradient-to-tr from-red-50 to-orange-50 rounded-xl">
                <h3 className="text-sm font-medium text-red-900">Need Help?</h3>
                <p className="mt-1 text-xs text-red-700">Contact our support team</p>
                <button className="mt-3 w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                  Get Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - add top padding to match header height */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        <main className="flex-1 pt-16">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Mobile Sidebar - highest z-index */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-xl">
            <div className="h-full flex flex-col">
              {/* Close button */}
              <div className="px-4 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1">
                    <Image
                      src="/images/brand/logo-white.png"
                      alt="Avrio"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </div>
                  <span className="text-lg font-semibold">Dashboard</span>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile navigation */}
              <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      pathname === item.href
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${
                        pathname === item.href
                          ? 'text-red-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ProductsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function OrdersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function AnalyticsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function MarketingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}

function SubscriptionIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9a2 2 0 10-4 0v5a2 2 0 104 0V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01M12 3v1M19 3v1M19 13v1M19 21v1M5 3v1M5 7v1M5 13v1M5 17v1M5 21v1M12 21v1" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 002.572 1.065c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PaymentSettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function LightningBoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3l-3 3m0 0l-3-3m3 3M13 10V3l-3 3m0 0l-3-3m3 3" />
    </svg>
  );
} 