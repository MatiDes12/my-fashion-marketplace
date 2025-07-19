'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function DeliveryLogin() {
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for token in URL on component mount
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAccessToken(token);
      handleTokenValidation(token);
    }
  }, [searchParams]);

  const handleTokenValidation = async (token: string) => {
    setValidatingToken(true);
    
    try {
      const response = await fetch('/api/delivery/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store delivery account info in session storage
        sessionStorage.setItem('deliveryAccount', JSON.stringify(data.deliveryAccount));
        toast.success(`Welcome, ${data.deliveryAccount.name}!`);
        router.push('/delivery');
      } else {
        toast.error(data.error || 'Invalid access token');
        // Clear the token from URL
        router.replace('/delivery/login');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      toast.error('Failed to validate access token');
      router.replace('/delivery/login');
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) {
      toast.error('Please enter your access token');
      return;
    }
    
    setLoading(true);
    await handleTokenValidation(accessToken.trim());
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Delivery Dashboard Access
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {validatingToken ? 'Validating your access token...' : 'Enter your access token to view your deliveries'}
          </p>
        </div>
        
        {validatingToken ? (
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-600">Please wait while we validate your access...</p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="access-token" className="sr-only">
                Access Token
              </label>
              <input
                id="access-token"
                name="accessToken"
                type="text"
                required
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Enter your access token (e.g., ABC123DEF456)"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? <LoadingSpinner /> : 'Access Dashboard'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">
                Your access token was provided by your administrator
              </p>
              <Link
                href="/"
                className="font-medium text-green-600 hover:text-green-500"
              >
                Back to Homepage
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 