'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import { AuthChangeEvent } from '@supabase/supabase-js';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccess = async () => {
      setIsLoading(true);
      
      try {
        // Force refresh the session to ensure we have the latest state
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Error refreshing session:', refreshError);
          router.push('/login?message=Session+expired');
          return;
        }
        
        const session = refreshData.session;
        
        if (!session) {
          console.log('No session found, redirecting to login');
          router.push('/login?message=Please+login+to+access+the+dashboard');
          return;
        }
        
        // Verify the user's role
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user role:', error);
          router.push('/login?message=Error+verifying+permissions');
          return;
        }
        
        if (data?.role !== 'owner') {
          console.log('User is not an owner, redirecting to home');
          router.push('/?message=Access+denied');
          return;
        }
        
        // User is authorized
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/login?message=Authentication+error');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAccess();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        // Redirect to login if user signs out
        router.push('/login?message=You+have+been+signed+out');
      } else if (event === 'TOKEN_REFRESHED' && !session) {
        // If token refresh fails (no session), redirect to login
        router.push('/login?message=Session+expired');
      }
    });
    
    // Clean up subscription when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // If still loading or not authorized, show loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }
  
  // If not authorized after loading, don't render the dashboard
  if (!isAuthorized) {
    return null;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Products', href: '/dashboard/products', icon: ProductsIcon },
    { name: 'Orders', href: '/dashboard/orders', icon: OrdersIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: AnalyticsIcon },
    { name: 'Marketing', href: '/dashboard/marketing', icon: MarketingIcon },
    { name: 'Payment Settings', href: '/dashboard/payment-settings', icon: PaymentSettingsIcon },
    { name: 'Subscription', href: '/dashboard/subscription', icon: SubscriptionIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: SettingsIcon },
    {
      name: 'Flash Sales',
      href: '/dashboard/marketing/flash-sales',
      icon: LightningBoltIcon,
      current: pathname === '/dashboard/marketing/flash-sales'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="fixed inset-0 flex z-[60] lg:hidden" role="dialog" aria-modal="true">
          <div
            className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ease-linear duration-300 ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden="true"
            onClick={() => setIsSidebarOpen(false)}
          ></div>

          <div
            className={`relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white transition ease-in-out duration-300 transform z-[70] ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-shrink-0 flex items-center px-4">
              <Image
                src="/logo-ethiopia.png"
                alt="Habesha Fashion"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="ml-2 text-xl font-bold">Habesha Fashion</span>
            </div>
            <div className="mt-5 flex-1 h-0 overflow-y-auto">
              <nav className="px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      pathname === item.href
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                  >
                    <item.icon
                      className={`${
                        pathname === item.href
                          ? 'text-gray-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      } mr-4 flex-shrink-0 h-6 w-6`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex-shrink-0 w-14" aria-hidden="true">
            {/* Dummy element to force sidebar to shrink to fit close icon */}
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-[60]">
        <div className="flex flex-col flex-grow border-r border-gray-200 pt-20 bg-white overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Image
              src="/logo-ethiopia.png"
              alt="Habesha Fashion"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="ml-2 text-xl font-bold">Habesha Fashion</span>
          </div>
          <div className="mt-5 flex-grow flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    pathname === item.href
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                >
                  <item.icon
                    className={`${
                      pathname === item.href
                        ? 'text-gray-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    } mr-3 flex-shrink-0 h-6 w-6`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col">
        <div className="h-20"></div>
        
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white border-b border-gray-200 lg:hidden">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </button>
          <div className="flex-1 flex justify-center px-4 lg:px-0">
            <div className="flex-1 flex">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center">
                  <Image
                    src="/logo-ethiopia.png"
                    alt="Habesha Fashion"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <span className="ml-2 text-lg font-bold">Habesha Fashion</span>
                </div>
                <Link
                  href="/"
                  className="ml-4 px-3 py-1 text-sm text-gray-700 hover:text-gray-900"
                >
                  View Store
                </Link>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 relative">
          {children}
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

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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