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
  ChatBubbleLeftRightIcon
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
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
} 