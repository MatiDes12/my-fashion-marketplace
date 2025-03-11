import { createClientComponent } from '@/lib/supabase';

/**
 * Get a public URL for a Supabase storage path
 */
export const getPublicImageUrl = (path: string): string => {
  console.log('Getting public URL for path:', path);
  
  if (!path) {
    console.log('Path is empty, returning placeholder');
    return '/images/product-placeholder.jpg';
  }
  
  // If it's already a full URL, return it
  if (path.startsWith('http')) {
    console.log('Path is already a URL, returning as is');
    return path;
  }
  
  try {
    // Determine which bucket to use based on the path
    const supabase = createClientComponent();
    let bucket = 'products';
    
    // If path contains 'stores/', use the stores bucket
    if (path.includes('stores/') || path.includes('store-')) {
      bucket = 'stores';
    }
    
    console.log(`Using bucket: ${bucket} for path: ${path}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    console.log('Generated public URL:', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.error('Error generating public URL:', error);
    return '/images/product-placeholder.jpg';
  }
};

/**
 * Get the main image URL for a product
 */
export const getProductMainImage = (product: any): string => {
  console.log('Getting main image for product:', product?.id, product?.title);
  
  if (!product) {
    console.error('Product is undefined or null');
    return '/images/product-placeholder.jpg';
  }
  
  try {
    // If product has images array
    if (product.images && product.images.length > 0) {
      console.log('Product has images array with', product.images.length, 'images');
      console.log('Images data:', JSON.stringify(product.images));
      
      // First try to get a model picture
      const modelPic = product.images.find((img: any) => img.is_model_picture);
      if (modelPic) {
        console.log('Found model picture:', modelPic.image_url);
        return getPublicImageUrl(modelPic.image_url);
      }
      
      // Otherwise return the first image
      console.log('No model picture, using first image:', product.images[0].image_url);
      return getPublicImageUrl(product.images[0].image_url);
    }
    
    // If product has a single image_url property
    if (product.image_url) {
      console.log('Product has single image_url:', product.image_url);
      return getPublicImageUrl(product.image_url);
    }
    
    console.log('No images found for product, returning placeholder');
    // Return a placeholder if no images
    return '/images/product-placeholder.jpg';
  } catch (error) {
    console.error('Error getting product image:', error);
    return '/images/product-placeholder.jpg';
  }
}; 