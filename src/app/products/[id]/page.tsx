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
  user_rating?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
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
      
      // Fetch product with all related data - change ratings!inner to ratings!left
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          owner:users!products_owner_id_fkey (
            id,
            full_name,
            email,
            store_settings
          ),
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          likes:likes (count),
          ratings (
            id,
            rating,
            comment,
            created_at,
            updated_at,
            users (
              id,
              full_name
            )
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      // Calculate average rating - handle case where ratings might be null
      const ratings = product.ratings || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((acc: number, curr: any) => acc + curr.rating, 0) / ratings.length
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

      // Get flash sale price if available
      const flashSalePrices = await getFlashSalePrices([productId]);
      
      const processedProduct = {
        ...product,
        flash_sale_price: flashSalePrices[productId],
        like_count: product.likes?.[0]?.count || 0,
        users: product.owner,
        product_images: product.product_images?.map((img: { image_url: string }) => ({
          ...img,
          image_url: img.image_url
        })),
        average_rating: averageRating,
        ratings: ratings.map((rating: any) => ({
          id: rating.id,
          rating: rating.rating,
          comment: rating.comment,
          created_at: rating.created_at,
          updated_at: rating.updated_at,
          user: rating.users
        })),
        user_rating: userRating
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
            {/* Keep only the Rating Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Customer Reviews</h3>
                <button
                  onClick={() => document.getElementById('rating-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  {product.user_rating ? 'Update Your Review' : 'Write a Review'}
                </button>
              </div>

              {/* Rating Section */}
              <ProductRating 
                productId={product.id} 
                initialRating={product.user_rating}
                onRatingSubmit={fetchProduct}
              />
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

        {/* Add this section after the Similar Products section */}
        <div className="mt-16 col-span-full">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="max-w-7xl mx-auto">
              {/* Reviews Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
                <button
                  onClick={() => document.getElementById('rating-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  {product.user_rating ? 'Update Your Review' : 'Write a Review'}
                </button>
              </div>

              {/* Reviews Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
                {/* Overall Rating */}
                <div className="lg:col-span-4">
                  <div className="text-center p-6 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <svg
                        className="w-8 h-8 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                      <span className="text-4xl font-bold text-gray-900">
                        {product.average_rating?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Based on {product.ratings?.length || 0} reviews
                    </p>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="lg:col-span-8">
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = product.ratings?.filter(
                        (rating: any) => rating.rating === star
                      ).length || 0;
                      const percentage = product.ratings?.length
                        ? (count / product.ratings.length) * 100
                        : 0;

                      return (
                        <div key={star} className="flex items-center">
                          <div className="w-24 text-sm text-gray-600">
                            {star} stars
                          </div>
                          <div className="flex-1 h-4 mx-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-16 text-sm text-gray-600">
                            {count} ({percentage.toFixed(0)}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-8">
                {product.ratings?.map((review: any) => (
                  <div
                    key={review.id}
                    className="border-b border-gray-100 last:border-0 pb-8 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-lg">
                            {review.user.full_name[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            {review.user.full_name}
                          </h4>
                          <div className="flex items-center mt-1">
                            <div className="flex items-center">
                              <svg
                                className="w-5 h-5 text-yellow-400"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="ml-1 text-sm text-gray-500">
                                {review.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <div className="prose prose-sm max-w-none text-gray-500">
                        <p>{review.comment}</p>
                      </div>
                    )}
                  </div>
                ))}

                {(!product.ratings || product.ratings.length === 0) && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No reviews yet. Be the first to review this product!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 