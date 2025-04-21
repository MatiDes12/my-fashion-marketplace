import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import DebugInfo from '@/components/DebugInfo';
import PageWrapper from '@/components/PageWrapper';
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import LoadingPage from '@/components/LoadingPage';
import ScrollProgress from '@/components/ScrollProgress';
import FloatingSupportButton from '@/components/FloatingSupportButton';
import { FloatingPreview } from '@/components/FloatingPreview';
import Header from '@/components/Header';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Avrio",
  description: "Secure fashion marketplace",
  metadataBase: new URL('https://www.avrioxshop.com'),
  openGraph: {
    title: 'Avrio',
    description: 'Secure fashion marketplace',
    url: 'https://www.avrioxshop.com',
    siteName: 'Avrio',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} bg-white text-gray-900`}>
        <ScrollProgress />
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 w-full bg-gray-50">
                <Suspense fallback={<LoadingPage />}>
                  <PageWrapper>
                    {children}
                  </PageWrapper>
                </Suspense>
              </main>

              {process.env.NODE_ENV !== 'production' && <DebugInfo />}
              <FloatingSupportButton />
              <FloatingPreview />
              <Toaster position="top-right" />
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
