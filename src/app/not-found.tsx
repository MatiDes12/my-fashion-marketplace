'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';

function NotFoundContent() {
  const searchParams = useSearchParams();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/images/brand/logo.png"
            alt="Avrio Shop"
            width={80}
            height={80}
            className="mx-auto"
          />
        </div>

        {/* 404 Illustration */}
        <div className="w-48 h-48 mx-auto">
          <svg
            className="w-full h-full text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <div>
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-gray-800 mb-2">
            Oops! Page not found
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            We searched everywhere but couldn't find what you're looking for.
          </p>
        </div>

        {/* Back to Home Button */}
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          ← Back to Homepage
        </Link>

        {/* Additional Help */}
        <p className="text-sm text-gray-500 mt-6">
          Need help?{' '}
          <Link href="/contact" className="text-red-600 hover:text-red-700">
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NotFoundContent />
    </Suspense>
  );
}