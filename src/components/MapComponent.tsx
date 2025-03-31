'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

interface MapComponentProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  initialLocation?: {
    lat: number;
    lng: number;
  };
}

// Create a dynamic import for Leaflet components with no SSR
const LeafletMap = dynamic(
  () => import('./LeafletMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
);

export default function MapComponent(props: MapComponentProps) {
  return (
    <div className="h-[300px] relative rounded-lg overflow-hidden">
      <LeafletMap {...props} />
    </div>
  );
} 