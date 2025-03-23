'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { cleanImageUrl } from '@/utils/url';
import { getFlashSalePrices } from '@/utils/flashSales';
import ProductRating from '@/components/ProductRating';
import SimilarProducts from '@/components/SimilarProducts';

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  owner_full_name: string;
  owner_email: string;
  details?: string;
  product_images: Array<{
    id: string;
    image_url: string;
    is_model_picture: boolean;
  }>;
  like_count: number;
  store_settings?: {
    name?: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    email?: string;
    phone?: string;
    address?: string;
    payment_methods?: {
      cash: boolean;
      [key: string]: boolean;
    };
    delivery_options?: {
      pickup: boolean;
      [key: string]: boolean;
    };
    workingHours?: {
      [key: string]: {
        isOpen: boolean;
        open: string;
        close: string;
      };
    };
    features?: {
      enableChat: boolean;
    };
  };
  delivery_fee: number | null;
  original_price: number | null;
  flash_sale_price?: number;
  users?: {
    id: string;
    full_name: string;
    email: string;
    store_settings?: {
      name?: string;
      description?: string;
      logo_url?: string;
      banner_url?: string;
      email?: string;
      phone?: string;
      address?: string;
      payment_methods?: {
        cash: boolean;
        [key: string]: boolean;
      };
      delivery_options?: {
        pickup: boolean;
        [key: string]: boolean;
      };
    };
  };
  ratings?: Array<{
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    updated_at: string;
    user: {
      id: string;
      full_name: string;
    };
  }>;
  average_rating?: number;
  total_ratings?: number;
  user_rating?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
  reviews?: Array<Review>;
  comments?: Array<{
    id: string;
    comment_text: string;
    created_at: string;
    rating?: number;
    users?: {
      id: string;
      full_name: string;
    };
  }>;
};

type StoreSettings = {
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  email: string;
  phone: string;
  address: string;
  payment_methods: {
    cash: boolean;
    [key: string]: boolean;
  };
  delivery_options: {
    pickup: boolean;
    [key: string]: boolean;
  };
  workingHours?: {
    [key: string]: {
      isOpen: boolean;
      open: string;
      close: string;
    };
  };
  features?: {
    enableChat: boolean;
  };
};

// Add this interface for reviews
interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
  };
}

