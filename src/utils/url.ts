/**
 * Cleans and formats image URLs from Supabase storage
 * @param url The raw image URL from Supabase
 * @returns The cleaned and properly formatted URL
 */
export const cleanImageUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's already a full URL, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a Supabase storage URL, add the base URL
  if (url.startsWith('/storage/v1/')) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}${url}`;
  }
  
  return url;
}; 