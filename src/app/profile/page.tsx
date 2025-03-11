'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface StoreSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo_url?: string;
  banner_url?: string;
  description: string;
  updated_at?: string;
  payment_methods: {
    cash: boolean;
    telebirr: boolean;
    creditCard: boolean;
    bankTransfer: boolean;
  };
  delivery_options: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  avatar_url?: string;
  role: 'owner' | 'customer' | 'admin';
  store_settings?: StoreSettings;
  subscription_plan: 'basic' | 'pro' | 'enterprise';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponent();

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    store_settings: {
      name: '',
      description: '',
      contact_email: '',
      contact_phone: '',
      business_address: '',
      social_media: {
        facebook: '',
        instagram: '',
        twitter: '',
      },
    },
  });

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

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.store_settings?.contact_phone || '',
          address: data.store_settings?.address || '',
          store_settings: {
            name: data.store_settings?.name || '',
            description: data.store_settings?.description || '',
            contact_email: data.store_settings?.contact_email || '',
            contact_phone: data.store_settings?.contact_phone || '',
            business_address: data.store_settings?.business_address || '',
            social_media: {
              facebook: data.store_settings?.social_media?.facebook || '',
              instagram: data.store_settings?.social_media?.instagram || '',
              twitter: data.store_settings?.social_media?.twitter || '',
            },
          },
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      // Prepare store_settings object
      const store_settings = profile?.role === 'owner' ? {
        name: formData.store_settings.name,
        description: formData.store_settings.description,
        contact_email: formData.store_settings.contact_email,
        contact_phone: formData.phone,
        business_address: formData.store_settings.business_address,
        social_media: formData.store_settings.social_media,
        address: formData.address,
      } : {
        address: formData.address,
        contact_phone: formData.phone
      };

      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          store_settings
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      fetchProfile(); // Refresh profile data
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Store Information</h1>
              <button
                onClick={() => router.push('/dashboard/settings')}
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
                  <p className="text-sm text-gray-900">Address: {profile?.store_settings?.address}</p>
                </div>
              </div>

              {/* Payment Methods */}
              {profile?.store_settings?.payment_methods && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Payment Methods</label>
                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(profile.store_settings.payment_methods)
                        .filter(([_, enabled]) => enabled)
                        .map(([method]) => (
                          <span
                            key={method}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                          >
                            {method.charAt(0).toUpperCase() + method.slice(1)}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Options */}
              {profile?.store_settings?.delivery_options && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700">Delivery Options</label>
                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(profile.store_settings.delivery_options)
                        .filter(([_, enabled]) => enabled)
                        .map(([option]) => (
                          <span
                            key={option}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                          >
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 