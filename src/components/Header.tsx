'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ClientNavigation from './ClientNavigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Header() {
  const pathname = usePathname();
  const isAdminOrDashboard = pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard');
  const { language, setLanguage } = useLanguage();

  if (isAdminOrDashboard) {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <Image
                src="/images/brand/logo.png"
                alt="Avrio Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </a>
            {/* Language toggle next to homepage icon (logo) */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
              className="ml-3 inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              aria-label="Toggle language"
            >
              {language === 'en' ? 'AM' : 'EN'}
            </button>
          </div>
          <ClientNavigation />
        </div>
      </div>
    </header>
  );
} 