// Update the ContactSection component
const ContactSection = ({ seller }: { seller: any }) => {
  const [showPhone, setShowPhone] = useState(false);
  const storeSettings = seller?.store_settings || {};
  const phone = storeSettings?.phone;
  const alternativePhone = storeSettings?.alternativePhone;
  
  // Format the date properly using the user's created_at
  const memberSince = seller?.created_at 
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(seller.created_at))
    : 'Unknown date';

  console.log('Store Settings:', storeSettings); // For debugging
  console.log('Phone:', phone); // For debugging
  console.log('Created at:', seller?.created_at); // For debugging

  // Get current day and time
  const today = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();
  const currentHours = storeSettings?.workingHours?.[today];
  const isOpen = currentHours?.isOpen;
  
  return (
    <div className="mt-8 mb-8 bg-white rounded-lg border border-gray-200 p-6">
      {/* Seller Info */}
      <div className="flex items-center mb-4">
        {storeSettings.logo_url && (
          <div className="mr-4">
            <Image
              src={storeSettings.logo_url}
              alt={storeSettings.name || 'Store logo'}
              width={64}
              height={64}
              className="rounded-full"
            />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {storeSettings.name || seller?.full_name}
          </h3>
          <p className="text-sm text-gray-500">
            {isOpen ? (
              <span className="text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                Open now
              </span>
            ) : (
              <span className="text-red-600 flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                Closed
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500">Member since {memberSince}</p>
          {showPhone && (phone || alternativePhone) && (
            <p className="mt-2 text-green-600 font-medium">
              📞 {phone || alternativePhone}
              {alternativePhone && phone && phone !== alternativePhone && (
                <span className="ml-2 text-gray-500">
                  Alt: {alternativePhone}
                </span>
              )}
            </p>
          )}
          {storeSettings.address && (
            <p className="mt-1 text-sm text-gray-500">
              📍 {storeSettings.address.city}, {storeSettings.address.subCity}
            </p>
          )}
        </div>
      </div>

      {/* Contact Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowPhone(true)}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          {showPhone ? 'Phone Number Shown' : 'Show Contact'}
        </button>
        {storeSettings.features?.enableChat && (
          <button
            onClick={() => {
              toast.success('Opening chat...'); // Changed from toast.info since it was causing an error
            }}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Start Chat
          </button>
        )}
      </div>

      {/* Working Hours */}
      {storeSettings.workingHours && (
        <div className="mb-6 text-sm text-gray-600">
          <h4 className="font-medium mb-2">Working Hours</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(storeSettings.workingHours).map(([day, hours]: [string, any]) => (
              hours.isOpen && (
                <div key={day} className="flex justify-between">
                  <span className="capitalize">{day}</span>
                  <span>{hours.open} - {hours.close}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Safety Tips */}
      <div className="bg-yellow-50 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">In-Person Shopping Tips</h4>
        <ul className="text-sm text-yellow-700 space-y-2">
          <li className="flex items-center">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Meet in a public location during daylight hours
          </li>
          <li className="flex items-center">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Meet with the seller at a safe public place
          </li>
          <li className="flex items-center">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Examine the item thoroughly before payment
          </li>
          <li className="flex items-center">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Keep communication within the platform
          </li>
          <li className="flex items-center">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Only pay if you're satisfied
          </li>
        </ul>
      </div>
    </div>
  );
};

export default function ProductDetailPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();
  const productId = params?.id as string;
  const actionParam = searchParams?.get('action');
  
    const fetchProduct = async () => {
      try {
        setLoading(true);
      
      // First get the current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch product with all related data including store settings
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          owner:users!products_owner_id_fkey (
            id,
            full_name,
            email,
            created_at,
            store_settings
          ),
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          likes:likes (count),
          ratings!left (
            id,
            rating,
            comment,
            created_at,
            updated_at,
            users!ratings_user_id_fkey (
              id,
              full_name
            )
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      // Get flash sale price if available
      const flashSalePrices = await getFlashSalePrices([productId]);
      
      // Update the average rating calculation
      const ratings = product.ratings || [];
      const totalRatings = ratings.length;

      // Calculate average rating with proper types
      const averageRating = totalRatings > 0
        ? ratings.reduce((sum: number, curr: { rating: number }) => sum + (curr.rating || 0), 0) / totalRatings
        : 0;

      // Get user's rating if they're logged in
      let userRating = null;
      if (session?.user) {
        const { data: userRatingData } = await supabase
          .from('ratings')
          .select('*')
          .eq('product_id', productId)
          .eq('user_id', session.user.id)
          .single();
        
        userRating = userRatingData;
      }

      // Process the store settings
      const processedProduct = {
        ...product,
        flash_sale_price: flashSalePrices[productId],
        like_count: product.likes?.[0]?.count || 0,
        users: {
          ...product.owner,
          store_settings: typeof product.owner.store_settings === 'string' 
            ? JSON.parse(product.owner.store_settings)
            : product.owner.store_settings
        },
        product_images: product.product_images?.map((img: { image_url: string }) => ({
          ...img,
          image_url: img.image_url
        })),
        average_rating: Number(averageRating.toFixed(1)),
        total_ratings: totalRatings,
        user_rating: userRating,
        reviews: ratings
          .filter((r: any) => r.comment)
          .map((r: any) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user: r.users
          }))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      };

      setProduct(processedProduct);
      setAvailableQuantity(product.quantity);

      // Check if the current user has liked this product
      if (session?.user) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('product_id', productId)
          .single();

        setIsLiked(!!userLikes);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
    
    // If action is 'buy', scroll to the buy section
    if (actionParam === 'buy') {
      setTimeout(() => {
        document.getElementById('buy-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [productId, actionParam]);
  
  const handleQuantityChange = (value: number) => {
    if (value >= 1 && value <= availableQuantity) {
      setQuantity(value);
    }
  };
  
  const handleLike = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error('Please sign in to like products');
      router.push('/login');
      return;
    }
    
    setIsLikeLoading(true);
    
    try {
      if (isLiked) {
        // Unlike the product
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', session.user.id)
          .eq('product_id', productId);
          
        setIsLiked(false);
        setProduct(prev => {
          if (!prev) return null;
          return {
          ...prev,
            like_count: Math.max(0, prev.like_count - 1)
          };
        });
        
        toast.success('Removed from favorites');
      } else {
        // Like the product
        await supabase
          .from('likes')
          .insert({
            user_id: session.user.id,
            product_id: productId
          });
          
        setIsLiked(true);
        setProduct(prev => {
          if (!prev) return null;
          return {
          ...prev,
            like_count: prev.like_count + 1
          };
        });
        
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update favorites');
    } finally {
      setIsLikeLoading(false);
    }
  };
  
  const addToCart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to add items to cart');
        router.push('/login');
        return;
      }

    if (!product) {
      toast.error('Product not found');
      return;
    }
      
      setIsAddingToCart(true);
      
    try {
      // Check if item already exists in cart
      const { data: existingCartItem, error: cartError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('product_id', productId)
        .single();
      
      if (cartError && cartError.code !== 'PGRST116') {
        throw cartError;
      }
      
      if (existingCartItem) {
        // Update quantity of existing item
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ 
            quantity: existingCartItem.quantity + quantity,
            price: product.flash_sale_price || product.price, // Use flash sale price if available
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCartItem.id);
        
        if (updateError) throw updateError;
      } else {
        // Add new item to cart
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            user_id: session.user.id,
            product_id: productId,
            quantity: quantity,
            price: product.flash_sale_price || product.price, // Use flash sale price if available
            delivery_fee: product.delivery_fee || 0
          });
        
        if (insertError) throw insertError;
      }
      
      toast.success('Added to cart');
      router.push('/cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };
  
  const buyNow = async () => {
    try {
      setIsBuying(true);
      await addToCart();
      router.push('/checkout');
    } catch (error) {
      console.error('Error during buy now process:', error);
      toast.error('Failed to process purchase');
    } finally {
      setIsBuying(false);
    }
  };
  
  // Add this function to save recently viewed products
  const saveRecentlyViewed = (product: Product) => {
    if (typeof window === 'undefined') return;

    const recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    
    // Remove if product already exists
    const filtered = recentlyViewed.filter((p: any) => p.id !== product.id);
    
    // Add to end of array with current timestamp
    filtered.push({
      id: product.id,
      title: product.title,
      image: product.product_images[0]?.image_url,
      price: product.price,
      timeViewed: Date.now()
    });

    // Keep only last 5 products
    while (filtered.length > 5) {
      filtered.shift();
    }

    localStorage.setItem('recentlyViewed', JSON.stringify(filtered));
  };

  // Call this function when the product page loads
  useEffect(() => {
    if (product) {
      saveRecentlyViewed(product);
    }
  }, [product]);
  
  useEffect(() => {
    if (product) {
      const productView = {
        id: product.id,
        title: product.title,
        image: product.product_images[0]?.image_url,
        price: product.price
      };

      // Only store if user is logged in
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          localStorage.setItem('lastViewedProduct', JSON.stringify(productView));
        }
      });
    }
  }, [product]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage message={error} />
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">Product not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => router.push('/products')}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }
  
  // Update the store settings access
  const storeSettings = product?.store_settings || {
    name: 'Store',
    description: 'No description available',
    logo_url: '',
    banner_url: '',
    email: '',
    phone: '',
    address: '',
    payment_methods: { cash: true },
    delivery_options: { pickup: true }
  };
  
  console.log('Store settings being used:', storeSettings);
  console.log('Final store settings:', storeSettings);
  
  return (
    <div className="bg-gray-50 mt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="flex mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-gray-500"
              >
                Home
              </button>
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <button 
                onClick={() => router.push('/products')}
                className="ml-2 text-gray-400 hover:text-gray-500"
              >
                Products
              </button>
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 text-gray-500 truncate max-w-xs">{product.title}</span>
            </li>
          </ol>
        </nav>
        
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
          {/* Image gallery */}
          <div className="flex flex-col">
            <div className="w-full">
              {/* Main image */}
              <div className="relative h-96 w-full overflow-hidden rounded-lg">
                <Image
                  src={product.product_images[selectedImage]?.image_url || '/placeholder.png'}
                  alt={product.title}
                  fill
                  className="object-cover"
                  priority
                />
                </div>
            </div>
            
            {/* Image selector */}
            {product.product_images?.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {product.product_images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`relative h-24 overflow-hidden rounded-md ${
                      selectedImage === index 
                        ? 'ring-2 ring-red-500' 
                        : 'ring-1 ring-gray-200'
                    }`}
                  >
                    <Image
                      src={image.image_url}
                      alt={`View ${index + 1} of ${product.title}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Product info */}
          <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{product.title}</h1>
              <button
                onClick={handleLike}
                disabled={isLikeLoading}
                className={`p-2 rounded-full ${
                  isLiked 
                    ? 'bg-red-50 text-red-500' 
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                } transition-colors`}
              >
                {isLikeLoading ? (
                  <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6" 
                    viewBox="0 0 20 20" 
                    fill={isLiked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="mt-4">
              {product.flash_sale_price ? (
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-red-600">
                    ${product.flash_sale_price.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-red-600 font-medium">
                    {Math.round(((product.price - product.flash_sale_price) / product.price) * 100)}% OFF
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
            
            <div className="mt-3 flex items-center">
              <div>
                {product.delivery_fee ? (
                  <p className="mt-1 text-sm text-gray-500">
                    +${product.delivery_fee} delivery fee
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-green-500">Free delivery</p>
                )}
              </div>
              {product.original_price && product.original_price > product.price && (
                <p className="ml-3 text-lg text-gray-500 line-through">
                  ${product.original_price}
                </p>
              )}
            </div>
            
            <div className="mt-4">
              <div className="flex items-center">
                <div className="flex items-center text-sm text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  {product.like_count} {product.like_count === 1 ? 'person' : 'people'} liked this
                </div>
                <span className="mx-2 text-gray-300">|</span>
                <div className="text-sm text-gray-500">
                  <h3 className="text-sm text-gray-500">Brand</h3>
                  <div className="flex items-center mt-1">
                    {product.users?.store_settings?.logo_url && (
                      <Image
                        src={cleanImageUrl(product.users.store_settings.logo_url)}
                        alt={`${product.users.store_settings.name || 'Store'} logo`}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {product.users?.store_settings?.name || 'Store'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h2 className="text-lg font-medium text-gray-900">Description</h2>
              <div className="mt-2 prose prose-sm text-gray-500">
                <p>{product.description}</p>
              </div>
            </div>
            
            {/* Product details section */}
            {product.details && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900">Details</h2>
                <div className="mt-2 prose prose-sm text-gray-500">
                  <p>{product.details}</p>
                </div>
              </div>
            )}
            
            {/* Add this section to show available quantity */}
            <div className="mt-4">
              <p className={`text-sm ${
                availableQuantity > 10 
                  ? 'text-green-600' 
                  : availableQuantity > 0 
                    ? 'text-orange-600' 
                    : 'text-red-600'
              }`}>
                {availableQuantity > 0 
                  ? `${availableQuantity} items available` 
                  : 'Out of stock'}
              </p>
            </div>
            
            {/* Update the quantity selector */}
            <div id="buy-section" className="mt-8 border-t border-gray-200 pt-8">
              <div className="flex items-center">
                <h2 className="text-lg font-medium text-gray-900">Quantity</h2>
                <div className="ml-auto flex items-center">
                  <div className="flex items-center border border-gray-300 rounded-md">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    -
                  </button>
                    <input
                      type="number"
                      min="1"
                      max={availableQuantity}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="w-16 text-center border-0 focus:ring-0"
                    />
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= availableQuantity}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    +
                  </button>
                  </div>
                  {quantity === availableQuantity && (
                    <span className="ml-2 text-sm text-orange-600">
                      Max quantity reached
                    </span>
                  )}
                </div>
                </div>
              </div>
              
            {/* Update the buy/cart buttons */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <button
                  onClick={addToCart}
                disabled={isAddingToCart || availableQuantity === 0}
                className={`flex-1 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                  (isAddingToCart || availableQuantity === 0) && 'opacity-50 cursor-not-allowed'
                }`}
                >
                  {isAddingToCart ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : availableQuantity === 0 ? (
                  'Out of Stock'
                ) : (
                  'Add to Cart'
                )}
                </button>

                <button
                  onClick={buyNow}
                disabled={isBuying || availableQuantity === 0}
                className={`flex-1 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                  (isBuying || availableQuantity === 0) && 'opacity-50 cursor-not-allowed'
                }`}
                >
                  {isBuying ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : availableQuantity === 0 ? (
                  'Out of Stock'
                ) : (
                  'Buy Now'
                )}
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Secure payment
                </p>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Add ContactSection here, before the Customer Reviews */}
            <ContactSection seller={product.users} />
            
            {/* Customer Reviews Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Customer Reviews</h3>
                  <div className="mt-2 flex items-center">
                    <ProductRating
                      productId={product.id}
                      initialRating={product.average_rating}
                      readonly={true}
                    />
                    <span className="ml-2 text-sm text-gray-500">
                      Based on {product.total_ratings} reviews
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Form */}
              <div id="rating-section" className="mb-8">
                <ReviewForm
                  productId={product.id}
                  initialRating={product.user_rating?.rating}
                  initialComment={product.user_rating?.comment}
                  onSubmit={fetchProduct}
                />
              </div>

              {/* Reviews List */}
              {(product.reviews || []).length > 0 ? (
                <ReviewsList reviews={product.reviews || []} />
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No reviews yet. Be the first to review this product!
                </p>
              )}
            </div>
          </div>

          {/* Similar Products */}
          <div className="lg:col-span-1">
            <SimilarProducts 
              currentProductId={product.id}
              category={product.category}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Add this component for the review form
const ReviewForm = ({ productId, initialRating, initialComment, onSubmit }: {
  productId: string;
  initialRating?: number;
  initialComment?: string;
  onSubmit: () => void;
}) => {
  const [rating, setRating] = useState(initialRating || 0);
  const [comment, setComment] = useState(initialComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please login to submit a review');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: session.user.id,
          product_id: productId,
          rating,
          comment: comment.trim() || null
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) throw error;
      
      toast.success('Review submitted successfully');
      onSubmit();
      setComment('');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Your Rating</label>
        <div className="mt-1">
          <ProductRating
            productId={productId}
            initialRating={rating}
            onRatingSubmit={(newRating) => setRating(newRating)}
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Your Review</label>
        <div className="mt-1">
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            placeholder="Share your experience with this product..."
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || rating === 0}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
          isSubmitting || rating === 0 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
};

// Add this component for displaying reviews
const ReviewsList = ({ reviews }: { reviews: Review[] }) => {
  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white">
                  {review.user.full_name[0]}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{review.user.full_name}</p>
                <div className="flex items-center">
                  <ProductRating
                    productId={review.id}
                    initialRating={review.rating}
                    readonly={true}
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
          {review.comment && (
            <div className="mt-4 text-sm text-gray-600">
              {review.comment}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}; 