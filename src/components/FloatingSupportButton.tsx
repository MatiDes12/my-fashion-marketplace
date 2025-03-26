'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export default function FloatingSupportButton() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Don't show on admin or dashboard pages as they have their own support buttons
  if (!user || pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard')) {
    return null;
  }

  return (
    <Link
      href="/support"
      className="fixed left-6 bottom-6 bg-red-600 text-white rounded-full p-3 
                shadow-lg hover:bg-red-700 transition-colors z-50 group"
      title="Get Support"
    >
      <QuestionMarkCircleIcon className="h-6 w-6" />
      <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 
                     bg-white text-gray-900 px-3 py-1 rounded-full text-sm 
                     opacity-0 group-hover:opacity-100 transition-opacity duration-300 
                     whitespace-nowrap shadow-lg">
        Need help?
      </span>
    </Link>
  );
} 