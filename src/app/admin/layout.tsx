'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { classNames } from '@/utils/classNames';
import { createClientComponent } from '@/lib/supabase';
import { getRolePermissions } from '@/utils/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { 
  HomeIcon, 
  CheckCircleIcon,
  ChartBarIcon,
  CalculatorIcon,
  CreditCardIcon,
  CogIcon,
  BoltIcon 
} from '@heroicons/react/24/outline';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      icon: HomeIcon
    },
    { 
      name: 'Verifications', 
      href: '/admin/verifications', 
      icon: CheckCircleIcon
    },
    { 
      name: 'Revenue', 
      href: '/admin/revenue', 
      icon: ChartBarIcon,
      show: userPermissions?.canViewRevenue 
    },
    { 
      name: 'VAT Report', 
      href: '/admin/vat', 
      icon: CalculatorIcon,
      show: userPermissions?.canViewRevenue 
    },
    { 
      name: 'Withdrawals', 
      href: '/admin/withdrawals', 
      icon: CreditCardIcon,
      show: userPermissions?.canProcessWithdrawals 
    },
    { 
      name: 'Flash Sales', 
      href: '/admin/marketing/flash-sales', 
      icon: BoltIcon,
      show: true
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: CogIcon,
      show: true
    }
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-6">
            <Link href="/admin" className="flex items-center space-x-2">
              <Image
                src="/images/brand/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <span className="text-xl font-bold text-gray-900">Admin</span>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    isActive
                      ? 'bg-red-50 text-red-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden text-gray-500 hover:text-gray-600"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Main content */}
      <div className={`lg:pl-64 min-h-screen ${isSidebarOpen ? 'pl-64' : 'pl-0'}`}>
        <main className="py-6">
          {children}
        </main>
      </div>
    </div>
  );
} 