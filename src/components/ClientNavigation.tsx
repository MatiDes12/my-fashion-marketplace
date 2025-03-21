'use client';

import { useUserDetails } from '@/hooks/useUserDetails';
import Navigation from './Navigation';
import LoadingSpinner from './LoadingSpinner';
import { usePathname } from 'next/navigation';

export default function ClientNavigation() {
  const { userDetails, loading } = useUserDetails();
  const pathname = usePathname();
  
  // Hide navigation on dashboard pages
  if (pathname?.startsWith('/dashboard')) {
    return null;
  }
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return <Navigation userDetails={userDetails} />;
} 