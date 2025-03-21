'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import Link from 'next/link';

// Add these type definitions at the top of the file
type WorkingHours = {
  [key: string]: { open: string; close: string; isOpen: boolean };
};

type SocialMedia = {
  [key: string]: string;
};

type DeliveryOptions = {
  delivery: boolean;
  pickup: boolean;
  shipping: boolean;
  deliveryRadius: number;
  minimumOrderForFreeDelivery: number;
  deliveryFee: number;
  estimatedDeliveryTime: string;
};

type StoreData = {
  name: string;
  email: string;
  phone: string;
  description: string;
  logo_url: string;
  banner_url: string;
  updated_at: string;
  payment_methods: {
    [key: string]: boolean;
  };
  delivery_options: DeliveryOptions;
  address: {
    [key: string]: string;
  };
  shortDescription: string;
  alternativePhone: string;
  socialMedia: SocialMedia;
  businessType: string;
  tinNumber: string;
  businessLicense: string;
  vatRegistered: boolean;
  logo: File | null;
  currentLogo: string;
  bannerImage: File | null;
  currentBanner: string;
  storeTheme: string;
  primaryColor: string;
  returnPolicy: string;
  shippingPolicy: string;
  privacyPolicy: string;
  workingHours: WorkingHours;
  languages: {
    [key: string]: boolean;
  };
  features: {
    [key: string]: boolean;
  };
  seo: {
    [key: string]: string;
  };
  [key: string]: any; // Add index signature
};

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [columnMissing, setColumnMissing] = useState(false);
  const [bucketMissing, setBucketMissing] = useState(false);
  const [storeData, setStoreData] = useState<StoreData>({
    name: '',
    email: '',
    phone: '',
    description: '',
    logo_url: '',
    banner_url: '',
    updated_at: new Date().toISOString(),
    payment_methods: {
      cash: true,
      telebirr: true,
      cbe: false,
      awash: false,
      dashen: false,
      amole: false,
      helloCash: false,
      mBirr: false,
      bankTransfer: false,
      creditCard: false,
    },
    delivery_options: {
      delivery: true,
      pickup: true,
      shipping: false,
      deliveryRadius: 5,
      minimumOrderForFreeDelivery: 500,
      deliveryFee: 50,
      estimatedDeliveryTime: '30-60',
    },
    address: {
      city: '',
      subCity: '',
      wereda: '',
      kebele: '',
      houseNo: '',
      landmark: '',
      mapLink: '',
    },
    shortDescription: '',
    alternativePhone: '',
    socialMedia: {
      telegram: '',
      tiktok: '',
      instagram: '',
      facebook: '',
    },
    businessType: 'individual',
    tinNumber: '',
    businessLicense: '',
    vatRegistered: false,
    logo: null as File | null,
    currentLogo: '',
    bannerImage: null as File | null,
    currentBanner: '',
    storeTheme: 'default',
    primaryColor: '#FF0000',
    returnPolicy: '',
    shippingPolicy: '',
    privacyPolicy: '',
    workingHours: {
      monday: { open: '09:00', close: '17:00', isOpen: true },
      tuesday: { open: '09:00', close: '17:00', isOpen: true },
      wednesday: { open: '09:00', close: '17:00', isOpen: true },
      thursday: { open: '09:00', close: '17:00', isOpen: true },
      friday: { open: '09:00', close: '17:00', isOpen: true },
      saturday: { open: '09:00', close: '17:00', isOpen: true },
      sunday: { open: '09:00', close: '17:00', isOpen: false },
    },
    languages: {
      amharic: true,
      english: true,
      oromiffa: false,
      tigrigna: false,
    },
    features: {
      enableReviews: true,
      enableWishlist: true,
      enableChat: true,
      showStock: true,
      requireLogin: false,
    },
    seo: {
      metaTitle: '',
      metaDescription: '',
      keywords: '',
    }
  });
  
  const router = useRouter();
  const supabase = createClientComponent();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        setLoading(true);
        
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          router.push('/login?message=Please login to access the dashboard');
          return;
        }

        // Store the session
        setSession(currentSession);
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, store_settings')
          .eq('id', currentSession.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          setError('Failed to verify user role');
          return;
        }
        
        if (userData?.role !== 'owner') {
          router.push('/');
          return;
        }
        
        if (userData?.store_settings) {
          setStoreData(prev => ({
            ...prev,
            ...userData.store_settings,
            payment_methods: {
              ...prev.payment_methods,
              ...userData.store_settings.payment_methods,
            },
            delivery_options: {
              ...prev.delivery_options,
              ...userData.store_settings.delivery_options,
            },
            address: {
              ...prev.address,
              ...userData.store_settings.address,
            },
            currentLogo: userData.store_settings.logo_url || '',
            currentBanner: userData.store_settings.banner_url || '',
          }));
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.') as [keyof StoreData, string];
      setStoreData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setStoreData(prev => ({
        ...prev,
      [name]: value
      }));
    }
  };

  const handleWorkingHoursChange = (
    day: keyof StoreData['workingHours'],
    field: 'open' | 'close' | 'isOpen',
    value: string | boolean
  ) => {
    setStoreData(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day],
          [field]: value
        }
      }
    }));
  };

  const handleFeatureChange = (feature: keyof StoreData['features']) => {
    setStoreData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature]
      }
    }));
  };

  const handleLanguageChange = (language: keyof StoreData['languages']) => {
    setStoreData(prev => ({
      ...prev,
      languages: {
        ...prev.languages,
        [language]: !prev.languages[language]
      }
    }));
  };

  const handleCheckboxChange = (
    category: 'delivery_options' | 'payment_methods',
    name: string
  ) => {
    setStoreData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [name]: !(prev[category] as any)[name]
      }
    }));
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Prepare settings data without images first
      const settingsData = {
        name: storeData.name,
        email: storeData.email,
        phone: storeData.phone,
        description: storeData.description,
        address: storeData.address,
        logo_url: storeData.currentLogo,
        banner_url: storeData.currentBanner,
        payment_methods: storeData.payment_methods,
        delivery_options: storeData.delivery_options,
        updated_at: new Date().toISOString(),
        shortDescription: storeData.shortDescription,
        alternativePhone: storeData.alternativePhone,
        socialMedia: storeData.socialMedia,
        businessType: storeData.businessType,
        tinNumber: storeData.tinNumber,
        businessLicense: storeData.businessLicense,
        vatRegistered: storeData.vatRegistered,
        workingHours: storeData.workingHours,
        languages: storeData.languages,
        features: storeData.features,
        seo: storeData.seo,
      };

      // Handle logo upload if there's a new file
      if (storeData.logo) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(`${session.user.id}/logo`, storeData.logo);

          if (uploadError) throw uploadError;

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

          if (uploadError) throw uploadError;

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

      if (updateError) throw updateError;

      setSuccess(true);
      // Update the current values
      setStoreData(prev => ({
        ...prev,
        currentLogo: settingsData.logo_url,
        currentBanner: settingsData.banner_url,
        logo: null,
        bannerImage: null
      }));
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving store settings:', error);
      setError('Failed to save store settings');
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
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Basic Information</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            This information will be displayed publicly on your store page.
                          </p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          {/* Store Name */}
                          <div className="sm:col-span-4">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Store Name *
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="name"
                                id="name"
                                required
                                value={storeData.name}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          {/* Short Description */}
                          <div className="sm:col-span-6">
                            <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700">
                              Short Description
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="shortDescription"
                                id="shortDescription"
                                value={storeData.shortDescription}
                                onChange={handleInputChange}
                                placeholder="Brief tagline or summary of your store"
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              A short description that appears under your store name
                            </p>
                          </div>

                          {/* Full Description */}
                          <div className="sm:col-span-6">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              Full Description
                            </label>
                            <div className="mt-1">
                              <textarea
                                name="description"
                                id="description"
                                rows={4}
                                value={storeData.description}
                                onChange={handleInputChange}
                                placeholder="Detailed description of your store"
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              A detailed description of your store, products, and services
                            </p>
                          </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Store Branding</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Upload your store logo and banner images
                            </p>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            {/* Logo Upload */}
                            <div className="sm:col-span-3">
                              <label className="block text-sm font-medium text-gray-700">Store Logo</label>
                              <div className="mt-1 flex items-center">
                                {storeData.currentLogo ? (
                                  <div className="relative h-32 w-32">
                                    <Image
                                      src={storeData.currentLogo}
                                      alt="Store Logo"
                                      fill
                                      className="object-contain rounded-lg"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-32 w-32 border-2 border-gray-300 border-dashed rounded-lg flex items-center justify-center">
                                    <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="ml-4">
                                  <div className="relative">
                                    <input
                                      type="file"
                                      id="logo"
                                      onChange={(e) => handleFileChange(e, 'logo')}
                                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                      accept="image/*"
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">
                                    Recommended: Square image, at least 200x200 pixels
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Banner Upload */}
                            <div className="sm:col-span-3">
                              <label className="block text-sm font-medium text-gray-700">Store Banner</label>
                              <div className="mt-1 flex items-center">
                                {storeData.currentBanner ? (
                                  <div className="relative h-32 w-full">
                                    <Image
                                      src={storeData.currentBanner}
                                      alt="Store Banner"
                                      fill
                                      className="object-cover rounded-lg"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-32 w-full border-2 border-gray-300 border-dashed rounded-lg flex items-center justify-center">
                                    <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="ml-4">
                                  <div className="relative">
                                    <input
                                      type="file"
                                      id="bannerImage"
                                      onChange={(e) => handleFileChange(e, 'bannerImage')}
                                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                      accept="image/*"
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">
                                    Recommended: Wide image, 1200x400 pixels
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Contact Information</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              How customers can reach your business.
                            </p>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-3">
                              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                Primary Phone *
                            </label>
                            <div className="mt-1">
                              <input
                                  type="tel"
                                  name="phone"
                                  id="phone"
                                  required
                                  value={storeData.phone}
                                onChange={handleInputChange}
                                  placeholder="+251"
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-3">
                              <label htmlFor="alternativePhone" className="block text-sm font-medium text-gray-700">
                                Alternative Phone
                            </label>
                            <div className="mt-1">
                                <input
                                  type="tel"
                                  name="alternativePhone"
                                  id="alternativePhone"
                                  value={storeData.alternativePhone}
                                onChange={handleInputChange}
                                  placeholder="+251"
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-3">
                              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                                City *
                            </label>
                            <div className="mt-1">
                              <input
                                  type="text"
                                  name="address.city"
                                  id="city"
                                  required
                                  value={storeData.address.city}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                              <label htmlFor="subCity" className="block text-sm font-medium text-gray-700">
                                Sub City *
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                  name="address.subCity"
                                  id="subCity"
                                  required
                                  value={storeData.address.subCity}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-2">
                              <label htmlFor="wereda" className="block text-sm font-medium text-gray-700">
                                Wereda
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                  name="address.wereda"
                                  id="wereda"
                                  value={storeData.address.wereda}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-2">
                              <label htmlFor="kebele" className="block text-sm font-medium text-gray-700">
                                Kebele
                            </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="address.kebele"
                                  id="kebele"
                                  value={storeData.address.kebele}
                                  onChange={handleInputChange}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                            </div>

                            <div className="sm:col-span-2">
                              <label htmlFor="houseNo" className="block text-sm font-medium text-gray-700">
                                House No.
                              </label>
                            <div className="mt-1">
                              <input
                                  type="text"
                                  name="address.houseNo"
                                  id="houseNo"
                                  value={storeData.address.houseNo}
                                  onChange={handleInputChange}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                              <label htmlFor="landmark" className="block text-sm font-medium text-gray-700">
                                Landmark
                            </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="address.landmark"
                                  id="landmark"
                                  value={storeData.address.landmark}
                                  onChange={handleInputChange}
                                  placeholder="Near to..."
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                            </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="mapLink" className="block text-sm font-medium text-gray-700">
                                Google Maps Link
                              </label>
                            <div className="mt-1">
                              <input
                                  type="url"
                                  name="address.mapLink"
                                  id="mapLink"
                                  value={storeData.address.mapLink}
                                  onChange={handleInputChange}
                                  placeholder="https://goo.gl/maps/..."
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Social Media</h3>
                          <p className="mt-1 text-sm text-gray-500">
                              Connect with your customers on social media
                          </p>
                        </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            {Object.keys(storeData.socialMedia).map((platform) => (
                              <div key={platform} className="sm:col-span-3">
                                <label htmlFor={platform} className="block text-sm font-medium text-gray-700 capitalize flex items-center gap-2">
                                  <Image
                                    src={`/images/social/${platform}.svg`}
                                    alt={`${platform} icon`}
                                    width={20}
                                    height={20}
                                    className="text-gray-600"
                                  />
                                  {platform}
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="url"
                                    name={`socialMedia.${platform}`}
                                    id={platform}
                                    value={storeData.socialMedia[platform]}
                                    onChange={handleInputChange}
                                    placeholder={`https://${platform}.com/...`}
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  />
                                </div>
                              </div>
                            ))}
                            </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Working Hours</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Set your store's operating hours
                            </p>
                          </div>

                          <div className="mt-6">
                            {Object.entries(storeData.workingHours).map(([day, hours]) => (
                              <div key={day} className="flex items-center space-x-4 py-2">
                                <div className="w-28">
                                  <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                    checked={hours.isOpen}
                                    onChange={() => handleWorkingHoursChange(day as keyof StoreData['workingHours'], 'isOpen', !hours.isOpen)}
                                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-500">Open</span>
                              </div>
                                {hours.isOpen && (
                                  <>
                                    <input
                                      type="time"
                                      value={hours.open}
                                      onChange={(e) => handleWorkingHoursChange(day as keyof StoreData['workingHours'], 'open', e.target.value)}
                                      className="shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border-gray-300 rounded-md"
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input
                                      type="time"
                                      value={hours.close}
                                      onChange={(e) => handleWorkingHoursChange(day as keyof StoreData['workingHours'], 'close', e.target.value)}
                                      className="shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border-gray-300 rounded-md"
                                    />
                                  </>
                                )}
                              </div>
                            ))}
                            </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Store Features</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Customize your store's functionality
                            </p>
                          </div>

                          <div className="mt-6">
                            {Object.entries(storeData.features).map(([feature, enabled]) => (
                              <div key={feature} className="relative flex items-start py-2">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                    checked={enabled}
                                    onChange={() => handleFeatureChange(feature as keyof StoreData['features'])}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                  <label className="font-medium text-gray-700 capitalize">
                                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                                  </label>
                              </div>
                            </div>
                            ))}
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Languages</h3>
                          <p className="mt-1 text-sm text-gray-500">
                              Select the languages your store supports
                          </p>
                        </div>

                        <div className="mt-6">
                            {Object.entries(storeData.languages).map(([language, enabled]) => (
                              <div key={language} className="relative flex items-start py-2">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                    checked={enabled}
                                    onChange={() => handleLanguageChange(language as keyof StoreData['languages'])}
                                  className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                  <label className="font-medium text-gray-700 capitalize">
                                    {language}
                                  </label>
                              </div>
                            </div>
                            ))}
                              </div>
                              </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">SEO Settings</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Optimize your store for search engines
                            </p>
                            </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-6">
                              <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700">
                                Meta Title
                              </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="seo.metaTitle"
                                  id="metaTitle"
                                  value={storeData.seo.metaTitle}
                                  onChange={handleInputChange}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700">
                                Meta Description
                              </label>
                              <div className="mt-1">
                                <textarea
                                  name="seo.metaDescription"
                                  id="metaDescription"
                                  rows={3}
                                  value={storeData.seo.metaDescription}
                                  onChange={handleInputChange}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                            </div>
                            </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                                Keywords
                              </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="seo.keywords"
                                  id="keywords"
                                  value={storeData.seo.keywords}
                                  onChange={handleInputChange}
                                  placeholder="Separate keywords with commas"
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Options</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Configure how customers can receive their orders
                          </p>
                        </div>

                        <div className="mt-6 space-y-6">
                          {/* Local Delivery */}
                          <div className="relative flex items-start">
                            <div className="flex items-center h-5">
                              <input
                                type="checkbox"
                                name="delivery_options.delivery"
                                checked={storeData.delivery_options.delivery}
                                onChange={(e) => handleCheckboxChange('delivery_options', 'delivery')}
                                className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                              />
                            </div>
                            <div className="ml-3">
                              <label className="font-medium text-gray-700">Enable Local Delivery</label>
                            </div>
                          </div>

                          {storeData.delivery_options.delivery && (
                            <div className="ml-8 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                              <div className="sm:col-span-2">
                                <label htmlFor="deliveryRadius" className="block text-sm font-medium text-gray-700">
                                  Delivery Radius (km)
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="number"
                                    name="delivery_options.deliveryRadius"
                                    id="deliveryRadius"
                                    value={storeData.delivery_options.deliveryRadius}
                                    onChange={handleInputChange}
                                    min="0"
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  />
                                </div>
                              </div>

                              <div className="sm:col-span-2">
                                <label htmlFor="deliveryFee" className="block text-sm font-medium text-gray-700">
                                  Delivery Fee (ETB)
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="number"
                                    name="delivery_options.deliveryFee"
                                    id="deliveryFee"
                                    value={storeData.delivery_options.deliveryFee}
                                    onChange={handleInputChange}
                                    min="0"
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  />
                                </div>
                              </div>

                              <div className="sm:col-span-2">
                                <label htmlFor="minimumOrderForFreeDelivery" className="block text-sm font-medium text-gray-700">
                                  Free Delivery Threshold (ETB)
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="number"
                                    name="delivery_options.minimumOrderForFreeDelivery"
                                    id="minimumOrderForFreeDelivery"
                                    value={storeData.delivery_options.minimumOrderForFreeDelivery}
                                    onChange={handleInputChange}
                                    min="0"
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  />
                                </div>
                              </div>

                              <div className="sm:col-span-3">
                                <label htmlFor="estimatedDeliveryTime" className="block text-sm font-medium text-gray-700">
                                  Estimated Delivery Time (minutes)
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="delivery_options.estimatedDeliveryTime"
                                    id="estimatedDeliveryTime"
                                    value={storeData.delivery_options.estimatedDeliveryTime}
                                    onChange={handleInputChange}
                                    placeholder="e.g., 30-60"
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Store Pickup */}
                          <div className="relative flex items-start">
                            <div className="flex items-center h-5">
                              <input
                                type="checkbox"
                                name="delivery_options.pickup"
                                checked={storeData.delivery_options.pickup}
                                onChange={(e) => handleCheckboxChange('delivery_options', 'pickup')}
                                className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                              />
                            </div>
                            <div className="ml-3">
                              <label className="font-medium text-gray-700">Enable Store Pickup</label>
                              <p className="text-sm text-gray-500">Allow customers to pick up orders during working hours</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5">
                      <div className="flex justify-end space-x-3">
                        <Link
                          href={session?.user?.id ? `/stores/${session.user.id}` : '#'}
                          target="_blank"
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                            session?.user?.id 
                              ? 'bg-blue-600 hover:bg-blue-700' 
                              : 'bg-gray-400 cursor-not-allowed'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                          onClick={(e) => {
                            if (!session?.user?.id) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-5 w-5 mr-2" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          Preview Store
                        </Link>
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