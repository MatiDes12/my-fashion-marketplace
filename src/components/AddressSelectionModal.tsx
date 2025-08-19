'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { createClientComponent } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { reverseGeocode } from '@/utils/map';

interface Address {
  city: string;
  kebele: string;
  wereda: string;
  houseNo: string;
  subCity: string;
  landmark?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  mapLink?: string;
}

interface AddressSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress?: Address;
  onAddressSelect: (address: Address) => void;
  userRole?: 'owner' | 'customer';
  isGuest?: boolean; // New prop to indicate if this is a guest user
}

// Dynamic import of MapComponent
const MapComponent = dynamic(
  () => import('./MapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
);

export default function AddressSelectionModal({
  isOpen,
  onClose,
  currentAddress,
  onAddressSelect,
  userRole,
  isGuest = false
}: AddressSelectionModalProps) {
  const [address, setAddress] = useState<Address>(currentAddress || {
    city: '',
    kebele: '',
    wereda: '',
    houseNo: '',
    subCity: '',
    landmark: '',
    coordinates: undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [mapLink, setMapLink] = useState(currentAddress?.mapLink || '');
  const [coordinates, setCoordinates] = useState<{lat: number; lng: number} | null>(
    currentAddress?.coordinates || null
  );
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const addressData = {
        ...address,
        ...(userRole === 'owner' ? { mapLink } : {})
      };

      // If this is a guest user, just pass the address data without saving to database
      if (isGuest) {
        onAddressSelect(addressData);
        onClose();
        return;
      }

      // For authenticated users, save to database
      const supabase = createClientComponent();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      // Get current store_settings
      const { data: userData } = await supabase
        .from('users')
        .select('store_settings')
        .eq('id', session.user.id)
        .single();

      // Prepare new store_settings
      const newStoreSettings = {
        ...(userData?.store_settings || {}),
        ...(userRole === 'owner' 
          ? {
              // Preserve existing owner settings
              seo: userData?.store_settings?.seo || {},
              name: userData?.store_settings?.name || '',
              email: userData?.store_settings?.email || '',
              phone: userData?.store_settings?.phone || '',
            }
          : {
              // Preserve existing customer settings
              phone: userData?.store_settings?.phone || '',
              preferred_language: userData?.store_settings?.preferred_language || '',
            }
        ),
        // Update address
        address: addressData
      };

      // Update user's store_settings
      const { error } = await supabase
        .from('users')
        .update({
          store_settings: newStoreSettings
        })
        .eq('id', session.user.id);

      if (error) throw error;

      onAddressSelect(addressData);
      onClose();
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error('Failed to update address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    setCoordinates({ lat, lng });
    
    // Only run geocoding in browser
    if (typeof window === 'undefined') return;
    
    toast.loading('Getting address details...');
    
    const addressDetails = await reverseGeocode(lat, lng);
    
    if (addressDetails) {
      // Update form with retrieved address
      setAddress(prev => ({
        ...prev,
        coordinates: { lat, lng },
        city: addressDetails.city || prev.city,
        subCity: addressDetails.subCity || prev.subCity,
        wereda: addressDetails.wereda || prev.wereda,
        kebele: addressDetails.kebele || prev.kebele,
        houseNo: addressDetails.houseNo || prev.houseNo,
        landmark: addressDetails.landmark || prev.landmark
      }));
      
      // If it's a store owner, also update the map link
      if (userRole === 'owner') {
        const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
        setMapLink(googleMapsLink);
      }
      
      toast.dismiss();
      
      // Check if we got a fallback response (coordinates only)
      if (addressDetails.fullAddress.includes('Location at')) {
        toast.success('Location selected. Please fill in address details manually.');
      } else {
        toast.success('Address details updated');
      }
    } else {
      toast.dismiss();
      toast.error('Could not get address details. Please fill in manually.');
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    toast.loading('Getting your location...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        // Update map location
        handleLocationSelect(lat, lng);
        
        toast.dismiss();
      },
      (error) => {
        toast.dismiss();
        toast.error('Could not get your location. Please select on map.');
        console.error('Geolocation error:', error);
      }
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl p-6 my-8 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-6">
            Delivery Address
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sub City
                </label>
                <input
                  type="text"
                  value={address.subCity}
                  onChange={(e) => setAddress(prev => ({ ...prev, subCity: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Wereda
                </label>
                <input
                  type="text"
                  value={address.wereda}
                  onChange={(e) => setAddress(prev => ({ ...prev, wereda: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kebele
                </label>
                <input
                  type="text"
                  value={address.kebele}
                  onChange={(e) => setAddress(prev => ({ ...prev, kebele: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  House No.
                </label>
                <input
                  type="text"
                  value={address.houseNo}
                  onChange={(e) => setAddress(prev => ({ ...prev, houseNo: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={address.landmark}
                  onChange={(e) => setAddress(prev => ({ ...prev, landmark: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-green-500 focus:ring-green-500
                    ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                  disabled={isAddressLoading}
                  placeholder="e.g., near Bole Medhanialem Church"
                />
              </div>

              {userRole === 'owner' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Google Maps Link
                  </label>
                  <input
                    type="url"
                    value={mapLink}
                    onChange={(e) => setMapLink(e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                      focus:border-green-500 focus:ring-green-500
                      ${isAddressLoading ? 'animate-pulse bg-gray-100' : ''}`}
                    disabled={isAddressLoading}
                    placeholder="https://www.google.com/maps/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Share your store location on Google Maps
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  Pin Location on Map
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  Use My Location
                </button>
              </div>
              <div className="h-[300px] w-full rounded-lg overflow-hidden border border-gray-200">
                <MapComponent
                  onLocationSelect={handleLocationSelect}
                  initialLocation={coordinates || undefined}
                />
              </div>
              <p className="text-xs text-gray-500">
                Click on the map or drag the marker to set your exact location
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 