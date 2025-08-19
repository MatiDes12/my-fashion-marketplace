'use client';

// Remove direct import of Leaflet
// import L from 'leaflet';

const isClient = typeof window !== 'undefined';

export function setupLeafletMarker() {
  if (!isClient) return;
  
  // Import Leaflet dynamically only on client side
  const L = require('leaflet');
  
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
  });
}

export async function reverseGeocode(lat: number, lng: number) {
  if (!isClient) return null;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'YourAppName/1.0' // Replace with your app name
        }
      }
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    return {
      city: data.address.city || data.address.town || data.address.county || '',
      subCity: data.address.suburb || data.address.neighbourhood || '',
      wereda: data.address.quarter || data.address.suburb || '',
      kebele: data.address.neighbourhood || '',
      houseNo: data.address.house_number || '',
      landmark: data.address.amenity || data.address.building || '',
      fullAddress: data.display_name
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    
    // Return a fallback response with coordinates if geocoding fails
    return {
      city: 'Addis Ababa',
      subCity: '',
      wereda: '',
      kebele: '',
      houseNo: '',
      landmark: '',
      fullAddress: `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    };
  }
} 