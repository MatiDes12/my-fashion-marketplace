'use client';

import { useUserDetails } from '@/hooks/useUserDetails';
import Navigation from './Navigation';

export default function ClientNavigation() {
  const { userDetails } = useUserDetails();
  
  return <Navigation userDetails={userDetails} />;
} 