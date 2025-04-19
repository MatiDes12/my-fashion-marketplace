'use client';

import { usePathname } from 'next/navigation';

export function DashboardPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <div className={`min-h-screen ${!isDashboard ? 'pt-[40px]' : ''} bg-gradient-to-b from-gray-50 to-white`}>
      {children}
    </div>
  );
} 