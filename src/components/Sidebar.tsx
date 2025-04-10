'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { 
  HomeIcon, 
  CheckCircleIcon,
  ChartBarIcon,
  CalculatorIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponent();

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/admin', 
      icon: HomeIcon
    },
    { 
      name: 'Transactions', 
      href: '/admin/transactions', 
      icon: CreditCardIcon
    },
    { 
      name: 'Verifications', 
      href: '/admin/verifications',
      icon: CheckCircleIcon
    },
    { 
      name: 'Support Tickets',
      href: '/admin/support',
      icon: ChatBubbleLeftRightIcon
    },
    { 
      name: 'Revenue', 
      href: '/admin/revenue', 
      icon: ChartBarIcon
    },
    { 
      name: 'VAT Report', 
      href: '/admin/vat', 
      icon: CalculatorIcon
    },
    { 
      name: 'Withdrawals', 
      href: '/admin/withdrawals', 
      icon: CreditCardIcon
    },
    { 
      name: 'Flash Sales', 
      href: '/admin/marketing/flash-sales', 
      icon: BoltIcon
    },    
    { 
      name: 'Subscription', 
      href: '/admin/subscriptions', 
      icon: CurrencyDollarIcon
    },
    { 
      name: 'Payment Settings', 
      href: '/admin/payment-settings', 
      icon: WrenchScrewdriverIcon
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: Cog6ToothIcon
    },
    {
      name: 'Messages',
      href: '/admin/messages',
      icon: ChatBubbleLeftRightIcon
    }
  ];

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white shadow">
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

      {/* Logout button */}
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2" 
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
  );
} 