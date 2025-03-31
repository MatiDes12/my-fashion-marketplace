'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMapType, Marker, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { setupLeafletMarker } from '@/utils/map';

interface LeafletMapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  initialLocation?: {
    lat: number;
    lng: number;
  };
  readOnly?: boolean;
}

export default function LeafletMap({ 
  onLocationSelect, 
  initialLocation,
  readOnly = false 
}: LeafletMapProps) {
  const mapRef = useRef<LeafletMapType | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const mapContainerId = useRef(`map-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      setupLeafletMarker();

      const defaultLocation: LatLngExpression = [
        initialLocation?.lat || 9.0222,
        initialLocation?.lng || 38.7468
      ];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      mapRef.current = L.map(mapContainerId.current, {
        dragging: !readOnly,
        touchZoom: !readOnly,
        scrollWheelZoom: !readOnly,
        zoomControl: !readOnly
      }).setView(defaultLocation, 15);

      L.tileLayer('https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + 
        process.env.NEXT_PUBLIC_JAWG_ACCESS_TOKEN, {
        attribution: '<a href="https://www.jawg.io" target="_blank">&copy; Jawg</a> - ' +
          '<a href="https://www.openstreetmap.org" target="_blank">&copy; OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 22
      }).addTo(mapRef.current);

      markerRef.current = L.marker(defaultLocation, {
        draggable: !readOnly
      }).addTo(mapRef.current);

      if (!readOnly) {
        markerRef.current.on('dragend', (e) => {
          const position = e.target.getLatLng();
          onLocationSelect?.(position.lat, position.lng);
        });

        mapRef.current.on('click', (e) => {
          const { lat, lng } = e.latlng;
          markerRef.current?.setLatLng([lat, lng]);
          onLocationSelect?.(lat, lng);
        });
      }
    };

    initMap().catch(console.error);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialLocation, onLocationSelect, readOnly]);

  return (
    <div 
      id={mapContainerId.current} 
      className="h-full w-full relative" 
      style={{ minHeight: '300px' }}
    />
  );
}