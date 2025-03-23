'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface Address {
  city: string;
  kebele: string;
  wereda: string;
  houseNo: string;
  mapLink?: string;
  subCity: string;
  landmark?: string;
}

interface SEO {
  keywords: string;
  metaTitle: string;
  metaDescription: string;
}

interface Features {
  showStock: boolean;
  enableChat: boolean;
  requireLogin: boolean;
  enableReviews: boolean;
  enableWishlist: boolean;
}

interface Languages {
  amharic: boolean;
  english: boolean;
  oromiffa: boolean;
  tigrigna: boolean;
}

interface SocialMedia {
  tiktok?: string;
  facebook?: string;
  telegram?: string;
  instagram?: string;
}

interface WorkingHours {
  [key: string]: {
    open: string;
    close: string;
    isOpen: boolean;
  };
}

interface DeliveryOptions {
  pickup: boolean;
  delivery: boolean;
  shipping: boolean;
  deliveryFee: string;
  deliveryRadius: number;
  estimatedDeliveryTime: string;
  minimumOrderForFreeDelivery: string;
}

interface PaymentMethods {
  cash: boolean;
  TELEBIRR: boolean;
  CBE: boolean;
  AMOLE: boolean;
  CHAPA: boolean;
  BANK: boolean;
  [key: string]: boolean;
}

interface StoreSettings {
  seo: SEO;
  name: string;
  email: string;
  phone: string;
  address: Address;
  features: Features;
  logo_url?: string;
  languages: Languages;
  tinNumber: string;
  banner_url?: string;
  updated_at: string;
  description: string;
  socialMedia: SocialMedia;
  businessType: string;
  workingHours: WorkingHours;
  vatRegistered: boolean;
  businessLicense: string;
  payment_methods: PaymentMethods;
  alternativePhone: string;
  delivery_options: DeliveryOptions;
  shortDescription: string;
  preferred_language?: 'amharic' | 'english' | 'oromiffa' | 'tigrigna';
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: 'owner' | 'customer' | 'admin';
  store_settings?: StoreSettings;
  subscription_plan: 'basic' | 'pro' | 'enterprise';
  created_at?: string;
}

// Add this interface for the customer profile form
interface CustomerProfileForm {
  full_name: string;
  phone: string;
  address: {
    city: string;
    subCity: string;
    wereda: string;
    kebele: string;
    houseNo: string;
    landmark?: string;
  };
  preferredLanguage: 'amharic' | 'english' | 'oromiffa' | 'tigrigna';
}

