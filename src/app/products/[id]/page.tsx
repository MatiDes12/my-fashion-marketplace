'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { toast } from 'react-hot-toast';
import { cleanImageUrl } from '@/utils/url';
import { getFlashSalePrices } from '@/utils/flashSales';
import ProductRating from '@/components/ProductRating';
import Link from 'next/link';
import WishlistPopup from '@/components/WishlistPopup';

type ProductImage = {
  id: string;
  image_url: string;
  is_model_picture: boolean;
};

type Rating = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
  };
};

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
  product_images: ProductImage[];
  owner?: {
    id: string;
    full_name: string;
    email: string;
    verification_status?: string;
    store_settings?: string | {
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
    verification_status?: string;
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
  ratings?: Rating[];
  average_rating?: number;
  total_ratings?: number;
  user_rating?: Rating | null;
  reviews?: Rating[];
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
  detailed_description?: string;
  quality?: string;
  delivery_options: {
    delivery: boolean;
    pickup: boolean;
    pickup_location?: string;
    delivery_time?: string;
  };
  sizes: any[];
  colors: any[];
  available_variants: any[];
  brand: string;
  material: string;
  care_instructions: string;
  measurements: any;
  shipping_info: {
    return_policy: string;
    processing_time: string;
    shipping_options: any[];
  };
  highlights: string[];
  specifications: any;
  style_notes: string;
  fit_info: string;
  occasion: string[];
  season: string[];
  sustainability_info: string;
  country_of_origin: string;
  warranty_info: string;
  faqs: any[];
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

// First, add this type for the tabs
type TabType = 'details' | 'specifications' | 'features' | 'shipping' | 'reviews';

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
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {storeSettings.name || 'Store'}
            </h3>
            {seller?.verification_status === 'verified' && (
              <div className="relative group">
                <svg 
                  className="w-5 h-5 text-blue-500" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                  aria-label="Verified Seller"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Verified Seller
                </div>
              </div>
            )}
          </div>
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

// Update the DeliveryOptions component
const DeliveryOptions = ({ options, product }: { 
  options: Product['delivery_options'], 
  product: Product 
}) => {
  if (!options) return null;

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-lg font-medium text-gray-900">Delivery & Pickup Options</h3>
      <div className="mt-4 space-y-4">
        {/* Delivery Option */}
        {options.delivery && (
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-500">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Home Delivery Available</span>
            </div>
            {product.delivery_fee ? (
              <div className="ml-7 text-sm text-gray-500">
                Delivery Fee: ETB {product.delivery_fee.toFixed(2)}
              </div>
            ) : (
              <div className="ml-7 text-sm text-green-600">
                Free Delivery
              </div>
            )}
            {options.delivery_time && (
              <div className="ml-7 text-sm text-gray-500">
                Estimated Delivery: {options.delivery_time} business days
              </div>
            )}
          </div>
        )}

        {/* Pickup Option */}
        {options.pickup && (
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-500">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Store Pickup Available</span>
            </div>
            {options.pickup_location && (
              <div className="ml-7 text-sm text-gray-500">
                <div className="font-medium">Pickup Location:</div>
                <p className="whitespace-pre-line">{options.pickup_location}</p>
              </div>
            )}
          </div>
        )}

        {/* No Options Available */}
        {!options.delivery && !options.pickup && (
          <div className="flex items-center text-sm text-red-500">
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Contact seller for delivery options</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility function to format image URL
const formatImageUrl = (url: string) => {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${url}`;
};

// Image component with error handling
const SafeImage = ({ image, alt, className = '' }: { 
  image: ProductImage | string;
  alt: string;
  className?: string;
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = typeof image === 'string' ? image : image.image_url;
  const formattedUrl = imageError ? '/placeholder.png' : formatImageUrl(imageUrl);

  return (
    <div className={`relative ${className}`}>
      <Image
        src={formattedUrl}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
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
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedCustomOptions, setSelectedCustomOptions] = useState<{[key: string]: string}>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null); // Track user id for like check
  const [showWishlistPopup, setShowWishlistPopup] = useState(false);
  
  // Review pagination state
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const [reviewsPerPage] = useState(6);
  const [reviewSortBy, setReviewSortBy] = useState('recent');
  const [reviewFilter, setReviewFilter] = useState('all');
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentReviewPage(1);
  }, [reviewSortBy, reviewFilter]);
  
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();
  const productId = params?.id as string;
  const actionParam = searchParams?.get('action');
  
  // Fetch session user id on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUserId(session?.user?.id || null);
    });
  }, []);

  // Fetch product and like status
    const fetchProduct = async () => {
      try {
        setLoading(true);
      
      // First get the current user's session
      const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
      
      // Fetch product with all related data including ratings
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*),
          owner:users!products_owner_id_fkey (
            id,
            full_name,
            email,
            store_settings,
            verification_status
          ),
          ratings (
            id,
            rating,
            comment,
            created_at,
            user:users (
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
      
      // Calculate average rating and total ratings
      const ratings = product.ratings || [];
      const totalRatings = ratings.length;
      const averageRating = totalRatings > 0
        ? ratings.reduce((sum: number, curr: { rating?: number }) => sum + (curr.rating || 0), 0) / totalRatings
        : 0;

      // Get user's rating if logged in
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

      // Process the store settings and create the final product object
      const processedProduct = {
        ...product,
        flash_sale_price: flashSalePrices[productId],
        like_count: product.likes?.[0]?.count || 0,
        users: {
          id: product.owner?.id,
          full_name: product.owner?.full_name,
          email: product.owner?.email,
          verification_status: product.owner?.verification_status,
          store_settings: typeof product.owner?.store_settings === 'string' 
            ? JSON.parse(product.owner.store_settings)
            : product.owner?.store_settings || {}
        },
        product_images: product.product_images || [],
        average_rating: Number(averageRating.toFixed(1)),
        total_ratings: totalRatings,
        user_rating: userRating,
        reviews: ratings
          .filter((r: { comment?: string }) => r.comment) // Only include ratings with comments as reviews
          .map((r: { 
            id: string; 
            rating: number; 
            comment: string; 
            created_at: string;
            user: { id: string; full_name: string; }
          }) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user: r.user
          }))
          .sort((a: { created_at: string }, b: { created_at: string }) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
      };

      setProduct(processedProduct);
      setAvailableQuantity(product.quantity);

    // Check if user has liked this product
    if (userId) {
      const { data: likeData } = await supabase
          .from('likes')
          .select('id')
        .eq('user_id', userId)
          .eq('product_id', productId)
          .single();
      setIsLiked(!!likeData);
    } else {
      setIsLiked(false);
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
        // Unlike the product - only remove from likes table
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
        // Check if product is already in wishlist
        const { data: wishlistItem } = await supabase
          .from('wishlist')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('product_id', productId)
          .single();

        if (wishlistItem) {
          // Product is in wishlist, just add to likes
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
        } else {
          // Product not in wishlist, show popup
          setShowWishlistPopup(true);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update favorites');
    } finally {
      setIsLikeLoading(false);
    }
  };
  
  const handleOptionChange = (type: string, value: string) => {
    // Create updated state values for variant matching
    let updatedSize = selectedSize;
    let updatedColor = selectedColor;
    let updatedCustomOptions = { ...selectedCustomOptions };

    if (type === 'size') {
      setSelectedSize(value);
      updatedSize = value;
    } else if (type === 'color') {
      setSelectedColor(value);
      updatedColor = value;
    } else {
      setSelectedCustomOptions(prev => ({
        ...prev,
        [type]: value
      }));
      updatedCustomOptions[type] = value;
    }

    // Find matching variant using updated values
    if (product?.available_variants) {
      const variant = product.available_variants.find(v => {
        const sizeMatch = !v.size || v.size === updatedSize;
        const colorMatch = !v.color || v.color === updatedColor;
        const customMatch = Object.entries(updatedCustomOptions).every(([key, val]) => 
          !v[key.toLowerCase()] || v[key.toLowerCase()] === val
        );
        return sizeMatch && colorMatch && customMatch;
      });
      
      setSelectedVariant(variant);
      setError(null);
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
      
      // Clear previous validation errors
      setValidationError(null);

      // Check if product has variants and validate selections
      if (product.available_variants?.length > 0) {
        // Validate size selection
        if (product.sizes?.length > 0 && !selectedSize) {
          setValidationError('Please select a size');
          toast.error('Please select a size');
          document.querySelector('.size-selector')?.scrollIntoView({ behavior: 'smooth' });
          return;
        }
        
        // Validate color selection
        if (product.colors?.length > 0 && !selectedColor) {
          setValidationError('Please select a color');
          toast.error('Please select a color');
          document.querySelector('.color-selector')?.scrollIntoView({ behavior: 'smooth' });
          return;
      }
      
        // Validate custom variant selections
        const customVariantTypes = Object.keys(product.available_variants[0]).filter(
          key => !['size', 'color', 'quantity', 'sku'].includes(key)
        );

        for (const type of customVariantTypes) {
          if (!selectedCustomOptions[type]) {
            setValidationError(`Please select ${type}`);
            toast.error(`Please select ${type}`);
            document.querySelector(`.${type.toLowerCase()}-selector`)?.scrollIntoView({ behavior: 'smooth' });
            return;
          }
        }

        // Find matching variant
        const variant = product.available_variants.find(v => {
          const sizeMatch = !v.size || v.size === selectedSize;
          const colorMatch = !v.color || v.color === selectedColor;
          const customMatch = Object.entries(selectedCustomOptions).every(([key, val]) => 
            !v[key.toLowerCase()] || v[key.toLowerCase()] === val
          );
          return sizeMatch && colorMatch && customMatch;
        });

        if (!variant) {
          setValidationError('Selected combination is not available');
          toast.error('Selected combination is not available');
          return;
        }

        if (variant.quantity < quantity) {
          setValidationError(`Only ${variant.quantity} items available for this variant`);
          toast.error(`Only ${variant.quantity} items available for this variant`);
          return;
        }
      }
      
      setIsAddingToCart(true);
      
      try {
        // Create a variant SKU string that includes all variant information
        const variantSku = selectedVariant?.sku || [
          selectedSize,
          selectedColor,
          ...Object.entries(selectedCustomOptions).map(([key, value]) => `${key.toLowerCase()}-${value}`)
        ].filter(Boolean).join('_');

        // Check if this exact variant combination already exists in cart
        let existingItem = null;
        
        // For products with variants, check for exact match
        if (product.available_variants?.length > 0) {
          const { data } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', session.user.id)
            .eq('product_id', productId)
            .eq('selected_size', selectedSize || null)
            .eq('selected_color', selectedColor || null)
            .eq('selected_variant_sku', variantSku || null)
            .single();
          existingItem = data;
        } else {
          // For products without variants, check for any existing item of this product
          const { data } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', session.user.id)
            .eq('product_id', productId)
            .is('selected_size', null)
            .is('selected_color', null)
            .is('selected_variant_sku', null)
            .single();
          existingItem = data;
        }

        if (existingItem) {
          // Update quantity of existing item
          const newQuantity = existingItem.quantity + quantity;
          const { error: updateError } = await supabase
            .from('cart_items')
            .update({ 
              quantity: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingItem.id);
          
          if (updateError) throw updateError;
          toast.success(`Updated quantity in cart (${newQuantity} total)`);
        } else {
          // Create new cart item
          const cartItem = {
            user_id: session.user.id,
            product_id: productId,
            quantity: quantity,
            price: product.flash_sale_price || product.price,
            delivery_fee: product.delivery_fee || 0,
            selected_size: selectedSize || null,
            selected_color: selectedColor || null,
            selected_variant_sku: variantSku || null
          };

          const { error: insertError } = await supabase
            .from('cart_items')
            .insert(cartItem);
          
          if (insertError) throw insertError;
          toast.success('Added to cart');
        }
      
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
      await addToCart(); // This will now redirect to /cart instead of /checkout
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
      image_url: product.product_images[0]?.image_url,
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
  
  // Add this function near the top of your component
  const showFloatingPreview = (product: any) => {
    // Create custom event with product data
    const event = new CustomEvent('showProductPreview', {
      detail: {
        id: product.id,
        title: product.title,
        price: product.price,
        image_url: product.product_images?.[0]?.image_url || '/images/placeholder.png'
      }
    });
    window.dispatchEvent(event);
  };

  // Add this to your useEffect
  useEffect(() => {
    if (product) {
      showFloatingPreview(product);
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
      {/* Wishlist Popup */}
      {product && (
        <WishlistPopup
          isOpen={showWishlistPopup}
          onClose={() => setShowWishlistPopup(false)}
          productId={product.id}
          productTitle={product.title}
          onSuccess={() => {
            // Update the UI to reflect the like
            setIsLiked(true);
            setProduct(prev => {
              if (!prev) return null;
              return {
                ...prev,
                like_count: prev.like_count + 1
              };
            });
          }}
        />
      )}
      
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
        
        {/* Main product section */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start mb-12">
          {/* Left column - Image gallery */}
          <div className="flex flex-col">
            <div className="w-full">
              {/* Main image */}
              <div className="relative h-96 w-full overflow-hidden rounded-lg">
                <SafeImage
                  image={product.product_images[selectedImage]}
                  alt={product.title}
                  className="w-full h-full"
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
                    <SafeImage
                      image={image}
                      alt={`View ${index + 1} of ${product.title}`}
                      className="w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Right column - Product info */}
          <div className="mt-10 px-4 sm:px-0 lg:mt-0">
            {/* Title and like button */}
            <div className="flex items-center justify-between mb-4">
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
            
            {/* Price section */}
            <div className="mb-6">
              {product.flash_sale_price ? (
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-red-600">
                    ETB {product.flash_sale_price.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    ETB {product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-red-600 font-medium">
                    {Math.round(((product.price - product.flash_sale_price) / product.price) * 100)}% OFF
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  ETB {product.price.toFixed(2)}
                </span>
              )}
            </div>
            
            {/* Product info and Seller info section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column - Seller Info */}
              <div>
                <div className="text-sm text-gray-500">
                  <h3 className="text-sm text-gray-500">Seller</h3>
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
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium text-gray-900">
                        {product.users?.store_settings?.name || 'Store'}
                      </span>
                      {product.users?.verification_status === 'verified' && (
                        <div className="relative group">
                          <svg 
                            className="w-4 h-4 text-blue-500" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path 
                              fillRule="evenodd" 
                              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                            />
                          </svg>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
            
              {/* Right column - Brief Description */}
                <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">About this item</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {product.description}
                  </p>
              </div>
                </div>
                
            {/* Grid container for Delivery & Size/Color options */}
            <div className="grid grid-cols-2 gap-x-6 mt-6">
              {/* Left column - Size/Color Selection */}
                  <div>
                {product.available_variants && product.available_variants.length > 0 && (
                  <div>
                    {/* Size Selector */}
                    {product.sizes && product.sizes.length > 0 && (
                      <div className="mb-4 size-selector">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900">Select Size</h3>
                          {validationError && !selectedSize && (
                            <span className="text-sm text-red-600">* Required</span>
                          )}
                  </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {product.sizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => handleOptionChange('size', size)}
                              className={`px-4 py-2 text-sm font-medium rounded-md ${
                                selectedSize === size
                                  ? 'bg-gray-900 text-white'
                                  : validationError && !selectedSize
                                  ? 'bg-white border border-red-300 text-gray-900 hover:bg-gray-50'
                                  : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                  </div>
                  </div>
            )}
            
                    {/* Color Selector */}
                    {product.colors && product.colors.length > 0 && (
                      <div className="mb-4 color-selector">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900">Select Color</h3>
                          {validationError && !selectedColor && (
                            <span className="text-sm text-red-600">* Required</span>
                          )}
                </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {product.colors.map((color) => (
                            <button
                              key={color}
                              onClick={() => handleOptionChange('color', color)}
                              className={`px-4 py-2 text-sm font-medium rounded-md ${
                                selectedColor === color
                                  ? 'bg-gray-900 text-white'
                                  : validationError && !selectedColor
                                  ? 'bg-white border border-red-300 text-gray-900 hover:bg-gray-50'
                                  : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Variant Selectors */}
                    {Object.keys(product.available_variants[0]).map(key => {
                      if (['size', 'color', 'quantity', 'sku'].includes(key)) return null;
                      
                      const options = Array.from(new Set(product.available_variants.map(v => v[key])));
                      if (!options.length) return null;

                      return (
                        <div key={key} className={`mb-4 ${key.toLowerCase()}-selector`}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">Select {key}</h3>
                            {validationError && !selectedCustomOptions[key] && (
                              <span className="text-sm text-red-600">* Required</span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {options.map((option) => (
                              <button
                                key={option}
                                onClick={() => handleOptionChange(key, option)}
                                className={`px-4 py-2 text-sm font-medium rounded-md ${
                                  selectedCustomOptions[key] === option
                                    ? 'bg-gray-900 text-white'
                                    : validationError && !selectedCustomOptions[key]
                                    ? 'bg-white border border-red-300 text-gray-900 hover:bg-gray-50'
                                    : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Validation Error Message */}
                    {validationError && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">
                          {validationError}
                        </p>
                      </div>
                    )}

                    {/* Selected Variant Info */}
                    {selectedVariant && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-600">
                          Selected: {[
                            selectedSize,
                            selectedColor,
                            ...Object.entries(selectedCustomOptions).map(([key, value]) => `${key}: ${value}`)
                          ].filter(Boolean).join(' / ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          Available: {selectedVariant.quantity} items
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right column - Delivery & Pickup Options */}
              <div>
                <DeliveryOptions options={product.delivery_options} product={product} />
              </div>
            </div>
            
            {/* Quantity selector and buy buttons */}
            <div className="space-y-6 mt-6">
              {/* Available quantity */}
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
              
              {/* Quantity selector */}
              <div id="buy-section">
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
                
              {/* Buy/Cart buttons */}
              <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        </div>
        
        {/* Additional Details Section - Full width below */}
        <div className="mt-12">
          {/* Tabs Section */}
          <div className="border-b border-gray-200">
            {/* Mobile Dropdown */}
            <div className="sm:hidden">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabType)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="details">Details</option>
                <option value="specifications">Specifications</option>
                <option value="features">Features</option>
                <option value="shipping">Shipping & Returns</option>
                <option value="reviews">Reviews</option>
              </select>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden sm:block">
              <nav className="-mb-px flex space-x-8" aria-label="Product details tabs">
                {[
                  { id: 'details', name: 'Details' },
                  { id: 'specifications', name: 'Specifications' },
                  { id: 'features', name: 'Features' },
                  { id: 'shipping', name: 'Shipping & Returns' },
                  { id: 'reviews', name: 'Reviews' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab.id
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile Tab Title */}
          <div className="sm:hidden mt-4 mb-2">
            <h2 className="text-lg font-medium text-gray-900">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
          </div>

          {/* Tab Panels */}
          <div className="mt-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Brand", value: product.brand },
                        { label: "Material", value: product.material },
                        { label: "Category", value: product.category },
                        { label: "Quality", value: product.quality },
                        { label: "Country of Origin", value: product.country_of_origin }
                      ].map(item => (
                        <div key={item.label} className="col-span-1">
                          <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                          <dd className="mt-1 text-sm font-semibold text-gray-900">
                            {item.value || 'N/A'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Description */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Description</h3>
                    <div className="prose prose-sm max-w-none text-gray-500">
                  {product.detailed_description && (
                        <p className="whitespace-pre-line">{product.detailed_description}</p>
                  )}
                </div>
              </div>
              
                  {/* Highlights */}
                  {product.highlights && product.highlights.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Features</h3>
                      <ul className="grid grid-cols-2 gap-4">
                        {product.highlights.map((highlight, index) => (
                          <li key={index} className="flex items-start">
                            <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                            <span className="text-sm text-gray-600">{highlight}</span>
                          </li>
                        ))}
                      </ul>
            </div>
                  )}
          </div>
        </div>
            )}

            {/* Specifications Tab */}
            {activeTab === 'specifications' && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="space-y-8">
              {/* Specifications */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Specifications</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      {Object.entries(product.specifications || {}).map(([key, value]) => (
                        <div key={key} className="col-span-1">
                          <dt className="text-sm font-medium text-gray-500">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-gray-900">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Measurements */}
                  {product.measurements && Object.keys(product.measurements).length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Measurements</h3>
                      <dl className="grid grid-cols-2 gap-4">
                        {Object.entries(product.measurements).map(([key, value]) => (
                          <div key={key} className="col-span-1">
                            <dt className="text-sm font-medium text-gray-500">{key}</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900">
                              {String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Care Instructions */}
                  {product.care_instructions && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Care Instructions</h3>
                      <p className="text-sm text-gray-600">{product.care_instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="space-y-8">
                  {/* Style and Fit */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Style and Fit</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Style Notes */}
                      {product.style_notes && (
              <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Style Notes</h4>
                          <p className="text-sm text-gray-900">{product.style_notes}</p>
                        </div>
                      )}
                      
                      {/* Fit Information */}
                      {product.fit_info && (
                  <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Fit Information</h4>
                          <p className="text-sm text-gray-900">{product.fit_info}</p>
                  </div>
                      )}
                    </div>
                  </div>

                  {/* Available Options */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Options</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Sizes */}
                      {product.sizes && product.sizes.length > 0 && (
                  <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Available Sizes</h4>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes.map((size, index) => (
                              <span key={index} className="px-3 py-1 bg-white border border-gray-200 rounded-md text-sm text-gray-700">
                                {size}
                              </span>
                            ))}
                  </div>
                        </div>
                      )}

                      {/* Colors */}
                      {product.colors && product.colors.length > 0 && (
                  <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Available Colors</h4>
                          <div className="flex flex-wrap gap-2">
                            {product.colors.map((color, index) => (
                              <span key={index} className="px-3 py-1 bg-white border border-gray-200 rounded-md text-sm text-gray-700">
                                {color}
                              </span>
                            ))}
                  </div>
                        </div>
                      )}
                    </div>

                    {/* Variants */}
                    {product.available_variants && product.available_variants.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Available Variants</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {product.available_variants.map((variant, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Size: <span className="font-medium">{variant.size}</span></div>
                                <div>Color: <span className="font-medium">{variant.color}</span></div>
                                <div>SKU: <span className="font-medium">{variant.sku}</span></div>
                                <div>Stock: <span className="font-medium">{variant.quantity}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Usage and Sustainability */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage and Sustainability</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Occasions */}
                      {product.occasion && product.occasion.length > 0 && (
                  <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Perfect For</h4>
                          <div className="flex flex-wrap gap-2">
                            {product.occasion.map((occ, index) => (
                              <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                                {occ}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Seasons */}
                      {product.season && product.season.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Ideal Seasons</h4>
                          <div className="flex flex-wrap gap-2">
                            {product.season.map((s, index) => (
                              <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sustainability Information */}
                    {product.sustainability_info && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Sustainability</h4>
                        <p className="text-sm text-gray-900 bg-white p-4 rounded-lg border border-gray-200">
                          {product.sustainability_info}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* FAQs */}
                  {product.faqs && product.faqs.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
                      <div className="space-y-4">
                        {product.faqs.map((faq: any, index: number) => (
                          <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">{faq.question}</h4>
                            <p className="text-sm text-gray-600">{faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shipping Tab */}
            {activeTab === 'shipping' && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="space-y-8">
                  {/* Shipping Information */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Information</h3>
                    <dl className="space-y-4">
                      {product.shipping_info && (
                        <>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Processing Time</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                              {product.shipping_info.processing_time}
                    </dd>
                  </div>
                  <div>
                            <dt className="text-sm font-medium text-gray-500">Return Policy</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                              {product.shipping_info.return_policy || 'Contact seller for return policy'}
                    </dd>
                  </div>
                        </>
                      )}
                </dl>
              </div>

                  {/* Warranty Information */}
                  {product.warranty_info && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Warranty</h3>
                      <p className="text-sm text-gray-600">{product.warranty_info}</p>
            </div>
                  )}
          </div>
              </div>
            )}
          
            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                {/* Reviews Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {/* Left: Overall Rating */}
                  <div className="md:col-span-1 bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Rating</h3>
                    <div className="text-center">
                      <div className="text-5xl font-bold text-gray-900 mb-2">
                        {product.average_rating?.toFixed(1) || '0.0'}
                      </div>
                      <div className="flex justify-center mb-2">
                      <ProductRating
                        productId={product.id}
                        initialRating={product.average_rating}
                        readonly={true}
                      />
                      </div>
                      <p className="text-sm text-gray-500">
                        Based on {product.total_ratings} reviews
                      </p>
                    </div>
                  </div>

                  {/* Middle: Rating Distribution */}
                  <div className="md:col-span-1 bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h3>
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = (product.reviews || [])
                          .filter((review: Review) => Math.round(review.rating) === stars)
                          .length;
                        const percentage = product.total_ratings 
                          ? (count / product.total_ratings) * 100 
                          : 0;
                        
                        return (
                          <div key={stars} className="flex items-center">
                            <div className="w-12 text-sm text-gray-600">{stars} stars</div>
                            <div className="flex-1 mx-4">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-yellow-400 h-2 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-12 text-sm text-gray-600 text-right">
                              {count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Review CTA */}
                  <div className="md:col-span-1 bg-gray-50 p-6 rounded-xl flex flex-col justify-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Your Thoughts</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Help other shoppers by sharing your experience with this product
                    </p>
                    <button
                      onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                    >
                      Write a Review
                    </button>
                  </div>
                </div>

                {/* Review Form */}
                <div id="review-form" className="bg-gray-50 rounded-xl p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Write a Review</h3>
                  <ReviewForm
                    productId={product.id}
                    initialRating={product.user_rating?.rating}
                    initialComment={product.user_rating?.comment}
                    onSubmit={fetchProduct}
                  />
                </div>

                {/* Reviews List */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Reviews</h3>
                  {product.reviews && product.reviews.length > 0 ? (
                    <>
                      {/* Filters */}
                      <div className="flex items-center gap-4 mb-6">
                        <select 
                          value={reviewSortBy}
                          onChange={(e) => setReviewSortBy(e.target.value)}
                          className="rounded-md border-gray-300 text-sm"
                        >
                          <option value="recent">Most Recent</option>
                          <option value="highest">Highest Rated</option>
                          <option value="lowest">Lowest Rated</option>
                        </select>
                        <select 
                          value={reviewFilter}
                          onChange={(e) => setReviewFilter(e.target.value)}
                          className="rounded-md border-gray-300 text-sm"
                        >
                          <option value="all">All Stars</option>
                          <option value="5">5 Stars</option>
                          <option value="4">4 Stars</option>
                          <option value="3">3 Stars</option>
                          <option value="2">2 Stars</option>
                          <option value="1">1 Star</option>
                        </select>
                      </div>

                      {/* Process and filter reviews */}
                      {(() => {
                        let filteredReviews = [...product.reviews];
                        
                        // Apply star filter
                        if (reviewFilter !== 'all') {
                          const starFilter = parseInt(reviewFilter);
                          filteredReviews = filteredReviews.filter(review => 
                            Math.round(review.rating) === starFilter
                          );
                        }
                        
                        // Apply sorting
                        filteredReviews.sort((a, b) => {
                          switch (reviewSortBy) {
                            case 'highest':
                              return b.rating - a.rating;
                            case 'lowest':
                              return a.rating - b.rating;
                            case 'recent':
                            default:
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                          }
                        });
                        
                        // Calculate pagination
                        const totalPages = Math.ceil(filteredReviews.length / reviewsPerPage);
                        const startIndex = (currentReviewPage - 1) * reviewsPerPage;
                        const endIndex = startIndex + reviewsPerPage;
                        const currentReviews = filteredReviews.slice(startIndex, endIndex);
                        
                        return (
                          <>
                            {/* Reviews Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {currentReviews.map((review: Review) => (
                                <div key={review.id} className="bg-gray-50 rounded-xl p-6">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center">
                                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center text-white font-medium">
                                        {review.user.full_name[0]}
                                      </div>
                                      <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-900">
                                          {review.user.full_name}
                                        </p>
                                        <div className="flex items-center mt-1">
                                          <ProductRating
                                            productId={review.id}
                                            initialRating={review.rating}
                                            readonly={true}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <time className="text-sm text-gray-500">
                                      {new Date(review.created_at).toLocaleDateString()}
                                    </time>
                                  </div>
                                  {review.comment && (
                                    <p className="text-sm text-gray-600 mt-2">{review.comment}</p>
                                  )}
                                  <div className="mt-4 flex items-center gap-4">
                                    <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905 0 .905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                      </svg>
                                      Helpful
                                    </button>
                                    <button className="text-sm text-gray-500 hover:text-gray-700">
                                      Report
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                              <div className="mt-8 flex justify-center">
                                <nav className="flex items-center gap-2">
                                  <button 
                                    onClick={() => setCurrentReviewPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentReviewPage === 1}
                                    className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Previous
                                  </button>
                                  
                                  {/* Page numbers */}
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                                    // Show first page, last page, current page, and pages around current
                                    const shouldShow = 
                                      pageNum === 1 || 
                                      pageNum === totalPages || 
                                      Math.abs(pageNum - currentReviewPage) <= 1;
                                    
                                    if (!shouldShow) {
                                      if (pageNum === 2 || pageNum === totalPages - 1) {
                                        return <span key={pageNum} className="px-2 text-gray-500">...</span>;
                                      }
                                      return null;
                                    }
                                    
                                    return (
                                      <button
                                        key={pageNum}
                                        onClick={() => setCurrentReviewPage(pageNum)}
                                        className={`px-3 py-1 rounded-md ${
                                          currentReviewPage === pageNum
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                      >
                                        {pageNum}
                                      </button>
                                    );
                                  })}
                                  
                                  <button 
                                    onClick={() => setCurrentReviewPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentReviewPage === totalPages}
                                    className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Next
                                  </button>
                                </nav>
                              </div>
                            )}
                            
                            {/* Results info */}
                            <div className="text-center text-sm text-gray-500">
                              Showing {startIndex + 1}-{Math.min(endIndex, filteredReviews.length)} of {filteredReviews.length} reviews
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No reviews yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Be the first to review this product
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white">
                  {review.user.full_name[0]}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {review.user.full_name}
                </p>
                <div className="flex items-center mt-1">
                  <ProductRating
                    productId={review.id}
                    initialRating={review.rating}
                    readonly={true}
                  />
                </div>
              </div>
            </div>
            <time className="text-sm text-gray-500">
              {new Date(review.created_at).toLocaleDateString()}
            </time>
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

// Rename the local SimilarProducts component to RelatedProducts to avoid conflict
const RelatedProducts = ({ currentProductId, category }: { currentProductId: string, category?: string }) => {
  const [products, setProducts] = useState<any[]>([]);
  const supabase = createClientComponent();

  useEffect(() => {
    const fetchSimilarProducts = async () => {
      if (!category) return;

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          title,
          price,
          product_images (
            image_url
          )
        `)
        .eq('category', category)
        .eq('is_active', true)
        .neq('id', currentProductId)
        .limit(4);

      if (!error && data) {
        setProducts(data);
      }
    };

    fetchSimilarProducts();
  }, [category, currentProductId]);

  if (products.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Related Products</h2>
      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <Link 
            href={`/products/${product.id}`}
            key={product.id}
            className="group"
          >
            <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg">
              {product.product_images?.[0]?.image_url ? (
                <Image
                  src={product.product_images[0].image_url}
                  alt={product.title}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover object-center group-hover:opacity-75"
                />
              ) : (
                <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No image</span>
                </div>
              )}
            </div>
            <h3 className="mt-2 text-sm text-gray-700">{product.title}</h3>
            <p className="mt-1 text-sm font-medium text-gray-900">
              ETB {product.price.toFixed(2)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Add this new component to display JSON data in a readable format
const JsonDataDisplay = ({ label, data }: { label: string; data: any }) => {
  if (!data || (Array.isArray(data) && data.length === 0) || Object.keys(data).length === 0) {
    return null;
  }

  const renderValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (value.sku) { // Handle variant display
        return (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Size: <span className="font-medium">{value.size}</span></div>
              <div>Color: <span className="font-medium">{value.color}</span></div>
              <div>SKU: <span className="font-medium">{value.sku}</span></div>
              <div>Quantity: <span className="font-medium">{value.quantity}</span></div>
            </div>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="col-span-1">
              <span className="text-gray-600">{key.replace(/_/g, ' ')}: </span>
              <span className="font-medium">{val as string}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span className="font-medium">{value}</span>;
  };

  return (
    <div className="mb-6 bg-white rounded-lg">
      <h4 className="text-sm font-medium text-gray-900 mb-2">{label}</h4>
      <div className="space-y-2">
        {Array.isArray(data) ? (
          <div className="flex flex-wrap gap-2">
            {data.map((item, index) => (
              <div key={index} className="flex-none">
                {typeof item === 'object' ? (
                  renderValue(item)
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    {item}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          renderValue(data)
        )}
      </div>
    </div>
  );
}; 