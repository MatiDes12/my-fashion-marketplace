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
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import FloatingSupportButton from '@/components/FloatingSupportButton';
import { toast } from 'react-hot-toast';

interface UserData {
  role: string;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
}

const UnverifiedHeader = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[40] bg-white shadow-sm backdrop-blur-sm bg-white/90">
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
          console.log('No session found, redirecting to login');
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
          toast.error('Error verifying permissions');
          router.push('/login?message=Error verifying permissions');
          return;
        }
        
        if (!data) {
          console.error('No user data found');
          toast.error('User data not found');
          router.push('/login?message=User data not found');
          return;
        }
        
        if (data.role !== 'owner') {
          console.log('Access denied - not an owner');
          toast.error('Access denied - Insufficient permissions');
          router.push('/?message=Access denied');
          return;
        }

        console.log('User verified:', {
          role: data.role,
          is_verified: data.is_verified,
          verification_status: data.verification_status
        });

        // Only show sidebar if verified
        setIsVerified(data.is_verified);
        
        // User is authorized
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking access:', error);
        toast.error('Authentication error');
        router.push('/login?message=Authentication error');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAccess();
    
    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      console.log('Auth state changed:', event);
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
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: HomeIcon,
      show: true
    },
    { 
      name: 'Products', 
      href: '/dashboard/products', 
      icon: ProductsIcon,
      show: true
    },
    { 
      name: 'Orders', 
      href: '/dashboard/orders', 
      icon: OrdersIcon,
      show: true
    },
    { name: 'Analytics', href: '/dashboard/analytics', icon: AnalyticsIcon, show: true },
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
      ],
      show: true
    },
    { name: 'Payment Settings', href: '/dashboard/payment-settings', icon: PaymentSettingsIcon, show: true },
    { name: 'Subscription', href: '/dashboard/subscription', icon: SubscriptionIcon, show: true },
    { name: 'Delivery', href: '/dashboard/delivery', icon: DeliveryIcon, show: true },
    { name: 'Store Setup', href: '/dashboard/settings', icon: StoreIcon, show: true },
    { 
      name: 'Get Support',
      href: '/support',
      icon: QuestionMarkCircleIcon,
      show: true
    },
  ];

  const DashboardHeader = () => {
    return (
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white shadow-sm backdrop-blur-sm bg-white/90">
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar - Hidden on mobile by default */}
      <div className={`
        fixed inset-y-0 left-0 z-[50] transform transition duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-64 md:flex-shrink-0
      `}>
        <div className="h-full flex flex-col bg-white shadow-lg">
          {/* Logo section */}
          <div className="flex-shrink-0 px-4 py-4 flex items-center">
            <Link href="/dashboard" className="flex-shrink-0">
              <Image
                src="/images/brand/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <span className="ml-2 text-xl font-semibold text-gray-900">
              Dashboard
            </span>
          </div>

          {/* Navigation - scrollable */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-4 py-4 space-y-1">
              {navigation.map((item) => {
                if (!item.show && item.name !== 'Get Support') return null;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => {
                      // Close sidebar on mobile when a navigation item is clicked
                      if (window.innerWidth < 768) { // 768px is the md breakpoint
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                      isActive
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${
                        isActive
                          ? 'text-red-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Logout button */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg 
                className="mr-3 h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className={`
        flex-1 flex flex-col overflow-hidden
        ${isSidebarOpen ? 'md:ml-64' : ''}
        w-full
      `}>
        {/* Mobile header */}
        <header className="bg-white shadow-sm z-10 md:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-600 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center">
              <Image
                src="/images/brand/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="ml-2 text-lg font-semibold text-gray-900">
                Dashboard
              </span>
            </div>
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-gray-600"
            >
              <HomeIcon className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {/* Desktop header - Hidden on mobile */}
        <header className="bg-white shadow-sm z-10 hidden md:block">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
            </h1>
            <Link
              href="/"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100/80 transition-all"
              title="Go to Homepage"
            >
              <HomeIcon className="h-6 w-6" />
            </Link>
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
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

function StoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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

function DeliveryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
} 