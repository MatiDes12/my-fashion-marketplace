'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { classNames } from '@/utils/classNames';
import { createClientComponent } from '@/lib/supabase';
import { getRolePermissions } from '@/utils/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<ReturnType<typeof getRolePermissions> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    checkPermissions();
  }, [pathname]);

  const checkPermissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const returnUrl = encodeURIComponent(pathname || '/admin');
        router.push(`/login?returnUrl=${returnUrl}`);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single();

      if (!userData) {
        throw new Error('User data not found');
      }

      const permissions = getRolePermissions(userData.role as any, userData.is_admin || false);
      setUserPermissions(permissions);

      // Redirect based on permissions
      if (!permissions.canAccessAdminPanel) {
        router.push('/products');
        return;
      }

      // Check specific page permissions
      if (pathname?.includes('/admin/revenue') && !permissions.canViewRevenue) {
        router.push('/admin');
        toast.error('You do not have permission to view revenue');
        return;
      }

      if (pathname?.includes('/admin/withdrawals') && !permissions.canProcessWithdrawals) {
        router.push('/admin');
        toast.error('You do not have permission to manage withdrawals');
        return;
      }

    } catch (error) {
      console.error('Permission check error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/admin', 
      icon: 'HomeIcon',
      show: true 
    },
    { 
      name: 'Revenue', 
      href: '/admin/revenue', 
      icon: 'ChartBarIcon',
      show: userPermissions?.canViewRevenue 
    },
    { 
      name: 'VAT Report', 
      href: '/admin/vat', 
      icon: 'CalculatorIcon',
      show: userPermissions?.canViewRevenue 
    },
    { 
      name: 'Withdrawals', 
      href: '/admin/withdrawals', 
      icon: 'CreditCardIcon',
      show: userPermissions?.canProcessWithdrawals 
    },
    { 
      name: 'Manage Withdrawals', 
      href: '/admin/withdrawals/manage', 
      icon: 'CogIcon',
      show: userPermissions?.canProcessWithdrawals 
    },
    { 
      name: 'Flash Sales', 
      href: '/admin/marketing/flash-sales', 
      icon: 'BoltIcon',
      show: true // You can adjust this based on permissions if needed
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: 'CogIcon',
      show: true // You can adjust this based on permissions if needed
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Side Navigation - Fixed position */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50">
        {/* Logo/Brand Section - Adjusted height */}
        <div className="h-16 flex items-center px-6 bg-white border-b">
          <span className="text-xl font-semibold text-gray-800">Admin Panel</span>
        </div>

        {/* Navigation Links - Scrollable area */}
        <div className="overflow-y-auto h-[calc(100vh-4rem)]">
          <nav className="mt-6">
            <div className="px-4 space-y-1">
              {navigation
                .filter(item => item.show)
                .map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={classNames(
                      pathname === item.href
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-4 py-2 text-sm font-medium rounded-md'
                    )}
                  >
                    {item.icon === 'BoltIcon' && (
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
                          d="M13 10V3L4 14h7v7l9-11h-7z" 
                        />
                      </svg>
                    )}
                    {item.icon === 'CogIcon' && (
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
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                    {item.name}
                  </Link>
                ))}
            </div>
          </nav>

          {/* Logout Button - Fixed at bottom */}
          <div className="absolute bottom-0 w-full p-4 border-t bg-white">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
            >
              <svg 
                className="w-5 h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Adjusted padding */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
} 