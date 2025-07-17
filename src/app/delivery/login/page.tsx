'use client';

import { useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function DeliveryLogin() {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Find delivery account by access code (using phone number as access code)
      const { data: accountData, error: accountError } = await supabase
        .from('delivery_accounts')
        .select('id, delivery_person_name, phone_number, is_active')
        .eq('phone_number', accessCode)
        .eq('is_active', true)
        .single();

      if (accountError || !accountData) {
        toast.error('Invalid access code or account not found.');
        return;
      }

      if (!accountData.is_active) {
        toast.error('This delivery account is not active.');
        return;
      }

      // Store delivery account info in session storage for the delivery dashboard
      sessionStorage.setItem('deliveryAccount', JSON.stringify({
        id: accountData.id,
        name: accountData.delivery_person_name,
        phone: accountData.phone_number
      }));

      toast.success(`Welcome, ${accountData.delivery_person_name}!`);
      router.push('/delivery');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Invalid access code. Please check with your administrator.');
    } finally {
      setLoading(false);
    }
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
            Enter your access code to view your deliveries
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="access-code" className="sr-only">
              Access Code
            </label>
            <input
              id="access-code"
              name="accessCode"
              type="text"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
              placeholder="Enter your phone number (e.g., +251912345678)"
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
              Your access code is your phone number
            </p>
            <Link
              href="/"
              className="font-medium text-green-600 hover:text-green-500"
            >
              Back to Homepage
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 