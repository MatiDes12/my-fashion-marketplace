'use client';

import { DashboardPadding } from './DashboardPadding';
import { usePathname } from 'next/navigation';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Skip padding for admin routes
  if (pathname?.startsWith('/admin')) {
    return <div className="animate-fadeIn">{children}</div>;
  }

  return (
    <DashboardPadding>
      <div className="animate-fadeIn">
        {children}
      </div>
    </DashboardPadding>
  );
} 