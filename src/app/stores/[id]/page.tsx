'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/utils/translations';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { motion } from 'framer-motion';
import { getFlashSalePrices } from '@/utils/flashSales';
import { Tab } from '@headlessui/react';


// Add interfaces for store settings
interface PaymentMethods {
  cash: boolean;
  [key: string]: boolean;
}

interface DeliveryOptions {
  pickup: boolean;
  [key: string]: boolean;
}

interface Address {
  city: string;
  kebele: string;
  wereda: string;
  houseNo: string;
  mapLink?: string;
  subCity: string;
  landmark?: string;
  [key: string]: any; // Add index signature for character keys (0, 1, 2, etc.)
}

interface StoreSettings {
  name: string;
  description: string;
  shortDescription: string;
  logo_url: string;
  banner_url: string;
  address: Address;
  phone: string;
  alternativePhone: string;
  socialMedia: {
    [key: string]: string;
  };
  workingHours: {
    [key: string]: { open: string; close: string; isOpen: boolean };
  };
  payment_methods: {
    cash: boolean;
    TELEBIRR: boolean;
    CBE: boolean;
    AMOLE: boolean;
    CHAPA: boolean;
    BANK: boolean;
    MPESA: boolean;
  };
  delivery_options: {
    delivery: boolean;
    pickup: boolean;
    shipping: boolean;
    deliveryRadius: number;
    deliveryFee: number;
    minimumOrderForFreeDelivery: number;
    estimatedDeliveryTime: string;
  };
  businessType: string;
  tinNumber: string;
  businessLicense: string;
  vatRegistered: boolean;
  languages: { [key: string]: boolean };
  features: { [key: string]: boolean };
}

