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
import ScrollProgress from '@/components/ScrollProgress';
import FloatingSupportButton from '@/components/FloatingSupportButton';
import { FloatingPreview } from '@/components/FloatingPreview';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Avriox Shop",
  description: "Secure fashion marketplace",
  metadataBase: new URL('https://www.avrioxshop.com'),
  openGraph: {
    title: 'Avriox Shop',
    description: 'Secure fashion marketplace',
    url: 'https://www.avrioxshop.com',
    siteName: 'Avriox Shop',
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
              <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex">
                      <a href="/" className="flex items-center">
                        <span className="text-xl font-bold text-gray-900">Avriox Shop</span>
                      </a>
                    </div>
                    <ClientNavigation />
                  </div>
                </div>
              </header>

              <main className="flex-1 relative w-full bg-gray-50">
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

              <footer className="bg-white border-t border-gray-200">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="col-span-1">
                      <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                        Security
                      </h3>
                      <ul className="mt-4 space-y-4">
                        <li>
                          <a href="/security-policy" className="text-gray-600 hover:text-gray-900 transition-colors">
                            Security Policy
                          </a>
                        </li>
                        <li>
                          <a href="/.well-known/security.txt" className="text-gray-600 hover:text-gray-900 transition-colors">
                            Security.txt
                          </a>
                        </li>
                      </ul>
                    </div>
                    <div className="col-span-1">
                      <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                        Company
                      </h3>
                      <ul className="mt-4 space-y-4">
                        <li>
                          <a href="/careers" className="text-gray-600 hover:text-gray-900 transition-colors">
                            Careers
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-gray-200 pt-8">
                    <p className="text-base text-gray-600 text-center">
                      &copy; {new Date().getFullYear()} Avriox Shop. All rights reserved.
                    </p>
                  </div>
                </div>
              </footer>
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
