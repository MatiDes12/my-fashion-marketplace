import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
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
import ReactQueryProvider from '@/components/ReactQueryProvider';
import TelegramLinkAfterVerification from '@/components/TelegramLinkAfterVerification';
import ConsoleSilencer from '@/components/ConsoleSilencer';
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Avrio",
  description: "Secure online marketplace",
  metadataBase: new URL('https://www.avrioxshop.com'),
  openGraph: {
    title: 'Avrio',
    description: 'Secure online marketplace',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" key="viewport" />
        <meta name="theme-color" content="#ffffff" key="theme-color" />
        <link rel="icon" href="/favicon.ico" key="favicon" />
        {process.env.NODE_ENV === 'production' && (
          <Script id="silence-console-log" strategy="beforeInteractive">
            {`
              (function(){
                try {
                  if (typeof window !== 'undefined' && window.console && typeof window.console.log === 'function') {
                    var originalLog = window.console.log;
                    window.console.log = function(){ /* no-op in production */ };
                    window.__restoreConsoleLog = function(){ window.console.log = originalLog; };
                  }
                } catch (e) { /* ignore */ }
              })();
            `}
          </Script>
        )}
      </head>
      <body className={`${inter.className} bg-white text-gray-900`} suppressHydrationWarning>
        <ConsoleSilencer />
        <ScrollProgress />
        <AuthProvider>
          <LanguageProvider>
            <ReactQueryProvider>
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
                <TelegramLinkAfterVerification />
                <Toaster position="top-right" />
                <SpeedInsights />
                <Analytics />
              </div>
            </ReactQueryProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
