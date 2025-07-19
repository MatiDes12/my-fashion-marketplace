'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinIcon, TruckIcon, HomeIcon, UserIcon, ClockIcon } from '@heroicons/react/24/outline';

interface DeliveryMapProps {
  storeLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  deliveryLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  className?: string;
  deliveryStatus?: string;
  deliveryPerson?: {
    name?: string;
    phone?: string;
  };
  estimatedDeliveryTime?: string;
}

// Helper function to format address from the complex structure
const formatAddress = (address: any): string => {
  if (!address) return 'Address not available';
  
  try {
    // Handle the numbered array format from store_settings
    if (typeof address === 'object' && Object.keys(address).some(key => !isNaN(Number(key)))) {
      const streetAddressParts = [];
      let i = 0;
      while (address[i] !== undefined) {
        streetAddressParts.push(address[i]);
        i++;
      }
      const streetAddress = streetAddressParts.join('');
      
      const addressParts = [
        streetAddress,
        address.city,
        address.subCity,
        address.wereda && `Wereda ${address.wereda}`,
        address.kebele && `Kebele ${address.kebele}`,
        address.houseNo && `House No: ${address.houseNo}`,
        address.landmark && `Near ${address.landmark}`
      ].filter(Boolean);
      
      return addressParts.join(', ');
    }
    
    // Handle regular address object
    if (typeof address === 'object') {
      const parts = [
        address.street,
        address.streetAddress,
        address.city,
        address.subCity,
        address.wereda && `Wereda ${address.wereda}`,
        address.kebele && `Kebele ${address.kebele}`,
        address.houseNo && `House No: ${address.houseNo}`,
        address.landmark && `Near ${address.landmark}`
      ].filter(Boolean);
      
      return parts.join(', ');
    }
    
    return String(address);
  } catch (error) {
    console.error('Error formatting address:', error);
    return 'Address not available';
  }
};

export default function DeliveryMap({
  storeLocation,
  deliveryLocation,
  currentLocation,
  className = '',
  deliveryStatus,
  deliveryPerson,
  estimatedDeliveryTime
}: DeliveryMapProps) {
  const [isMapAvailable, setIsMapAvailable] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we have any location data
    const hasLocationData = storeLocation || deliveryLocation || currentLocation;
    
    if (!hasLocationData) {
      setIsMapAvailable(false);
      return;
    }

    // For now, show a placeholder since we need to integrate with a mapping service
    // In the future, this could integrate with Google Maps, Mapbox, or Leaflet
    setIsMapAvailable(false);
  }, [storeLocation, deliveryLocation, currentLocation]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500';
      case 'in_transit':
      case 'out_for_delivery':
        return 'bg-blue-500';
      case 'shipped':
        return 'bg-yellow-500';
      case 'confirmed':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'delivered':
        return 'Delivered';
      case 'in_transit':
        return 'In Transit';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'shipped':
        return 'Shipped';
      case 'confirmed':
        return 'Confirmed';
      default:
        return 'Pending';
    }
  };

  if (!isMapAvailable) {
    return (
      <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border border-blue-100 ${className}`}>
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MapPinIcon className="h-8 w-8 text-white" />
            </div>
            {deliveryStatus && (
              <div className={`absolute -top-2 -right-2 w-6 h-6 ${getStatusColor(deliveryStatus)} rounded-full flex items-center justify-center shadow-lg`}>
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Delivery Tracking</h3>
          <p className="text-sm text-gray-600">
            Real-time location tracking coming soon
          </p>
        </div>
        
        {/* Delivery Status */}
        {deliveryStatus && (
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <div className={`w-3 h-3 ${getStatusColor(deliveryStatus)} rounded-full animate-pulse`}></div>
              <span className="text-sm font-medium text-gray-700">
                {getStatusText(deliveryStatus)}
              </span>
            </div>
            {estimatedDeliveryTime && (
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <ClockIcon className="h-4 w-4" />
                <span>Estimated: {estimatedDeliveryTime}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Delivery Person Info */}
        {deliveryPerson?.name && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">{deliveryPerson.name}</h4>
                <p className="text-xs text-gray-500">Your delivery person</p>
                {deliveryPerson.phone && (
                  <p className="text-xs text-blue-600">{deliveryPerson.phone}</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Location Cards */}
        <div className="space-y-4">
          {storeLocation && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <TruckIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Store Location</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {formatAddress(storeLocation.address)}
                  </p>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {storeLocation.latitude === 0 && storeLocation.longitude === 0 
                        ? 'Coordinates not available'
                        : `${storeLocation.latitude.toFixed(6)}, ${storeLocation.longitude.toFixed(6)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {deliveryLocation && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Delivery Address</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {formatAddress(deliveryLocation.address)}
                  </p>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {deliveryLocation.latitude === 0 && deliveryLocation.longitude === 0 
                        ? 'Coordinates not available'
                        : `${deliveryLocation.latitude.toFixed(6)}, ${deliveryLocation.longitude.toFixed(6)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentLocation && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Current Location</h4>
                  <p className="text-xs text-blue-700">
                    {currentLocation.latitude === 0 && currentLocation.longitude === 0 
                      ? 'Location not available'
                      : `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                    }
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Live tracking active</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Map Integration Notice */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPinIcon className="h-6 w-6 text-white" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">Interactive Map Coming Soon</h4>
            <p className="text-xs text-gray-600">
              Real-time delivery progress with live location updates
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef}
      className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-100 ${className}`}
      style={{ height: '400px' }}
    >
      {/* Map will be rendered here when integration is complete */}
    </div>
  );
} 