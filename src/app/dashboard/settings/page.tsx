'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

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
  slug: string;
  email: string;
  phone: string;
  description: string;
  logo_url: string;
  banner_url: string;
  updated_at: string;
  payment_methods: {
    cash: boolean;
    telebirr: {
      is_active: boolean;
      // ... other telebirr fields
    };
    cbeBirr: {
      is_active: boolean;
      // ... other cbe fields
    };
    amole: {
      is_active: boolean;
      // ... other amole fields
    };
    chapa: {
      is_active: boolean;
      public_key?: string;
      secret_key?: string;
      callback_url?: string;
    };
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

// Add this type definition at the top with other interfaces
interface PaymentMethods {
  cash: boolean;
  telebirr: boolean;
  cbeBirr: boolean;
  amole: boolean;
  chapa: boolean;
}

// Utility function to generate a URL-friendly slug from store name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
};

// Function to check if slug is available (simplified for client-side)
const checkSlugAvailability = async (slug: string, currentUserId: string): Promise<boolean> => {
  // For now, return true to avoid the chunk loading error
  // We'll implement proper checking when saving the form
  return true;
};

// Function to generate unique slug (simplified)
const generateUniqueSlug = async (baseName: string, currentUserId: string): Promise<string> => {
  // Just generate the basic slug for now
  // Uniqueness will be checked on the server side when saving
  return generateSlug(baseName);
};