// Move CustomerEditDialog to be a separate component
const CustomerEditDialog = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  saving,
  subCities
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerProfileForm) => void;
  initialData: CustomerProfileForm;
  saving: boolean;
  subCities: string[];
}) => {
  // Keep form state local to dialog
  const [formData, setFormData] = useState(initialData);

  // Update form data when initialData changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50"
        onClose={onClose}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Edit Profile Information
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        full_name: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      required
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({
                        ...formData,
                        phone: e.target.value
                      })}
                      placeholder="e.g., +251911234567"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      required
                    />
                  </div>

                  {/* Address Section */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Address</h4>
                    
                    {/* Sub City */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Sub City
                      </label>
                      <select
                        value={formData.address.subCity}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            subCity: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        required
                      >
                        <option value="">Select Sub City</option>
                        {subCities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    {/* Wereda */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Wereda
                      </label>
                      <input
                        type="text"
                        value={formData.address.wereda}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            wereda: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* Kebele */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Kebele
                      </label>
                      <input
                        type="text"
                        value={formData.address.kebele}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            kebele: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* House Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        House Number
                      </label>
                      <input
                        type="text"
                        value={formData.address.houseNo}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            houseNo: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* Landmark (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Landmark (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.address.landmark}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            landmark: e.target.value
                          }
                        })}
                        placeholder="e.g., Near Bole Medhanialem Church"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Preferred Language
                    </label>
                    <select
                      value={formData.preferredLanguage}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferredLanguage: e.target.value as CustomerProfileForm['preferredLanguage']
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      required
                    >
                      <option value="amharic">Amharic</option>
                      <option value="english">English</option>
                      <option value="oromiffa">Oromiffa</option>
                      <option value="tigrigna">Tigrigna</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<CustomerProfileForm>({
    full_name: '',
    phone: '',
    address: {
      city: 'Addis Ababa',
      subCity: '',
      wereda: '',
      kebele: '',
      houseNo: '',
      landmark: '',
    },
    preferredLanguage: 'amharic',
  });

  // Ethiopian sub-cities (for Addis Ababa)
  const subCities = [
    'Addis Ketema',
    'Akaky Kaliti',
    'Arada',
    'Bole',
    'Gullele',
    'Kirkos',
    'Kolfe Keranio',
    'Lideta',
    'Nifas Silk-Lafto',
    'Yeka'
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?message=Please login to view your profile');
        return;
      }

      // First get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) throw userError;

      // Then get payment settings
      const { data: paymentSettings, error: paymentError } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (userData) {
        // Merge payment settings with store settings
        const mergedSettings = {
          ...userData.store_settings,
          payment_methods: {
            cash: true, // Always available
            TELEBIRR: paymentSettings?.telebirr_settings?.is_active || false,
            CBE: paymentSettings?.cbe_birr_settings?.is_active || false,
            AMOLE: paymentSettings?.amole_settings?.is_active || false,
            CHAPA: paymentSettings?.chapa_settings?.is_active || false,
            BANK: paymentSettings?.bank_settings?.is_active || false
          }
        };

        setProfile({
          ...userData,
          store_settings: mergedSettings
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (profile?.role === 'customer') {
      // Pre-fill the form with existing data
      setDialogData({
        full_name: profile.full_name || '',
        phone: profile.store_settings?.phone || '',
        address: profile.store_settings?.address ? {
          city: 'Addis Ababa',
          subCity: profile.store_settings.address.subCity || '',
          wereda: profile.store_settings.address.wereda || '',
          kebele: profile.store_settings.address.kebele || '',
          houseNo: profile.store_settings.address.houseNo || '',
          landmark: profile.store_settings.address.landmark || '',
        } : {
          city: 'Addis Ababa',
          subCity: '',
          wereda: '',
          kebele: '',
          houseNo: '',
          landmark: '',
        },
        preferredLanguage: profile.store_settings?.preferred_language || 'amharic',
      });
      setIsEditDialogOpen(true);
    } else {
      router.push('/dashboard/settings');
    }
  };

  const handleDialogSubmit = async (formData: CustomerProfileForm) => {
    try {
      setSaving(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      // First get current store_settings
      const { data: currentUser } = await supabase
        .from('users')
        .select('store_settings')
        .eq('id', session.user.id)
        .single();

      // Prepare the updated store_settings
      const updatedStoreSettings = {
        ...(currentUser?.store_settings || {}),
        address: formData.address,
        phone: formData.phone,
        preferred_language: formData.preferredLanguage,
      };

      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          store_settings: updatedStoreSettings,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      setIsEditDialogOpen(false);
      fetchProfile(); // Refresh profile data
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const renderCustomerProfile = () => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Customer Profile</h1>
          <button
            onClick={handleEditClick}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{profile?.full_name || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{profile?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-sm text-gray-900">
                  {profile?.store_settings?.phone || 'Not set'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Language</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {profile?.store_settings?.preferred_language || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          {/* Address Information */}
          {profile?.store_settings?.address && (
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.store_settings.address.city || 'Addis Ababa'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sub City</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.store_settings.address.subCity || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wereda</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.store_settings.address.wereda || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kebele</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.store_settings.address.kebele || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">House Number</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.store_settings.address.houseNo || 'Not set'}
                  </p>
                </div>
                {profile.store_settings.address.landmark && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Landmark</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {profile.store_settings.address.landmark}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Account Information */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Type</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{profile?.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Member Since</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(profile?.created_at || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
      
  const renderStoreProfile = () => (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Store Information</h1>
              <button
            onClick={handleEditClick}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Store Settings
              </button>
            </div>

            {error && <ErrorMessage message={error} />}

            <div className="space-y-8">
              {/* Store Logo */}
              {profile?.store_settings?.logo_url && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Store Logo</label>
                  <div className="sm:col-span-2">
                    <div className="relative h-32 w-32 rounded-lg overflow-hidden">
                      <Image
                        src={profile.store_settings.logo_url}
                        alt="Store Logo"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Store Banner */}
              {profile?.store_settings?.banner_url && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Store Banner</label>
                  <div className="sm:col-span-2">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden">
                      <Image
                        src={profile.store_settings.banner_url}
                        alt="Store Banner"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Store Details */}
              <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                <label className="text-sm font-medium text-gray-700">Store Name</label>
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-900">{profile?.store_settings?.name}</p>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-900">{profile?.store_settings?.description}</p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                <label className="text-sm font-medium text-gray-700">Contact Information</label>
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-sm text-gray-900">Email: {profile?.store_settings?.email}</p>
                  <p className="text-sm text-gray-900">Phone: {profile?.store_settings?.phone}</p>
                </div>
              </div>

              {/* Address */}
              <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-sm text-gray-900">
                    {profile?.store_settings?.address?.houseNo}, {profile?.store_settings?.address?.subCity}
                  </p>
                  <p className="text-sm text-gray-900">
                    Wereda: {profile?.store_settings?.address?.wereda}, Kebele: {profile?.store_settings?.address?.kebele}
                  </p>
                  <p className="text-sm text-gray-900">
                    {profile?.store_settings?.address?.city}
                  </p>
                  {profile?.store_settings?.address?.landmark && (
                    <p className="text-sm text-gray-900">
                      Landmark: {profile?.store_settings?.address?.landmark}
                    </p>
                  )}
                  {profile?.store_settings?.address?.mapLink && (
                    <a 
                      href={profile.store_settings.address.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View on Map
                    </a>
                  )}
                </div>
              </div>

              {/* Working Hours */}
              {profile?.store_settings?.workingHours && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Working Hours</label>
                  <div className="sm:col-span-2">
                    <div className="space-y-2">
                      {Object.entries(profile.store_settings.workingHours).map(([day, hours]) => (
                        <div key={day} className="flex justify-between text-sm">
                          <span className="capitalize">{day}</span>
                          <span>
                            {hours.isOpen ? (
                              `${hours.open} - ${hours.close}`
                            ) : (
                              <span className="text-red-600">Closed</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Options */}
              {profile?.store_settings?.delivery_options && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Delivery Information</label>
                  <div className="sm:col-span-2 space-y-2">
                    <p className="text-sm text-gray-900">
                      Delivery Fee: ETB {profile.store_settings.delivery_options.deliveryFee}
                    </p>
                    <p className="text-sm text-gray-900">
                      Delivery Radius: {profile.store_settings.delivery_options.deliveryRadius} km
                    </p>
                    <p className="text-sm text-gray-900">
                      Estimated Delivery Time: {profile.store_settings.delivery_options.estimatedDeliveryTime} minutes
                    </p>
                    <p className="text-sm text-gray-900">
                      Free Delivery Over: ETB {profile.store_settings.delivery_options.minimumOrderForFreeDelivery}
                    </p>
                  </div>
                </div>
              )}

              {/* Social Media Links */}
              {profile?.store_settings?.socialMedia && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Social Media</label>
                  <div className="sm:col-span-2 flex space-x-4">
                    {Object.entries(profile.store_settings.socialMedia).map(([platform, url]) => (
                      url && (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <span className="capitalize">{platform}</span>
                        </a>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {profile?.role === 'owner' && profile?.store_settings?.payment_methods && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Payment Methods</label>
                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap gap-3">
                      {/* Always show Cash */}
                      <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                        <span className="text-lg mr-2">💵</span>
                        <span>Cash</span>
                      </div>

                      {/* Show Telebirr if active */}
                      {profile.store_settings.payment_methods.TELEBIRR && (
                        <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                          <Image 
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
                      {profile.store_settings.payment_methods.CBE && (
                        <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                          <Image 
                            src="/images/payment-methods/cbe-logo.png" 
                            alt="CBE" 
                            width={24} 
                            height={24} 
                            className="mr-2"
                          />
                          <span>CBE</span>
                        </div>
                      )}

                      {/* Show Amole if active */}
                      {profile.store_settings.payment_methods.AMOLE && (
                        <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                          <Image 
                            src="/images/payment-methods/amole-logo.png" 
                            alt="Amole" 
                            width={24} 
                            height={24} 
                            className="mr-2"
                          />
                          <span>Amole</span>
                        </div>
                      )}

                      {/* Show Chapa if active */}
                      {profile.store_settings.payment_methods.CHAPA && (
                        <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                          <Image 
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

                      {/* Show Bank Transfer if active */}
                      {profile.store_settings.payment_methods.BANK && (
                        <div className="flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                          <span className="text-lg mr-2">🏦</span>
                          <span>Bank Transfer</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {profile?.role === 'customer' ? renderCustomerProfile() : renderStoreProfile()}
      </div>

      {/* Updated dialog component usage */}
      <CustomerEditDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        initialData={dialogData}
        saving={saving}
        subCities={subCities}
      />
    </div>
  );
}

function getPaymentMethodDisplay(method: string): string {
  const displayNames: { [key: string]: string } = {
    cash: 'Cash',
    telebirr: 'TeleBirr',
    cbeBirr: 'CBEBirr',
    coopayEbirr: 'Coopay-Ebirr',
    mPesa: 'M-Pesa',
    paypal: 'PayPal',
    enatBank: 'Enat Bank',
    pssCards: 'PSS Cards',
    creditCard: 'Credit / Debit Card',
    kachaWallet: 'Kacha Wallet'
  };
  return displayNames[method] || method;
}

function getPaymentMethodIcon(method: string): JSX.Element {
  // You can customize these icons or use an icon library
  const icons: { [key: string]: JSX.Element } = {
    cash: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    telebirr: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    creditCard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    // Add more icons for other payment methods
  };
  return icons[method] || (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
} 