'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ShopPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to products page since shop is essentially our products page
    router.push('/products');
  }, [router]);

  return null; // No need to render anything as we're redirecting
} 