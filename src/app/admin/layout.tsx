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
  BoltIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Sidebar from '@/components/Sidebar';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, [pathname]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
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
      name: 'Support Tickets', 
      href: '/admin/support', 
      icon: ChatBubbleLeftRightIcon,
      show: true
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
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={classNames(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2">
              <Image
                src="/images/brand/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="text-lg font-semibold text-gray-900">Admin</span>
            </div>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
} 