export default function StorePage() {
  const { language } = useLanguage();
  const params = useParams();
  const id = params?.id ? (Array.isArray(params.id) ? (params.id.length > 0 ? params.id[0] : null) : params.id) : null;
  const router = useRouter();
  const [owner, setOwner] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const supabase = createClientComponent();
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [store, setStore] = useState<StoreSettings | null>(null);

  useEffect(() => {
    if (!id) {
      console.error('No ID provided in URL');
      setError('No store ID provided');
      setLoading(false);
      return;
    }
    
    console.log('Store ID from URL:', id);
    fetchStoreData();
  }, [id]);

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the store data (which now includes payment methods)
      const storeResponse = await fetch(`/api/stores/${id}`);
      if (!storeResponse.ok) {
        const errorData = await storeResponse.json();
        throw new Error(errorData.message || 'Failed to fetch store data');
      }
      
      const storeData = await storeResponse.json();
      if (!storeData.owner) {
        throw new Error(`Store not found. ID: ${id}`);
      }
      
      // Check if the store has proper setup (store_settings)
      if (!storeData.owner.store_settings) {
        throw new Error('This store is not set up yet. Please check back later.');
      }

      // Rest of the data fetching (products, ratings, likes)
      const productIds = storeData.products?.map((p: any) => p.id) || [];
      const flashSalePrices = await getFlashSalePrices(productIds);

      // Fetch ratings and likes data
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select(`
          id,
          rating,
          product_id,
          user_id
        `)
        .in('product_id', productIds);

      const { data: likesData } = await supabase
        .from('likes')
        .select('*')
        .in('product_id', productIds);

      // Calculate metrics for each product
      const productsWithMetrics = storeData.products?.map((product: any) => {
        const productRatings = (ratingsData || []).filter(r => r.product_id === product.id);
        const productLikes = (likesData || []).filter(l => l.product_id === product.id);
        
        // Calculate average rating
        const avgRating = productRatings.length > 0 
          ? productRatings.reduce((acc: number, curr: any) => acc + (curr.rating || 0), 0) / productRatings.length 
          : 0;

        return {
          ...product,
          flash_sale_price: flashSalePrices[product.id],
          metrics: {
            avgRating: Number(avgRating.toFixed(1)),
            totalRatings: productRatings.length,
            totalLikes: productLikes.length
          }
        };
      });

      // Set the store data (which now includes payment methods from the API)
      const storeSettings = storeData.owner.store_settings;
      
      // Ensure all required fields have defaults
      const safeStoreSettings = {
        name: storeSettings.name || 'Unnamed Store',
        description: storeSettings.description || '',
        shortDescription: storeSettings.shortDescription || '',
        logo_url: storeSettings.logo_url || '',
        banner_url: storeSettings.banner_url || '',
        address: storeSettings.address || {},
        phone: storeSettings.phone || '',
        alternativePhone: storeSettings.alternativePhone || '',
        socialMedia: storeSettings.socialMedia || {},
        workingHours: storeSettings.workingHours || {},
        payment_methods: storeSettings.payment_methods || {},
        delivery_options: storeSettings.delivery_options || {},
        ...storeSettings
      };
      
      setStore(safeStoreSettings);
      setOwner(storeData.owner);
      setProducts(productsWithMetrics || []);

    } catch (err) {
      console.error('Error fetching store data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !owner || !store) {
    return (
      <div className="min-h-screen bg-gray-50 pt-4 flex items-center justify-center">
        <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-lg">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{translations['store.notFound'][language]}</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          
          {/* Debug information - remove in production */}
          <div className="mt-4 text-left text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-60">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          
          <div className="mt-6 flex justify-center space-x-4">
            <button 
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all"
            >
              {translations['store.returnHome'][language]}
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 transition-all"
            >
              {translations['store.tryAgain'][language]}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group products by category
  const productCategories = {
    all: products,
    featured: products.filter(p => p.is_featured),
    new: products.filter(p => {
      const createdAt = new Date(p.created_at);
      return Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
    }),
    sale: products.filter(p => p.flash_sale_price),
  };

  // Sort products based on selected option
  const sortProducts = (products: any[]) => {
    switch (sortBy) {
      case 'price-low':
        return [...products].sort((a, b) => a.price - b.price);
      case 'price-high':
        return [...products].sort((a, b) => b.price - a.price);
      case 'popular':
        return [...products].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      case 'newest':
      default:
        return [...products].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-12">
      {/* Store Banner */}
      <div className="relative h-64 md:h-80 w-full bg-gray-200">
        {store.banner_url && (
          <img
            src={store.banner_url}
            alt={store.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-24 sm:-mt-32 pb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            {/* Store Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Store Logo */}
              <div className="relative h-32 w-32 rounded-2xl overflow-hidden bg-gray-100 ring-4 ring-white">
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-4xl font-bold">
                    {store.name[0] || '?'}
                  </div>
                )}
              </div>

              {/* Store Details */}
              <div className="flex-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
                  {owner.verification_status === 'verified' && (
                    <div className="relative group">
                      <svg 
                        className="w-6 h-6 text-blue-500" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                        aria-label="Verified Seller"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Verified Seller
                      </div>
                    </div>
                  )}
                </div>
                {store.shortDescription && (
                  <p className="mt-2 text-lg text-gray-600">{store.shortDescription}</p>
                )}
                {store.description && (
                  <p className="mt-2 text-base text-gray-500">{store.description}</p>
                )}

                {/* Business Info */}
                {(store.businessType || store.vatRegistered || store.businessLicense || store.tinNumber) && (
                  <div className="mt-4 space-y-2">
                    {store.businessType && (
                      <p className="text-sm text-gray-600">Business Type: {store.businessType}</p>
                    )}
                    {store.businessLicense && (
                      <p className="text-sm text-gray-600">License: {store.businessLicense}</p>
                    )}
                    {store.tinNumber && (
                      <p className="text-sm text-gray-600">TIN: {store.tinNumber}</p>
                    )}
                    {store.vatRegistered && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        VAT Registered
                      </span>
                    )}
                  </div>
                )}

                {/* Contact Info */}
                <div className="mt-4 flex flex-wrap gap-4">
                  {store.phone && (
                    <a
                      href={`tel:${store.phone}`}
                      className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {store.phone}
                    </a>
                  )}
                  {store.alternativePhone && (
                    <a
                      href={`tel:${store.alternativePhone}`}
                      className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {store.alternativePhone}
                    </a>
                  )}
                </div>

                {/* Languages */}
                {store.languages && Object.entries(store.languages).filter(([_, enabled]) => enabled).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700">Available Languages:</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(store.languages)
                        .filter(([_, enabled]) => enabled)
                        .map(([language]) => (
                          <span
                            key={language}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {language.charAt(0).toUpperCase() + language.slice(1)}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Store Features */}
                {store.features && Object.entries(store.features).filter(([_, enabled]) => enabled).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700">Store Features:</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(store.features)
                        .filter(([_, enabled]) => enabled)
                        .map(([feature]) => (
                          <span
                            key={feature}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            {feature.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact & Location */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{translations['store.location'][language]}</h2>
                <div className="mt-4 space-y-2">
                  {/* Extract street address from character keys */}
                  {(() => {
                    const address = store.address;
                    const streetAddressParts = [];
                    let i = 0;
                    while (address[i] !== undefined) {
                      streetAddressParts.push(address[i]);
                      i++;
                    }
                    const streetAddress = streetAddressParts.join('');
                    
                    const addressParts = [
                      address.houseNo && `House No. ${address.houseNo}`,
                      streetAddress,
                      address.landmark && `Near: ${address.landmark}`,
                      address.kebele && `Kebele ${address.kebele}`,
                      address.wereda && `Wereda ${address.wereda}`,
                      address.subCity,
                      address.city
                    ].filter(Boolean);
                    
                    return (
                      <>
                        {addressParts.map((part, index) => (
                          <p key={index} className="text-gray-600">
                            {part}
                          </p>
                        ))}
                      </>
                    );
                  })()}
                  
                  {store.address.mapLink && (
                    <a
                      href={store.address.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500 flex items-center"
                    >
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      View on Google Maps
                    </a>
                  )}
                </div>
              </div>

              {/* Working Hours */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{translations['store.workingHours'][language]}</h2>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {Object.entries(store.workingHours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between py-2 border-b">
                      <span className="text-gray-600 capitalize">{day}</span>
                      <span className="text-gray-900">
                        {hours.isOpen ? `${hours.open} - ${hours.close}` : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Delivery Options */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">{translations['store.deliveryInfo'][language]}</h2>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {store.delivery_options?.delivery && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-800">Local Delivery</h3>
                      <p className="mt-2 text-sm text-green-700">
                        {store.delivery_options.deliveryRadius && (
                          <>
                            Delivery within {store.delivery_options.deliveryRadius}km
                            <br />
                          </>
                        )}
                        {store.delivery_options.deliveryFee && (
                          <>
                            Fee: {store.delivery_options.deliveryFee} ETB
                            <br />
                          </>
                        )}
                        {store.delivery_options.minimumOrderForFreeDelivery && (
                          <>
                            Free delivery over {store.delivery_options.minimumOrderForFreeDelivery} ETB
                          </>
                        )}
                        {store.delivery_options.estimatedDeliveryTime && (
                          <>
                            <br />
                            Estimated delivery time: {store.delivery_options.estimatedDeliveryTime} minutes
                          </>
                        )}
                      </p>
                    </div>
                  )}
                  {store.delivery_options?.pickup && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-800">Store Pickup</h3>
                      <p className="mt-2 text-sm text-blue-700">
                        Available during working hours
                      </p>
                    </div>
                  )}
                </div>
                {!store.delivery_options?.delivery && !store.delivery_options?.pickup && (
                  <p className="text-gray-500 text-center">No delivery options available</p>
                )}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">{translations['store.acceptedPayments'][language]}</h3>
              <div className="flex flex-wrap gap-3">
                {/* Cash is always shown */}
                <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                  <span className="text-lg mr-2">💵</span>
                  <span>Cash</span>
                </div>

                {/* Show Telebirr if active */}
                {store.payment_methods.TELEBIRR && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <img 
                      src="/images/payment-methods/Telebirr-logo.png" 
                      alt="Telebirr" 
                      width={24} 
                      height={24} 
                      className="mr-2"
                    />
                    <span>Telebirr</span>
                  </div>
                )}

                {/* Show CBE if active */}
                {store.payment_methods.CBE && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <img 
                      src="/images/cbe-logo.png" 
                      alt="CBE" 
                      width={24} 
                      height={24} 
                      className="mr-2"
                    />
                    <span>CBE</span>
                  </div>
                )}

                {/* Show Amole if active */}
                {store.payment_methods.AMOLE && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <img 
                      src="/images/amole-logo.png" 
                      alt="Amole" 
                      width={24} 
                      height={24} 
                      className="mr-2"
                    />
                    <span>Amole</span>
                  </div>
                )}

                {/* Show Chapa if active */}
                {store.payment_methods.CHAPA && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <img 
                      src="/images/payment-methods/chapa-logo.png" 
                      alt="Chapa" 
                      width={48} 
                      height={32} 
                      className="mr-2"
                      style={{ objectFit: 'contain' }}
                    />
                    <span>Chapa</span>
                  </div>
                )}

                {/* Show M-PESA if active */}
                {store.payment_methods.MPESA && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <img 
                      src="/images/payment-methods/mpesa-logo.png" 
                      alt="M-PESA" 
                      width={24} 
                      height={24} 
                      className="mr-2"
                    />
                    <span>M-PESA</span>
                  </div>
                )}

                {/* Show Bank Transfer if active */}
                {store.payment_methods.BANK && (
                  <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                    <span className="text-lg mr-2">🏦</span>
                    <span>Bank Transfer</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold text-gray-900">{translations['store.products'][language]}</h2>
            
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>

          {/* Product Categories */}
          <Tab.Group onChange={(index) => setActiveTab(['all', 'featured', 'new', 'sale'][index])}>
            <Tab.List className="flex space-x-2 rounded-xl bg-white p-1 shadow-sm mb-8">
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                 ${selected
                  ? 'bg-red-500 text-white shadow'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }>
                {translations['store.tab.all'][language]}
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                 ${selected
                  ? 'bg-red-500 text-white shadow'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }>
                {translations['store.tab.featured'][language]}
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                 ${selected
                  ? 'bg-red-500 text-white shadow'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }>
                {translations['store.tab.new'][language]}
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                 ${selected
                  ? 'bg-red-500 text-white shadow'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }>
                {translations['store.tab.sale'][language]}
              </Tab>
            </Tab.List>
          </Tab.Group>

          {/* Product Grid */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortProducts(productCategories[activeTab as keyof typeof productCategories]).map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <ProductCard 
                  product={{
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    description: product.description,
                    flash_sale_price: product.flash_sale_price,
                    product_images: product.product_images,
                    users: {
                      id: owner.id,
                      full_name: owner.full_name,
                      store_settings: store
                    },
                    like_count: product.metrics.totalLikes,
                    avgRating: product.metrics.avgRating,
                    totalRatings: product.metrics.totalRatings,
                    is_active: product.is_active,
                    owner_id: owner.id,
                    category: product.category
                  }}
                />
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {productCategories[activeTab as keyof typeof productCategories].length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg">
              <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">No products found</h3>
              <p className="mt-2 text-gray-500">
                {activeTab === 'all' 
                  ? 'This store hasn\'t added any products yet.'
                  : `No ${activeTab} products available at the moment.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 