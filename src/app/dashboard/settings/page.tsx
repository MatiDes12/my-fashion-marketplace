'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [columnMissing, setColumnMissing] = useState(false);
  const [bucketMissing, setBucketMissing] = useState(false);
  const [storeData, setStoreData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    logo: null as File | null,
    currentLogo: '',
    bannerImage: null as File | null,
    currentBanner: '',
    deliveryOptions: {
      pickup: true,
      delivery: true,
      shipping: false
    },
    paymentMethods: {
      cash: true,
      telebirr: true,
      bankTransfer: false,
      creditCard: false
    }
  });
  
  const router = useRouter();
  const supabase = createClientComponent();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }
        
        // Check role first (this should always work)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user role:', userError);
          setError('Failed to verify user role');
          return;
        }
        
        if (userData?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        // Try to get store settings, but handle the case where column doesn't exist yet
        try {
          const { data: settingsData, error: settingsError } = await supabase
            .from('users')
            .select('store_settings')
            .eq('id', session.user.id)
            .single();
            
          if (settingsError) {
            if (settingsError.code === '42703') { // Column doesn't exist error
              console.warn('Store settings column does not exist yet:', settingsError);
              setColumnMissing(true);
            } else {
              throw settingsError;
            }
          } else if (settingsData?.store_settings) {
            setStoreData({
              ...storeData,
              ...settingsData.store_settings,
              currentLogo: settingsData.store_settings.logo_url || '',
              currentBanner: settingsData.store_settings.banner_url || ''
            });
          }
        } catch (settingsError) {
          console.error('Error fetching store settings:', settingsError);
          // Continue with default settings
        }
      } catch (error) {
        console.error('Error loading store settings:', error);
        setError('Failed to load store settings');
      } finally {
        setLoading(false);
      }
    };
    
    checkAccessAndLoadData();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStoreData({
      ...storeData,
      [name]: value
    });
  };

  const handleCheckboxChange = (category: 'deliveryOptions' | 'paymentMethods', name: string) => {
    setStoreData({
      ...storeData,
      [category]: {
        ...storeData[category],
        [name]: !storeData[category][name as keyof typeof storeData[typeof category]]
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'logo' | 'bannerImage') => {
    if (e.target.files && e.target.files.length > 0) {
      setStoreData({
        ...storeData,
        [fileType]: e.target.files[0]
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // If column is missing, show a message to run the migration
      if (columnMissing) {
        setError('The store_settings column is missing in the database. Please run the SQL migration.');
        setSaving(false);
        return;
      }

      // Prepare settings data without images first
      const settingsData = {
        name: storeData.name,
        description: storeData.description,
        address: storeData.address,
        phone: storeData.phone,
        email: storeData.email,
        logo_url: storeData.currentLogo,
        banner_url: storeData.currentBanner,
        delivery_options: storeData.deliveryOptions,
        payment_methods: storeData.paymentMethods,
        updated_at: new Date().toISOString()
      };

      // Handle logo upload if there's a new file
      if (storeData.logo) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(`${session.user.id}/logo`, storeData.logo);

          if (uploadError) {
            // Check if the error message indicates a missing bucket
            if (uploadError.message?.includes('bucket') || uploadError.message?.includes('404')) {
              throw new Error('Storage bucket "stores" not found. Please run the SQL migration to create it.');
            }
            throw uploadError;
          }

          // Get the public URL for the uploaded logo
          const { data: { publicUrl } } = supabase.storage
            .from('stores')
            .getPublicUrl(`${session.user.id}/logo`);

          settingsData.logo_url = publicUrl;
        } catch (error) {
          console.error('Logo upload error:', error);
          throw error;
        }
      }

      // Handle banner upload if there's a new file
      if (storeData.bannerImage) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(`${session.user.id}/banner`, storeData.bannerImage);

          if (uploadError) {
            // Check if the error message indicates a missing bucket
            if (uploadError.message?.includes('bucket') || uploadError.message?.includes('404')) {
              throw new Error('Storage bucket "stores" not found. Please run the SQL migration to create it.');
            }
            throw uploadError;
          }

          // Get the public URL for the uploaded banner
          const { data: { publicUrl } } = supabase.storage
            .from('stores')
            .getPublicUrl(`${session.user.id}/banner`);

          settingsData.banner_url = publicUrl;
        } catch (error) {
          console.error('Banner upload error:', error);
          throw error;
        }
      }

      // Update store settings
      const { error: updateError } = await supabase
        .from('users')
        .update({
          store_settings: settingsData
        })
        .eq('id', session.user.id);

      if (updateError) {
        if (updateError.code === '42703') { // Column doesn't exist error
          setColumnMissing(true);
          throw new Error('Store settings column does not exist in the database');
        }
        throw updateError;
      }

      setSuccess(true);
      // Update the current values
      setStoreData({
        ...storeData,
        currentLogo: settingsData.logo_url,
        currentBanner: settingsData.banner_url,
        logo: null,
        bannerImage: null
      });
    } catch (error) {
      console.error('Settings save error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Store Settings</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div>
            <ErrorMessage message={error} />
            {columnMissing && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800">Database Migration Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>The store_settings column is missing in the users table. Please run the following SQL to add it:
                  </p>
                  <pre className="mt-2 p-3 bg-gray-800 text-white rounded-md overflow-x-auto text-xs">
                    {`-- Add store_settings column to users table
ALTER TABLE public.users 
ADD COLUMN store_settings JSONB DEFAULT NULL;`}
                  </pre>
                </div>
              </div>
            )}
            {bucketMissing && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800">Storage Bucket Missing</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>The "stores" storage bucket is missing. Please run the following SQL in your Supabase SQL editor:</p>
                  <pre className="mt-2 p-3 bg-gray-800 text-white rounded-md overflow-x-auto text-xs">
                    {`-- Create the 'stores' bucket for store logos and banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('stores', 'stores', true);

-- Create policy to allow authenticated users to upload to their own folder
CREATE POLICY "Allow owners to upload store assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stores' AND
  (auth.uid())::text = (SPLIT_PART(name, '/', 2))
);

-- Create policy to allow users to update their own files
CREATE POLICY "Allow owners to update their store assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stores' AND
  (auth.uid())::text = (SPLIT_PART(name, '/', 2))
);

-- Create policy to allow users to delete their own files
CREATE POLICY "Allow owners to delete their store assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'stores' AND
  (auth.uid())::text = (SPLIT_PART(name, '/', 2))
);

-- Create policy to allow public access to read store assets
CREATE POLICY "Allow public to view store assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'stores');`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              {columnMissing ? (
                <div className="rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Database Migration Required</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>The store_settings column is missing in the users table. Please run the following SQL in your Supabase SQL editor:</p>
                        <pre className="mt-2 p-3 bg-gray-800 text-white rounded-md overflow-x-auto text-xs">
                          {`-- Add store_settings column to users table
ALTER TABLE public.users 
ADD COLUMN store_settings JSONB DEFAULT NULL;`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {success && (
                    <div className="mb-4 rounded-md bg-green-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-800">
                            Store settings saved successfully!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-8 divide-y divide-gray-200">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Store Information</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            This information will be displayed publicly on your store page.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-4">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Store Name
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="name"
                                id="name"
                                value={storeData.name}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              Store Description
                            </label>
                            <div className="mt-1">
                              <textarea
                                id="description"
                                name="description"
                                rows={3}
                                value={storeData.description}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Brief description of your store and what you sell.
                            </p>
                          </div>

                          <div className="sm:col-span-4">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Email address
                            </label>
                            <div className="mt-1">
                              <input
                                id="email"
                                name="email"
                                type="email"
                                value={storeData.email}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                              Phone Number
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="phone"
                                id="phone"
                                value={storeData.phone}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                              Store Address
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="address"
                                id="address"
                                value={storeData.address}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
                              Store Logo
                            </label>
                            {storeData.currentLogo && (
                              <div className="mt-2 mb-4">
                                <Image
                                  src={storeData.currentLogo}
                                  alt="Store Logo"
                                  width={100}
                                  height={100}
                                  className="h-20 w-20 rounded-full object-cover"
                                />
                              </div>
                            )}
                            <div className="mt-1">
                              <input
                                type="file"
                                id="logo"
                                onChange={(e) => handleFileChange(e, 'logo')}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                accept="image/*"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Upload a square image for best results. Recommended size: 200x200 pixels.
                            </p>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="bannerImage" className="block text-sm font-medium text-gray-700">
                              Store Banner
                            </label>
                            {storeData.currentBanner && (
                              <div className="mt-2 mb-4">
                                <Image
                                  src={storeData.currentBanner}
                                  alt="Store Banner"
                                  width={300}
                                  height={100}
                                  className="h-32 w-full rounded-md object-cover"
                                />
                              </div>
                            )}
                            <div className="mt-1">
                              <input
                                type="file"
                                id="bannerImage"
                                onChange={(e) => handleFileChange(e, 'bannerImage')}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                accept="image/*"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Upload a wide image for your store banner. Recommended size: 1200x400 pixels.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Options</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Select how customers can receive their orders.
                          </p>
                        </div>
                        <div className="mt-6">
                          <div className="space-y-4">
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="pickup"
                                  name="pickup"
                                  type="checkbox"
                                  checked={storeData.deliveryOptions.pickup}
                                  onChange={() => handleCheckboxChange('deliveryOptions', 'pickup')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="pickup" className="font-medium text-gray-700">Store Pickup</label>
                                <p className="text-gray-500">Customers can pick up their orders from your location.</p>
                              </div>
                            </div>
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="delivery"
                                  name="delivery"
                                  type="checkbox"
                                  checked={storeData.deliveryOptions.delivery}
                                  onChange={() => handleCheckboxChange('deliveryOptions', 'delivery')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="delivery" className="font-medium text-gray-700">Local Delivery</label>
                                <p className="text-gray-500">You'll deliver orders to customers within your local area.</p>
                              </div>
                            </div>
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="shipping"
                                  name="shipping"
                                  type="checkbox"
                                  checked={storeData.deliveryOptions.shipping}
                                  onChange={() => handleCheckboxChange('deliveryOptions', 'shipping')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="shipping" className="font-medium text-gray-700">Nationwide Shipping</label>
                                <p className="text-gray-500">Ship orders to customers anywhere in Ethiopia.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Payment Methods</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Select the payment methods you accept.
                          </p>
                        </div>
                        <div className="mt-6">
                          <div className="space-y-4">
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="cash"
                                  name="cash"
                                  type="checkbox"
                                  checked={storeData.paymentMethods.cash}
                                  onChange={() => handleCheckboxChange('paymentMethods', 'cash')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="cash" className="font-medium text-gray-700">Cash on Delivery</label>
                              </div>
                            </div>
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="telebirr"
                                  name="telebirr"
                                  type="checkbox"
                                  checked={storeData.paymentMethods.telebirr}
                                  onChange={() => handleCheckboxChange('paymentMethods', 'telebirr')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="telebirr" className="font-medium text-gray-700">TeleBirr</label>
                              </div>
                            </div>
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="bankTransfer"
                                  name="bankTransfer"
                                  type="checkbox"
                                  checked={storeData.paymentMethods.bankTransfer}
                                  onChange={() => handleCheckboxChange('paymentMethods', 'bankTransfer')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="bankTransfer" className="font-medium text-gray-700">Bank Transfer</label>
                              </div>
                            </div>
                            <div className="relative flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="creditCard"
                                  name="creditCard"
                                  type="checkbox"
                                  checked={storeData.paymentMethods.creditCard}
                                  onChange={() => handleCheckboxChange('paymentMethods', 'creditCard')}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="creditCard" className="font-medium text-gray-700">Credit Card</label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => router.push('/dashboard')}
                          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            'Save Settings'
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 