export default function StoreSettingsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [columnMissing, setColumnMissing] = useState(false);
  const [bucketMissing, setBucketMissing] = useState(false);
  const [storeData, setStoreData] = useState<StoreData>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    description: '',
    logo_url: '',
    banner_url: '',
    updated_at: new Date().toISOString(),
    payment_methods: {
      cash: true,
      telebirr: { is_active: false },
      cbeBirr: { is_active: false },
      amole: { is_active: false },
      chapa: {
        is_active: false,
        public_key: '',
        secret_key: '',
        callback_url: ''
      }
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
          router.push(`/login?message=${encodeURIComponent(t('dashboard.error.auth'))}`);
          return;
        }

        setSession(currentSession);
        
        // Fetch user data, payment settings, and seller verification data
        const [
          { data: userData, error: userError },
          { data: paymentSettings, error: paymentError },
          { data: verificationData, error: verificationError }
        ] = await Promise.all([
          supabase
            .from('users')
            .select('role, store_settings, email, full_name')
            .eq('id', currentSession.user.id)
            .single(),
          supabase
            .from('payment_settings')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .single(),
          supabase
            .from('seller_verification')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .eq('status', 'approved')
            .single()
        ]);
        
        console.log('Verification data loaded:', verificationData);
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          setError(t('dashboard.error.verifyPermissions'));
          return;
        }
        
        if (userData?.role !== 'owner') {
          router.push('/');
          return;
        }

        // Merge payment settings with store settings
        const mergedPaymentMethods = {
          cash: true, // Always true
          telebirr: paymentSettings?.telebirr_settings || { is_active: false },
          cbeBirr: paymentSettings?.cbe_birr_settings || { is_active: false },
          amole: paymentSettings?.amole_settings || { is_active: false },
          chapa: paymentSettings?.chapa_settings || { 
            is_active: false,
            public_key: '',
            secret_key: '',
            callback_url: ''
          }
        };
        
        // Pre-populate with verification data if available, then override with store settings if they exist
        const baseData = {
          name: verificationData?.business_name || userData?.store_settings?.name || '',
          email: verificationData?.business_email || userData?.email || '',
          phone: verificationData?.business_phone || userData?.store_settings?.phone || '',
          address: {
            city: verificationData?.region || userData?.store_settings?.address?.city || '',
            subCity: verificationData?.kifle_ketema || userData?.store_settings?.address?.subCity || '',
            wereda: verificationData?.woreda || userData?.store_settings?.address?.wereda || '',
            kebele: verificationData?.kebele || userData?.store_settings?.address?.kebele || '',
            houseNo: verificationData?.house_no || userData?.store_settings?.address?.houseNo || '',
            landmark: userData?.store_settings?.address?.landmark || '',
            mapLink: userData?.store_settings?.address?.mapLink || '',
          }
        };

        setStoreData(prev => ({
          ...prev,
          // Base data from verification
          ...baseData,
          // Override with existing store settings if they exist
          ...(userData?.store_settings || {}),
          // Ensure we keep the pre-populated data if store settings don't have these fields
          name: userData?.store_settings?.name || baseData.name,
          slug: userData?.store_settings?.slug || '',
          email: userData?.store_settings?.email || baseData.email,
          phone: userData?.store_settings?.phone || baseData.phone,
          address: {
            ...baseData.address,
            ...(userData?.store_settings?.address || {})
          },
          // Payment and other settings
          payment_methods: mergedPaymentMethods,
          delivery_options: {
            ...prev.delivery_options,
            ...(userData?.store_settings?.delivery_options || {}),
          },
          currentLogo: userData?.store_settings?.logo_url || '',
          currentBanner: userData?.store_settings?.banner_url || '',
        }));

        // Generate slug if it doesn't exist (simplified)
        const currentName = userData?.store_settings?.name || baseData.name;
        const currentSlug = userData?.store_settings?.slug;
        
        if (currentName && !currentSlug) {
          setStoreData(prev => ({
            ...prev,
            slug: generateSlug(currentName)
          }));
        }

        console.log('Store data populated with verification info:', {
          verificationData,
          baseData,
          finalStoreData: storeData
        });
      } catch (error) {
        console.error('Error loading store settings:', error);
        setError(t('settings.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    
    checkAccessAndLoadData();
  }, [router]);

  useEffect(() => {
    console.log('Payment Methods State:', storeData.payment_methods);
  }, [storeData.payment_methods]);

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
      
      // Auto-generate slug when store name changes (simplified)
      if (name === 'name' && value.trim()) {
        setStoreData(prev => ({
          ...prev,
          slug: generateSlug(value)
        }));
      }
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

  // SEO Helper functions
  const generateSEOContent = () => {
    const storeName = storeData.name || 'My Store';
    const description = storeData.shortDescription || storeData.description || '';
    const businessName = storeData.name;
    
    // Generate meta title
    const metaTitle = `${storeName} - Premium Products & Fast Delivery | Ethiopian Marketplace`;
    
    // Generate meta description
    const metaDescription = description 
      ? `Shop at ${storeName}. ${description.substring(0, 120)}... Fast delivery across Ethiopia. Trusted seller with quality products.`
      : `Discover quality products at ${storeName}. Fast delivery across Ethiopia. Trusted verified seller with excellent customer service.`;
    
    // Generate keywords based on store info
    const baseKeywords = [
      storeName.toLowerCase(),
      'ethiopian store',
      'online shopping ethiopia',
      'fast delivery',
      'quality products',
      'trusted seller'
    ];
    
    // Add business-specific keywords if available
    if (businessName && businessName !== storeName) {
      baseKeywords.push(businessName.toLowerCase());
    }
    
    const keywords = baseKeywords.join(', ');
    
    setStoreData(prev => ({
      ...prev,
      seo: {
        metaTitle: metaTitle.substring(0, 60), // Keep under 60 chars
        metaDescription: metaDescription.substring(0, 160), // Keep under 160 chars
        keywords: keywords
      }
    }));
  };

  const seoPresets = [
    {
      name: 'General Store',
      title: '{storeName} - Quality Products & Fast Delivery in Ethiopia',
      description: 'Shop quality products at {storeName}. Fast delivery across Ethiopia. Verified seller with excellent customer service and competitive prices.',
      keywords: 'ethiopian store, online shopping ethiopia, quality products, fast delivery, {storeName}'
    },
    {
      name: 'Fashion Store',
      title: '{storeName} - Ethiopian Fashion & Style | Trendy Clothes',
      description: 'Discover the latest fashion trends at {storeName}. Shop clothing, accessories, and style essentials. Fast delivery across Ethiopia.',
      keywords: 'ethiopian fashion, clothes ethiopia, fashion store, style, trendy clothes, {storeName}'
    },
    {
      name: 'Electronics Store',
      title: '{storeName} - Electronics & Technology | Ethiopian Tech Store',
      description: 'Buy electronics and technology products at {storeName}. Phones, computers, gadgets with warranty. Fast delivery in Ethiopia.',
      keywords: 'electronics ethiopia, technology store, phones, computers, gadgets, {storeName}'
    },
    {
      name: 'Beauty Store',
      title: '{storeName} - Beauty & Personal Care | Ethiopian Beauty Store',
      description: 'Discover beauty and personal care products at {storeName}. Cosmetics, skincare, and beauty essentials. Trusted Ethiopian seller.',
      keywords: 'beauty products ethiopia, cosmetics, skincare, personal care, beauty store, {storeName}'
    }
  ];

  const applySEOPreset = (preset: typeof seoPresets[0]) => {
    const storeName = storeData.name || 'My Store';
    
    setStoreData(prev => ({
      ...prev,
      seo: {
        metaTitle: preset.title.replace('{storeName}', storeName),
        metaDescription: preset.description.replace('{storeName}', storeName),
        keywords: preset.keywords.replace('{storeName}', storeName.toLowerCase())
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

      // Validate and sanitize slug
      if (storeData.slug) {
        // Ensure slug is properly formatted
        const sanitizedSlug = generateSlug(storeData.slug);
        if (sanitizedSlug !== storeData.slug) {
          // Update the slug to the sanitized version
          setStoreData(prev => ({ ...prev, slug: sanitizedSlug }));
          storeData.slug = sanitizedSlug;
        }

        // Check for minimum length
        if (sanitizedSlug.length < 3) {
          throw new Error('Store URL must be at least 3 characters long.');
        }

        // Validate slug uniqueness (only if we have a valid session)
        if (session.user?.id) {
          const { data: existingStores, error: slugError } = await supabase
            .from('users')
            .select('id')
            .eq('store_settings->>slug', sanitizedSlug)
            .neq('id', session.user.id);

          if (slugError) {
            console.error('Error checking slug availability:', slugError);
            throw new Error('Unable to validate store URL. Please try again.');
          }

          if (existingStores && existingStores.length > 0) {
            throw new Error(`The store URL "${sanitizedSlug}" is already taken. Please choose a different one.`);
          }
        }
      } else {
        // Generate slug from store name if not provided
        if (storeData.name) {
          const generatedSlug = generateSlug(storeData.name);
          setStoreData(prev => ({ ...prev, slug: generatedSlug }));
          storeData.slug = generatedSlug;
        }
      }

      // Get user's email if store email is not provided
      if (!storeData.email) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;
        storeData.email = userData.email;
      }

      // Prepare settings data
      const settingsData = {
        ...storeData,
        logo_url: storeData.currentLogo || '',
        banner_url: storeData.currentBanner || '',
        updated_at: new Date().toISOString()
      };

      // Handle logo upload if there's a new file
      if (storeData.logo && storeData.logo instanceof File) {
        try {
          const fileExt = storeData.logo.name.split('.').pop();
          const filePath = `store-logos/${session.user.id}/logo.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(filePath, storeData.logo, {
              upsert: true,
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('stores')
            .getPublicUrl(filePath);

          settingsData.logo_url = publicUrl;
        } catch (error) {
          console.error('Logo upload error:', error);
          throw error;
        }
      }

      // Handle banner upload if there's a new file
      if (storeData.bannerImage && storeData.bannerImage instanceof File) {
        try {
          const fileExt = storeData.bannerImage.name.split('.').pop();
          const filePath = `store-banners/${session.user.id}/banner.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(filePath, storeData.bannerImage, {
              upsert: true,
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('stores')
            .getPublicUrl(filePath);

          settingsData.banner_url = publicUrl;
        } catch (error) {
          console.error('Banner upload error:', error);
          throw error;
        }
      }

      // Update store settings in users table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          store_settings: settingsData
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      toast.success('Store settings saved successfully!');
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
      setError(t('settings.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(t('settings.errors.noAuth'));
        setLoading(false);
        return;
      }

      // Fetch payment settings
      const { data: paymentSettings, error: paymentError } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (paymentError) {
        console.error('Error fetching payment settings:', paymentError);
        return;
      }

      // Update the storeData state with the fetched payment settings
      if (paymentSettings) {
        setStoreData(prevData => ({
          ...prevData,
          payment_methods: {
            cash: true, // Always true
            telebirr: paymentSettings.telebirr_settings || { is_active: false },
            cbeBirr: paymentSettings.cbe_birr_settings || { is_active: false },
            amole: paymentSettings.amole_settings || { is_active: false },
            chapa: paymentSettings.chapa_settings || { 
              is_active: false,
              public_key: '',
              secret_key: '',
              callback_url: ''
            }
          }
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to fetch settings');
      setLoading(false);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('settings.title')}</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div>
            <ErrorMessage message={error} />
            {columnMissing && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800">{t('settings.db.migrationRequired')}</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{t('settings.db.migration.text1')}</p>
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
                <h3 className="text-sm font-medium text-yellow-800">{t('settings.storage.bucketMissing')}</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{t('settings.storage.bucketMissing.text1')}</p>
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
                          <p className="text-sm font-medium text-green-800">{t('settings.toast.saved')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-8 divide-y divide-gray-200">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.basicInfo.title')}</h3>
                          <p className="mt-1 text-sm text-gray-500">{t('settings.basicInfo.subtitle')}</p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          {/* Store Name and Email - Full width container */}
                          <div className="sm:col-span-6">
                            <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6">
                          {/* Store Name */}
                              <div className="sm:col-span-1">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                  {t('settings.storeName')} *
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
                                    placeholder={t('settings.storeName.placeholder')}
                                  />
                                </div>
                              </div>

                              {/* Store URL Slug */}
                              <div className="sm:col-span-1">
                                <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                                  Store URL *
                                </label>
                                <div className="mt-1">
                                  <div className="flex rounded-md shadow-sm">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                      avrioxshop.com/store/
                                    </span>
                                    <input
                                      type="text"
                                      name="slug"
                                      id="slug"
                                      required
                                      minLength={3}
                                      value={storeData.slug}
                                      onChange={handleInputChange}
                                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-green-500 focus:border-green-500 sm:text-sm border-gray-300"
                                      placeholder="your-store-name"
                                      pattern="^[a-zA-Z0-9\-]{3,}$"
                                      title="Only letters, numbers, and hyphens allowed (minimum 3 characters)"
                                    />
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    🔗 This will be your store's web address. Only letters, numbers, and hyphens allowed (minimum 3 characters).
                                    <br />
                                    <span className="text-amber-600">⚠️ Uniqueness will be validated when you save the form.</span>
                                    {storeData.slug && storeData.slug.length < 3 && (
                                      <>
                                        <br />
                                        <span className="text-red-600">❌ Too short! URL must be at least 3 characters long.</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Store Email - Move to new row */}
                          <div className="sm:col-span-3">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              {t('settings.storeEmail')} *
                            </label>
                            <div className="mt-1">
                              <input
                                type="email"
                                name="email"
                                id="email"
                                required
                                value={storeData.email}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder={t('settings.storeEmail.placeholder')}
                              />
                            </div>
                          </div>

                          {/* Phone - Move to new row */}
                          <div className="sm:col-span-3">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                              {t('settings.phone')} *
                            </label>
                            <div className="mt-1">
                              <input
                                type="tel"
                                name="phone"
                                id="phone"
                                required
                                value={storeData.phone}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                placeholder={t('settings.phone.placeholder')}
                              />
                            </div>
                          </div>


                          {/* Short Description */}
                          <div className="sm:col-span-6">
                            <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700">
                              {t('settings.shortDescription')} *
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="shortDescription"
                                id="shortDescription"
                                required
                                value={storeData.shortDescription}
                                onChange={handleInputChange}
                                placeholder={t('settings.shortDescription.placeholder')}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">{t('settings.shortDescription.help')}</p>
                          </div>

                          {/* Full Description */}
                          <div className="sm:col-span-6">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              {t('settings.fullDescription')} *
                            </label>
                            <div className="mt-1">
                              <textarea
                                name="description"
                                id="description"
                                rows={4}
                                required
                                value={storeData.description}
                                onChange={handleInputChange}
                                placeholder={t('settings.fullDescription.placeholder')}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                            <p className="mt-2 text-sm text-gray-500">{t('settings.fullDescription.help')}</p>
                          </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.branding.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.branding.subtitle')}</p>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            {/* Logo Upload */}
                            <div className="sm:col-span-3">
                              <label className="block text-sm font-medium text-gray-700">{t('settings.branding.logo')} *</label>
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
                                      required={!storeData.currentLogo}
                                      onChange={(e) => handleFileChange(e, 'logo')}
                                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                      accept="image/*"
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">{t('settings.branding.logo.recommended')}</p>
                                </div>
                              </div>
                            </div>

                            {/* Banner Upload */}
                            <div className="sm:col-span-3">
                              <label className="block text-sm font-medium text-gray-700">{t('settings.branding.banner')} *</label>
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
                                      required={!storeData.currentBanner}
                                      onChange={(e) => handleFileChange(e, 'bannerImage')}
                                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                      accept="image/*"
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">{t('settings.branding.banner.recommended')}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-8">
                          <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.contact.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.contact.subtitle')}</p>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-3">
                              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                {t('settings.contact.primaryPhone')} *
                            </label>
                            <div className="mt-1">
                              <input
                                  type="tel"
                                  name="phone"
                                  id="phone"
                                  required
                                  value={storeData.phone}
                                onChange={handleInputChange}
                                  placeholder={t('settings.contact.phone.placeholder')}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-3">
                              <label htmlFor="alternativePhone" className="block text-sm font-medium text-gray-700">
                                {t('settings.contact.alternativePhone')}
                            </label>
                            <div className="mt-1">
                                <input
                                  type="tel"
                                  name="alternativePhone"
                                  id="alternativePhone"
                                  value={storeData.alternativePhone}
                                onChange={handleInputChange}
                                  placeholder={t('settings.contact.phone.placeholder')}
                                className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>

                            <div className="sm:col-span-3">
                              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                                {t('settings.contact.city')} *
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
                                {t('settings.contact.subCity')} *
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
                                {t('settings.contact.wereda')}
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
                                {t('settings.contact.kebele')}
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
                                {t('settings.contact.houseNo')}
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
                                {t('settings.contact.landmark')}
                            </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="address.landmark"
                                  id="landmark"
                                  value={storeData.address.landmark}
                                  onChange={handleInputChange}
                                  placeholder={t('settings.contact.landmark.placeholder')}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                            </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="mapLink" className="block text-sm font-medium text-gray-700">
                                {t('settings.contact.mapLink')}
                              </label>
                            <div className="mt-1">
                              <input
                                  type="url"
                                  name="address.mapLink"
                                  id="mapLink"
                                  value={storeData.address.mapLink}
                                  onChange={handleInputChange}
                                  placeholder={t('settings.contact.mapLink.placeholder')}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.social.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.social.subtitle')}</p>
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
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.workingHours.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.workingHours.subtitle')}</p>
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
                                    <span className="text-sm text-gray-500">{t('settings.workingHours.open')}</span>
                              </div>
                                {hours.isOpen && (
                                  <>
                                    <input
                                      type="time"
                                      value={hours.open}
                                      onChange={(e) => handleWorkingHoursChange(day as keyof StoreData['workingHours'], 'open', e.target.value)}
                                      className="shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border-gray-300 rounded-md"
                                    />
                                    <span className="text-gray-500">{t('settings.workingHours.to')}</span>
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
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.features.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.features.subtitle')}</p>
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
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.languages.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.languages.subtitle')}</p>
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
                            <p className="mt-1 text-sm text-gray-500">Optimize your store for search engines to attract more customers</p>
                          </div>

                          {/* Quick Setup Options */}
                          <div className="mt-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-blue-900 mb-3">🚀 Quick SEO Setup</h4>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <button
                                  type="button"
                                  onClick={generateSEOContent}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  ✨ Auto-Generate SEO
                                </button>
                                {seoPresets.map((preset) => (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => applySEOPreset(preset)}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                  >
                                    {preset.name}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-blue-700">
                                💡 Choose a preset that matches your store type, or use Auto-Generate for a personalized SEO setup
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-6">
                              <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700">
                                Page Title <span className="text-gray-500">(appears in search results)</span>
                              </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="seo.metaTitle"
                                  id="metaTitle"
                                  value={storeData.seo.metaTitle}
                                  onChange={handleInputChange}
                                  maxLength={60}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Your Store Name - What You Sell | Ethiopian Marketplace"
                                />
                                <div className="mt-1 flex justify-between">
                                  <p className="text-xs text-gray-500">
                                    Recommended: Keep under 60 characters for best search results
                                  </p>
                                  <span className={`text-xs ${storeData.seo.metaTitle.length > 60 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {storeData.seo.metaTitle.length}/60
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700">
                                Store Description <span className="text-gray-500">(appears under title in search)</span>
                              </label>
                              <div className="mt-1">
                                <textarea
                                  name="seo.metaDescription"
                                  id="metaDescription"
                                  rows={3}
                                  value={storeData.seo.metaDescription}
                                  onChange={handleInputChange}
                                  maxLength={160}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Describe what customers can find in your store. Mention fast delivery, quality products, and your location in Ethiopia."
                                />
                                <div className="mt-1 flex justify-between">
                                  <p className="text-xs text-gray-500">
                                    This text appears in Google search results. Make it compelling!
                                  </p>
                                  <span className={`text-xs ${storeData.seo.metaDescription.length > 160 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {storeData.seo.metaDescription.length}/160
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="sm:col-span-6">
                              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                                Search Keywords <span className="text-gray-500">(what customers search for)</span>
                              </label>
                              <div className="mt-1">
                                <input
                                  type="text"
                                  name="seo.keywords"
                                  id="keywords"
                                  value={storeData.seo.keywords}
                                  onChange={handleInputChange}
                                  className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  placeholder="ethiopian store, online shopping, your products, fast delivery"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  📝 Separate keywords with commas. Include: your store name, product types, "ethiopian store", "fast delivery"
                                </p>
                              </div>
                            </div>

                            {/* SEO Preview */}
                            {(storeData.seo.metaTitle || storeData.seo.metaDescription) && (
                              <div className="sm:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  🔍 Google Search Preview
                                </label>
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                  <div className="text-blue-600 text-lg hover:underline cursor-pointer">
                                    {storeData.seo.metaTitle || storeData.name || 'Your Store Name'}
                                  </div>
                                  <div className="text-green-700 text-sm">
                                    avrioxshop.com/store/{storeData.slug || 'your-store-name'}
                                  </div>
                                  <div className="text-gray-600 text-sm mt-1">
                                    {storeData.seo.metaDescription || 'Your store description will appear here...'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.delivery.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.delivery.subtitle')}</p>
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
                              <label className="font-medium text-gray-700">{t('settings.delivery.enableLocal')}</label>
                            </div>
                          </div>

                          {storeData.delivery_options.delivery && (
                            <div className="ml-8 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                              <div className="sm:col-span-2">
                                <label htmlFor="deliveryRadius" className="block text-sm font-medium text-gray-700">
                                  {t('settings.delivery.radius')}
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
                                  {t('settings.delivery.fee')}
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
                                  {t('settings.delivery.freeThreshold')}
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
                                  {t('settings.delivery.etaMinutes')}
                                </label>
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    name="delivery_options.estimatedDeliveryTime"
                                    id="estimatedDeliveryTime"
                                    value={storeData.delivery_options.estimatedDeliveryTime}
                                    onChange={handleInputChange}
                                    placeholder={t('settings.delivery.eta.placeholder')}
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
                              <label className="font-medium text-gray-700">{t('settings.pickup.enable')}</label>
                              <p className="text-sm text-gray-500">{t('settings.pickup.subtitle')}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8">
                        <div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.payment.title')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('settings.payment.subtitle')}</p>
                        </div>

                        <div className="mt-6">
                          <div className="bg-white shadow rounded-lg">
                            <div className="divide-y divide-gray-200">
                              {/* Cash Payment - Always enabled */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h4 className="text-sm font-medium text-gray-900">{t('settings.payment.cash.title')}</h4>
                                    <p className="text-xs text-gray-500">{t('settings.payment.cash.desc')}</p>
                                  </div>
                                </div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {t('settings.payment.alwaysAvailable')}
                                </span>
                              </div>

                              {/* Telebirr */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <svg className={`h-5 w-5 ${storeData.payment_methods.telebirr.is_active ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h4 className="text-sm font-medium text-gray-900">{t('settings.payment.telebirr.title')}</h4>
                                    <p className="text-xs text-gray-500">{t('settings.payment.telebirr.desc')}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  storeData.payment_methods.telebirr.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {storeData.payment_methods.telebirr.is_active ? t('settings.status.active') : t('settings.status.inactive')}
                                </span>
                              </div>

                              {/* CBE */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <svg className={`h-5 w-5 ${storeData.payment_methods.cbeBirr.is_active ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h4 className="text-sm font-medium text-gray-900">{t('settings.payment.cbe.title')}</h4>
                                    <p className="text-xs text-gray-500">{t('settings.payment.cbe.desc')}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  storeData.payment_methods.cbeBirr.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {storeData.payment_methods.cbeBirr.is_active ? t('settings.status.active') : t('settings.status.inactive')}
                                </span>
                              </div>

                              {/* Amole */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <svg className={`h-5 w-5 ${storeData.payment_methods.amole.is_active ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h4 className="text-sm font-medium text-gray-900">{t('settings.payment.amole.title')}</h4>
                                    <p className="text-xs text-gray-500">{t('settings.payment.amole.desc')}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  storeData.payment_methods.amole.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {storeData.payment_methods.amole.is_active ? t('settings.status.active') : t('settings.status.inactive')}
                                </span>
                              </div>

                              {/* Chapa */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <svg className={`h-5 w-5 ${storeData.payment_methods.chapa.is_active ? 'text-green-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h4 className="text-sm font-medium text-gray-900">{t('settings.payment.chapa.title')}</h4>
                                    <p className="text-xs text-gray-500">{t('settings.payment.chapa.desc')}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  storeData.payment_methods.chapa.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {storeData.payment_methods.chapa.is_active ? t('settings.status.active') : t('settings.status.inactive')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5">
                      <div className="flex justify-end space-x-3">
                        <Link
                          href={storeData.slug ? `/store/${storeData.slug}` : (session?.user?.id ? `/stores/${session.user.id}` : '#')}
                          target="_blank"
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                            (storeData.slug || session?.user?.id)
                              ? 'bg-blue-600 hover:bg-blue-700' 
                              : 'bg-gray-400 cursor-not-allowed'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                          onClick={(e) => {
                            if (!storeData.slug && !session?.user?.id) {
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
                          {t('settings.actions.previewStore')}
                        </Link>
                        <button
                          type="button"
                          onClick={() => router.push('/dashboard')}
                          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          {t('settings.actions.cancel')}
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
                              {t('settings.actions.saving')}
                            </>
                          ) : (
                            t('settings.actions.save')
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