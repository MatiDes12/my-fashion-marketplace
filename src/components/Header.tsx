'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ClientNavigation from './ClientNavigation';

export default function Header() {
  const pathname = usePathname();
  const isAdminOrDashboard = pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard');

  if (isAdminOrDashboard) {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <a href="/" className="flex items-center">
              <Image
                src="/images/brand/logo.png"
                alt="Avrio Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </a>
          </div>
          <ClientNavigation />
        </div>
      </div>
    </header>
  );
} 