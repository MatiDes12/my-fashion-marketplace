'use client';

import { DashboardPadding } from './DashboardPadding';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DashboardPadding>
      <div className="animate-fadeIn">
        {children}
      </div>
    </DashboardPadding>
  );
} 