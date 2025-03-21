import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ClientNavigation from "@/components/ClientNavigation";
import DebugInfo from '@/components/DebugInfo';
import PageWrapper from '@/components/PageWrapper';
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import LoadingPage from '@/components/LoadingPage';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AVRIO - Your Global Marketplace",
  description: "Discover amazing products from around the world. Shop electronics, fashion, home goods, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="hide-scrollbar">
      <body 
        className={`
          ${inter.className}
          relative w-full overflow-x-hidden
          hide-scrollbar bg-gray-50 dark:bg-gray-900
        `}
      >
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen flex flex-col overflow-x-hidden w-full">
              <ClientNavigation />
              <main className="flex-1 relative w-full">
                <Suspense fallback={<LoadingPage />}>
                  <PageWrapper>
                    {children}
                  </PageWrapper>
                </Suspense>
              </main>
              {process.env.NODE_ENV !== 'production' && <DebugInfo />}
              <Toaster position="top-right" />
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
