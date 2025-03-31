'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface StoreLocationMapProps {
  address: {
    [key: string]: string | null | { lat: number; lng: number; } | undefined;
    city?: string;
    kebele?: string;
    wereda?: string;
    houseNo?: string;
    subCity?: string;
    landmark?: string | null;
    mapLink: string | null;
    coordinates: {
      lat: number;
      lng: number;
    } | null;
  }
}

// Dynamic import of LeafletMap to avoid SSR issues
const LeafletMap = dynamic(
  () => import('./LeafletMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
);

export default function StoreLocationMap({ address }: StoreLocationMapProps) {
  // Reconstruct the full address string from numeric keys if they exist
  const getFullAddress = () => {
    if ('0' in address) {
      const addressChars = Object.keys(address)
        .filter(key => !isNaN(Number(key)))
        .sort((a, b) => Number(a) - Number(b))
        .map(key => address[key])
        .join('');
      
      return addressChars;
    }
    return null;
  };

  const fullAddress = getFullAddress();

  // Extract coordinates from Google Maps link if available
  const getCoordinatesFromMapLink = () => {
    if (address.mapLink) {
      const match = address.mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return {
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2])
        };
      }
    }
    return null;
  };

  const coordinates = address.coordinates || getCoordinatesFromMapLink();

  if (!coordinates && !address.mapLink) {
    return (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-sm text-gray-500">No location data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fullAddress && (
        <p className="text-sm text-gray-600">{fullAddress}</p>
      )}
      
      {coordinates && (
        <div className="h-48 rounded-lg overflow-hidden">
          <LeafletMap
            initialLocation={coordinates}
            readOnly={true}
          />
        </div>
      )}
      
      {address.mapLink && (
        <a
          href={address.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-green-600 hover:text-green-700"
        >
          <span>View on Google Maps</span>
          <ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
        </a>
      )}
    </div>
  );
} 