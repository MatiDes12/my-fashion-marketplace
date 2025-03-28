/**
 * Cleans and formats image URLs from Supabase storage
 * @param url The raw image URL from Supabase
 * @returns The cleaned and properly formatted URL
 */
export const cleanImageUrl = (url: string): string => {
  if (!url) return '/placeholder.png';
  
  // If it's already a full URL, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a Supabase storage URL that's already complete
  if (url.includes('/storage/v1/object/public/')) {
    // Remove any duplicate URLs
    const storagePathIndex = url.indexOf('/storage/v1/object/public/');
    const cleanUrl = url.substring(storagePathIndex);
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}${cleanUrl}`;
  }
  
  // If it's just a filename
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${url}`;
};

export const normalizeUrl = (baseUrl: string, path: string) => {
  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  // Remove leading slash from path
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBaseUrl}/${cleanPath}`;
};

export const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not set');
  }
  return appUrl;
}; 