'use client';

import { useUserDetails } from '@/hooks/useUserDetails';
import Navigation from './Navigation';
import LoadingSpinner from './LoadingSpinner';

export default function ClientNavigation() {
  const { userDetails, loading } = useUserDetails();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return <Navigation userDetails={userDetails} />;
} 