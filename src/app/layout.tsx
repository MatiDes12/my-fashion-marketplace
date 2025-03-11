import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ClientNavigation from "@/components/ClientNavigation";
import DebugInfo from '@/components/DebugInfo';
import PageWrapper from '@/components/PageWrapper';
import { Toaster } from 'react-hot-toast';

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
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <LanguageProvider>
            <ClientNavigation />
            <PageWrapper>
              {children}
            </PageWrapper>
            {process.env.NODE_ENV !== 'production' && <DebugInfo />}
            <Toaster position="top-right" />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
