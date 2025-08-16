'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatETB } from '@/utils/currency';
import CountdownTimer from '@/components/CountdownTimer';
import { createClientComponent } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getActiveFlashSale, getFlashSalePrices, getAllActiveFlashSales } from '@/utils/flashSales';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { cleanImageUrl } from '@/utils/url';
import { useAuth } from '@/contexts/AuthContext';
import { PRODUCT_CATEGORIES } from '@/utils/constants';
import { Fragment } from 'react';
import { EMAIL_CONFIG } from '@/config/email';
import { FeaturedCollections, CategoryGrid, TestimonialsSection, NewsletterSection } from '@/components/landing';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPlaceholderImage } from '@/utils/placeholderImages';
import { Sparkles, ArrowRight, Users, TrendingUp, Send } from 'lucide-react';
import LoginModal from '@/components/LoginModal';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ELoading...%3C/text%3E%3C/svg%3E';

// Interface definitions
interface FeaturedSeller {
  seller_id: string;
  seller_name: string;
  verification_status: string;
  verification?: any;
  hasStoreSetup?: boolean | string;
  avgRating: number;
  totalLikes: number;
  totalRatings: number;
  combinedScore: number;
  store_settings: {
    name: string;
    logo_url: string;
    description: string;
    banner_url?: string;
  };
  top_product: {
    id: string;
    title: string;
    price: number;
    images: Array<{ image_url: string }>;
    like_count: number;
  };
}

interface ProductImage {
  id: string;
  image_url: string;
  is_model_picture: boolean;
}

interface PopularProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  owner_id: string;
  created_at: string;
  quantity: number;
  sizes: string[];
  colors: string[];
  available_variants: any[];
  brand?: string;
  material?: string;
  quality: 'new' | 'used' | 'refurbished';
  product_images: ProductImage[];
  likes: Array<{ id: string }>;
  like_count?: number;
  flash_sale_price?: number;
  users: {
    id: string;
    full_name: string;
    email: string;
    store_settings?: {
      name: string;
      logo_url: string;
      description: string;
    };
  };
  average_rating?: number;
  ratings?: Array<{
    id: string;
    rating: number;
    comment: string;
    user_id: string;
    created_at: string;
    users?: {
      full_name: string;
    };
  }>;
  combined_score?: number;
}

interface FlashSaleProduct {
  id: string;
  product_id: string;
  special_price: number;
  product: {
    id: string;
    title: string;
    price: number;
    description: string;
    product_images: Array<{
      id: string;
      image_url: string;
    }>;
    owner?: {
      store_settings?: {
        name?: string;
      };
    };
  };
  parentSale?: {
    id: string;
    end_time: string;
    title: string;
  };
}

interface FlashSale {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  store_id: string;
  store_name: string;
  created_by?: string;
  products: FlashSaleProduct[];
}

  // Enhanced Product Card Component
  const EnhancedProductCard = ({ product, index, user }: { product: PopularProduct, index: number, user: any }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginModalType, setLoginModalType] = useState<'rate' | 'like' | 'cart' | 'generic'>('generic');
    const router = useRouter();
    const supabase = createClientComponent();

    // Clean up body overflow when component unmounts
    useEffect(() => {
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);
    
    // Use real data from database
    const availableSizes = product.sizes || [];
    const availableColors = product.colors || [];
    
    // Generate scarcity message based on real quantity
    const getScarcityMessage = (quantity: number) => {
      if (quantity <= 3) return `Only ${quantity} left!`;
      if (quantity <= 10) return 'Limited stock';
      if (quantity <= 20) return 'Almost sold out';
      return 'In stock';
    };
    
    // Get real customer review for social proof
    const getRecentPurchase = () => {
      if (product.ratings && product.ratings.length > 0) {
        const latestRating = product.ratings[0];
        const customerName = latestRating.users?.full_name || 'A customer';
        const timeAgo = new Date(latestRating.created_at).toLocaleDateString();
        return `${customerName} bought this on ${timeAgo}`;
      }
      return 'Recently purchased by another customer';
    };

    const scarcityMessage = getScarcityMessage(product.quantity);
    const socialProofMessage = getRecentPurchase();
    const hasFlashSale = product.flash_sale_price && product.flash_sale_price < product.price;
    const originalPrice = hasFlashSale ? product.price : null;
    const displayPrice = hasFlashSale ? product.flash_sale_price : product.price;

    // Handler to navigate to product detail page
    const handleCardClick = (e: React.MouseEvent) => {
      // Prevent navigation if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a')) {
        return;
      }
      router.push(`/products/${product.id}`);
    };

    const closeVariantModal = () => {
      setShowVariantModal(false);
      setValidationError(null);
      // Reset selections when modal closes
      setSelectedSize(null);
      setSelectedColor(null);
      // Re-enable body scrolling
      document.body.style.overflow = 'auto';
    };

    const openVariantModal = () => {
      setShowVariantModal(true);
      // Disable body scrolling when modal is open
      document.body.style.overflow = 'hidden';
    };

    // Handler to add product to cart
    const handleAddToCart = async (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent card click navigation
      
      if (!user) {
        setLoginModalType('cart');
        setShowLoginModal(true);
        return;
      }

      // Check if product has variants that require selection
      const hasVariants = availableSizes.length > 0 || availableColors.length > 0;
      
      if (hasVariants && ((!selectedSize && availableSizes.length > 0) || (!selectedColor && availableColors.length > 0))) {
        // Show variant selection modal
        openVariantModal();
        return;
      }

      setIsAddingToCart(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoginModalType('cart');
          setShowLoginModal(true);
          return;
        }

        // Check if item already exists in cart (including variant matching)
        const { data: existingItem, error: checkError } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', session.user.id)
          .eq('product_id', product.id)
          .eq('selected_size', selectedSize || null)
          .eq('selected_color', selectedColor || null)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingItem) {
          // Update existing item quantity
          const { error: updateError } = await supabase
            .from('cart_items')
            .update({ 
              quantity: existingItem.quantity + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingItem.id);

          if (updateError) throw updateError;
          toast.success('Cart updated! Quantity increased.');
        } else {
          // Add new item to cart
          console.log('Adding new item to cart with data:', {
            user_id: session.user.id,
            product_id: product.id,
            quantity: 1,
            price: product.price,
            delivery_fee: 0,
            selected_size: selectedSize,
            selected_color: selectedColor,
            delivery_method: 'delivery'
          });
          
          const { data: insertData, error: insertError } = await supabase
            .from('cart_items')
            .insert({
              user_id: session.user.id,
              product_id: product.id,
              quantity: 1,
              price: product.price, // Required field
              delivery_fee: 0, // Default delivery fee
              selected_size: selectedSize,
              selected_color: selectedColor,
              delivery_method: 'delivery' // Default to delivery
            })
            .select();

          console.log('Insert result:', { insertData, insertError });
          
          if (insertError) {
            console.error('Insert error details:', insertError);
            throw insertError;
          }
          toast.success('Added to cart successfully!');
        }

        // Trigger cart count update in the header
        window.dispatchEvent(new CustomEvent('cart-updated'));

    } catch (error) {
        console.error('Error adding to cart:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Product ID:', product.id);
        console.error('Available sizes:', availableSizes);
        console.error('Available colors:', availableColors);
        
        // More specific error message
        let errorMessage = 'Failed to add item to cart. Please try again.';
        if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = `Error: ${(error as any).message}`;
        } else if (error && typeof error === 'object' && 'error_description' in error) {
          errorMessage = `Error: ${(error as any).error_description}`;
        }
        
        toast.error(errorMessage);
      } finally {
        setIsAddingToCart(false);
    }
  };

  return (
    <>
      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        actionType={loginModalType}
      />
      
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group h-[500px] flex flex-col cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
      >
      {/* Product Image */}
      <div className="relative h-72 overflow-hidden">
        <img
          src={product.product_images?.[0] ? cleanImageUrl(product.product_images[0].image_url) : '/placeholder-product.jpg'}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-product.jpg';
          }}
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.quality === 'new' && (
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              NEW
            </span>
          )}
          {hasFlashSale && (
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              SALE
            </span>
          )}
          {product.brand && (
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              {product.brand}
            </span>
          )}
        </div>

        {/* Scarcity Indicator */}
        <div className="absolute top-4 right-4">
          <span className={`text-white px-3 py-1 rounded-full text-xs font-semibold ${
            product.quantity <= 3 ? 'bg-red-500' : 
            product.quantity <= 10 ? 'bg-red-400' : 'bg-green-500'
          }`}>
            {scarcityMessage}
          </span>
        </div>

        {/* Wishlist Button */}
    <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click navigation
            setIsWishlisted(!isWishlisted);
          }}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-300"
        >
          <svg
            className={`w-5 h-5 ${isWishlisted ? 'text-red-500 fill-current' : 'text-gray-600'}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>

        {/* Quick View Overlay */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click navigation
                router.push(`/products/${product.id}`);
              }}
              className="bg-white text-gray-900 px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
              Quick View
            </button>
              </div>
        )}

        {/* Social Proof Overlay */}
        <div className="absolute bottom-4 left-4 right-16">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2">
            <div className="flex items-center text-xs text-gray-600">
              <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
              {socialProofMessage}
              </div>
            </div>
    </div>
      </div>

      {/* Product Info */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-3">
          <h3 className="font-semibold text-lg text-gray-900 mb-1 line-clamp-1">
            {product.title}
          </h3>
          <p className="text-sm text-gray-600">
            by {product.users?.full_name || 'Ethiopian Store'}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-xl text-red-600">
            {formatETB(displayPrice || 0)}
        </span>
          {originalPrice && (
            <span className="text-sm text-gray-500 line-through">
              {formatETB(originalPrice)}
            </span>
          )}
      </div>

        {/* Size & Color Options */}
        <div className="space-y-2 mb-4 flex-1">
          {availableSizes.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 mb-1 block">
                Available Sizes:
              </span>
              <div className="flex gap-1 flex-wrap">
                {availableSizes.slice(0, 4).map((size) => (
                  <span key={size} className="px-2 py-1 bg-gray-100 text-xs rounded">
                    {size}
                  </span>
                ))}
                {availableSizes.length > 4 && (
                  <span className="px-2 py-1 bg-gray-200 text-xs rounded">
                    +{availableSizes.length - 4}
                  </span>
                )}
      </div>
    </div>
          )}
          
          {availableColors.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 mb-1 block">
                Colors:
              </span>
              <div className="flex gap-1 flex-wrap">
                {availableColors.slice(0, 3).map((color) => (
                  <span key={color} className="px-2 py-1 bg-gray-100 text-xs rounded">
                    {color}
                  </span>
                ))}
                {availableColors.length > 3 && (
                  <span className="px-2 py-1 bg-gray-200 text-xs rounded">
                    +{availableColors.length - 3}
        </span>
                )}
      </div>
        </div>
          )}

          {/* Quantity & Material Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>Stock: {product.quantity} items</div>
            {product.material && <div>Material: {product.material}</div>}
            {product.average_rating && product.average_rating > 0 && (
              <div className="flex items-center gap-1">
                <span>Rating:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-3 h-3 ${star <= (product.average_rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            ))}
        </div>
                <span>({(product.average_rating || 0).toFixed(1)})</span>
        </div>
            )}
      </div>
    </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isAddingToCart ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.8-1.8m1.8 1.8l10.6 0M7 13v6a2 2 0 002 2h8a2 2 0 002-2v-6" />
            </svg>
            )}
            {isAddingToCart ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
    </div>

      {/* Variant Selection Modal */}
      {showVariantModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" 
          onClick={closeVariantModal} 
          style={{ 
            position: 'fixed', 
            top: '62%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Select Options</h3>
              <button
                onClick={closeVariantModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
                </div>

            {/* Product Info */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
              {product.product_images && product.product_images[0] ? (
                <img
                  src={cleanImageUrl(product.product_images[0].image_url)}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 line-clamp-2">{product.title}</h4>
                <p className="text-lg font-bold text-gray-900">{formatETB(product.price)}</p>
                  </div>
                  </div>

            {/* Size Selector */}
            {availableSizes.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-900">Size</label>
                  {validationError && !selectedSize && (
                    <span className="text-sm text-red-600">* Required</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setSelectedSize(size);
                        setValidationError(null);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                        selectedSize === size
                          ? 'bg-gray-900 text-white border-gray-900'
                          : validationError && !selectedSize
                          ? 'bg-white border-red-300 text-gray-900 hover:bg-gray-50'
                          : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
            ))}
          </div>
        </div>
            )}

            {/* Color Selector */}
            {availableColors.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-900">Color</label>
                  {validationError && !selectedColor && (
                    <span className="text-sm text-red-600">* Required</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => (
                  <button
                      key={color}
                      onClick={() => {
                        setSelectedColor(color);
                        setValidationError(null);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                        selectedColor === color
                          ? 'bg-gray-900 text-white border-gray-900'
                          : validationError && !selectedColor
                          ? 'bg-white border-red-300 text-gray-900 hover:bg-gray-50'
                          : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {color}
                  </button>
                  ))}
                </div>
          </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{validationError}</p>
    </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeVariantModal}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Validate selections
                  if (availableSizes.length > 0 && !selectedSize) {
                    setValidationError('Please select a size');
                    return;
                  }
                  if (availableColors.length > 0 && !selectedColor) {
                    setValidationError('Please select a color');
                    return;
                  }

                  // Close modal and add to cart
                  setShowVariantModal(false);
                  await handleAddToCart({ stopPropagation: () => {} } as React.MouseEvent);
                }}
                disabled={isAddingToCart}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isAddingToCart ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.8-1.8m1.8 1.8l10.6 0M7 13v6a2 2 0 002 2h8a2 2 0 002-2v-6" />
                  </svg>
                )}
                {isAddingToCart ? 'Adding...' : 'Add to Cart'}
              </button>
    </div>
  </div>
          </div>
        )}
      </div>
    </>
  );
  };

export default function HomePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponent();
  const [activeFlashSales, setActiveFlashSales] = useState<FlashSale[]>([]);
  const [mostLikedProducts, setMostLikedProducts] = useState<PopularProduct[]>([]);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [heroProducts, setHeroProducts] = useState<PopularProduct[]>([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  // Update hero products when mostLikedProducts changes
  useEffect(() => {
    if (mostLikedProducts.length > 0) {
      updateHeroProducts();
    }
  }, [mostLikedProducts]);

  // Rotate hero products every minute
  useEffect(() => {
    if (mostLikedProducts.length > 4) {
      const interval = setInterval(() => {
        setCurrentProductIndex(prev => {
          const newIndex = (prev + 4) % mostLikedProducts.length;
          updateHeroProducts(newIndex);
          return newIndex;
        });
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [mostLikedProducts]);

  const updateHeroProducts = (startIndex = currentProductIndex) => {
    if (mostLikedProducts.length > 0) {
      const selectedProducts = [];
      for (let i = 0; i < 4; i++) {
        const index = (startIndex + i) % mostLikedProducts.length;
        selectedProducts.push(mostLikedProducts[index]);
      }
      setHeroProducts(selectedProducts);
    }
  };

  

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        fetchFeaturedBrands(),
        fetchPopularProducts(),
        fetchFlashSales()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedBrands = async () => {
    try {
      // First get verified users with their products and ratings/likes
      const { data: brands, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          store_settings,
          verification_status,
          products (
            id,
            ratings (
              id,
              rating
            ),
            likes (
              id
            )
          )
        `)
        .eq('verification_status', 'verified')
        .eq('role', 'owner');

      if (error) throw error;

      // Get public business names from the view
      const { data: businessNames, error: businessNamesError } = await supabase
        .from('public_business_names')
        .select('*');

      if (businessNamesError) {
        console.error('Error fetching business names:', businessNamesError);
      }

      console.log('Public business names from view:', businessNames);

      const processedBrands = brands?.map(brand => {
        // Find business name for this user
        const businessNameData = businessNames?.find(bn => bn.user_id === brand.id);
        
        // Calculate ratings and likes metrics
        const products = brand.products || [];
        const allRatings = products.flatMap(product => product.ratings || []);
        const allLikes = products.flatMap(product => product.likes || []);
        
        const totalRatings = allRatings.length;
        const totalLikes = allLikes.length;
        const avgRating = totalRatings > 0 
          ? allRatings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings 
          : 0;
        
        // Calculate combined score: (average rating * weight) + (total likes * weight) + (total ratings * weight)
        const ratingWeight = 0.4;
        const likesWeight = 0.3;
        const ratingsCountWeight = 0.3;
        
        const combinedScore = (avgRating * ratingWeight) + 
                             (totalLikes * likesWeight) + 
                             (totalRatings * ratingsCountWeight);

        // Priority logic: Store setup takes priority, then business name from verification
        const hasStoreSetup = brand.store_settings && 
                             (brand.store_settings.name || 
                              brand.store_settings.description || 
                              brand.store_settings.logo_url || 
                              brand.store_settings.banner_url);

        const displayName = hasStoreSetup 
          ? (brand.store_settings?.name || businessNameData?.business_name || brand.full_name)
          : (businessNameData?.business_name || brand.full_name);

        console.log('Processing brand:', {
          userId: brand.id,
          fullName: brand.full_name,
          hasStoreSetup: hasStoreSetup,
          avgRating: avgRating,
          totalLikes: totalLikes,
          totalRatings: totalRatings,
          combinedScore: combinedScore,
          displayName: displayName
        });

        return {
          seller_id: brand.id,
          seller_name: brand.full_name,
          verification_status: brand.verification_status,
          verification: businessNameData ? { business_name: businessNameData.business_name } : null,
          hasStoreSetup: hasStoreSetup,
          avgRating: avgRating,
          totalLikes: totalLikes,
          totalRatings: totalRatings,
          combinedScore: combinedScore,
          store_settings: {
            name: displayName,
            logo_url: brand.store_settings?.logo_url || '',
            description: brand.store_settings?.shortDescription || 
                        brand.store_settings?.description || 
                        (businessNameData ? `${businessNameData.business_name} - Verified Business` : 'Verified seller on our platform'),
            banner_url: brand.store_settings?.banner_url || ''
          },
          top_product: {
            id: '',
            title: 'Featured Product',
            price: 0,
            images: [],
            like_count: 0
          }
        };
      }) || [];

      // Sort by priority: 
      // 1. Total engagement (likes + ratings) from highest to lowest
      // 2. Average rating as tiebreaker
      // 3. Stores with setup get slight boost
      // 4. Then by name alphabetically as final tiebreaker
      const sortedBrands = processedBrands
        .sort((a, b) => {
          // Calculate total engagement
          const engagementA = a.totalLikes + a.totalRatings;
          const engagementB = b.totalLikes + b.totalRatings;
          

          
          // Primary sort: by total engagement (highest to lowest)
          if (engagementA !== engagementB) {
            return engagementB - engagementA;
          }
          
          // Secondary sort: by average rating (highest to lowest)
          if (a.avgRating !== b.avgRating) {
            return b.avgRating - a.avgRating;
          }
          
          // Tertiary sort: stores with setup
          if (a.hasStoreSetup && !b.hasStoreSetup) return -1;
          if (!a.hasStoreSetup && b.hasStoreSetup) return 1;
          
          // Final sort: alphabetical by name
          return a.store_settings.name.localeCompare(b.store_settings.name);
        })
        .slice(0, 10); // Top 10 only

      console.log('Sorted top 10 brands:', sortedBrands);
      setFeaturedBrands(sortedBrands);
    } catch (error) {
      console.error('Error fetching featured brands:', error);
    }
  };

  const fetchPopularProducts = async () => {
    try {
      const { data: likedProducts, error: likedError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          description,
          price,
          category,
          owner_id,
          created_at,
          quantity,
          sizes,
          colors,
          available_variants,
          brand,
          material,
          quality,
          product_images (
            id,
            image_url,
            is_model_picture
          ),
          users (
            id,
            full_name,
            email,
            store_settings
          ),
          likes (
            id
          ),
          ratings (
            id,
            rating,
            comment,
            user_id,
            created_at,
            users (
              full_name
            )
          )
        `)
        .eq('is_active', true)
        .gt('quantity', 0)
        .limit(20);

      if (likedError) throw likedError;

      const processedLikedProducts = (likedProducts || [])
        .map(product => {
          // Calculate real average rating
        const ratings = product.ratings || [];
        const averageRating = ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length 
          : 0;

        return {
          ...product,
            users: Array.isArray(product.users) ? product.users[0] : product.users,
            like_count: product.likes?.length || 0,
          average_rating: averageRating,
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colors: Array.isArray(product.colors) ? product.colors : [],
            available_variants: Array.isArray(product.available_variants) ? product.available_variants : [],
            product_images: product.product_images?.map(img => ({
            ...img,
              is_model_picture: img.is_model_picture || false
            })) || [],
            ratings: ratings.slice(0, 3).map(rating => ({
              ...rating,
              users: Array.isArray(rating.users) ? rating.users[0] : rating.users
            })) // Only keep first 3 ratings for display
          };
        })
        .sort((a, b) => b.like_count - a.like_count);

      console.log('Processed liked products:', processedLikedProducts.slice(0, 2)); // Debug log
      setMostLikedProducts(processedLikedProducts);
    } catch (error) {
      console.error('Error fetching popular products:', error);
    }
  };

    const fetchFlashSales = async () => {
      try {
      const flashSales = await getAllActiveFlashSales();
      // Map the flash sales to match our interface
      const mappedFlashSales = flashSales.map((sale: any) => ({
        ...sale,
        products: sale.flash_sale_products?.map((fsp: any) => ({
          id: fsp.id,
          product_id: fsp.product_id,
          special_price: fsp.special_price,
          product: {
            ...(Array.isArray(fsp.products) ? fsp.products[0] : fsp.products),
            product_images: (Array.isArray(fsp.products) ? fsp.products[0] : fsp.products)?.product_images?.map((img: any) => ({
              ...img,
              is_model_picture: img.is_model_picture || false
            })) || []
          }
        })) || []
      }));
      console.log('Mapped flash sales:', mappedFlashSales.slice(0, 1)); // Debug log
      setActiveFlashSales(mappedFlashSales);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    }
  };

  const getAllFlashSaleProducts = () => {
    return activeFlashSales.flatMap(sale => 
      sale.products.map(product => ({
        ...product,
        parentSale: {
          id: sale.id,
          end_time: sale.end_time,
          title: sale.title
        }
      }))
    ) || [];
  };

  const handleSubscribe = async (email: string, type: 'notify_me' | 'newsletter') => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setSubscriptionLoading(true);
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      toast.success(data.message);
      if (type === 'notify_me') {
        setNotifyEmail('');
      } else {
        setNewsletterEmail('');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(notifyEmail, 'notify_me');
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionLoading) return;
    await handleSubscribe(newsletterEmail, 'newsletter');
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <>      
      <div className="min-h-screen relative bg-gray-900 overflow-hidden w-full">
        
        {/* Enhanced Hero Section with Integrated Achievement Badges */}
        <section className="relative min-h-screen flex flex-col overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 hero-gradient">
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url(${getPlaceholderImage('hero-fashion')})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-purple-900/40 to-transparent" />
          </div>

          {/* Floating Elements */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-32 left-16 w-24 h-24 bg-red-500/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }} />

                    {/* Main Hero Content */}
          <div className="flex-1 flex items-center">
            <div className="w-full px-4 lg:px-8 relative z-10">
              <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Content */}
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <motion.div 
                        className="inline-flex items-center gap-2 bg-pink-500/10 text-pink-400 border border-pink-500/20 px-4 py-2 rounded-full text-sm font-medium"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {language === 'am' ? 'አንድ ላይ የተሰበሰበ የኢትዮጵያ ገበያ' : 'All‑in‑one Ethiopian Marketplace'}
                      </motion.div>
                      
                  <motion.h1
                        className="text-3xl lg:text-5xl font-bold text-white leading-tight"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                        Discover
                        <span className="block text-transparent bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text">
                          Everything
                        </span>
                        You Need
                  </motion.h1>
                      
                  <motion.p
                        className="text-xl text-white/80 leading-relaxed max-w-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                        {language === 'am'
                          ? 'ኤሌክትሮኒክስ፣ ፋሽን፣ ቤት እና ኑሮ፣ ውበት እና ሌሎችንም ከሚታመኑ የኢትዮጵያ ሻጮች ይግዙ። ደህንነታማ ክፍያ፣ ፈጣን ማቅረብ እና እውነተኛ የደንበኛ አገልግሎት — ሁሉም በአንድ ቦታ።'
                          : 'Shop electronics, fashion, home & living, beauty and more from trusted Ethiopian sellers. Secure payments, fast delivery, and real customer support — all in one place.'}
                  </motion.p>
                    </div>

                    {/* CTA Buttons */}
                  <motion.div 
                      className="flex flex-col sm:flex-row gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Link
                      href="/products"
                        className="group inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-pink-600 to-pink-500 text-white rounded-full font-semibold hover:from-pink-700 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                        {language === 'am' ? 'ግብዣ ጀምር' : 'Start Shopping'}
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                      
                    {!user && (
                      <Link
                        href="/signup?role=owner"
                          className="inline-flex items-center justify-center px-8 py-3 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-full font-semibold transition-all duration-300"
                      >
                        {language === 'am' ? 'ሻጭ ይሁኑ' : 'Become a Seller'}
                      </Link>
                    )}
                  </motion.div>

                    {/* Stats */}
                      <motion.div
                      className="flex items-center gap-8 pt-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                      <div className="flex items-center gap-2 text-white/80">
                        <Users className="w-5 h-5 text-pink-400" />
                        <span className="text-sm">{language === 'am' ? '50,000+ ንቁ ተጠቃሚዎች' : '50K+ Active Users'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <TrendingUp className="w-5 h-5 text-red-400" />
                        <span className="text-sm">{language === 'am' ? '10,000+ ምርቶች' : '10K+ Products'}</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Product Showcase */}
                  <motion.div 
                    className="relative"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {/* Featured Product Cards */}
                      <div className="space-y-4">
                        {(heroProducts.length > 0 ? heroProducts : [
                          { id: 'temp1', title: 'Loading Products...', price: 0, product_images: [] },
                          { id: 'temp2', title: 'Please Wait...', price: 0, product_images: [] },
                          { id: 'temp3', title: 'Fetching Data...', price: 0, product_images: [] },
                          { id: 'temp4', title: 'Almost Ready...', price: 0, product_images: [] }
                        ]).slice(0, 2).map((product, index) => (
                          <motion.div 
                            key={`${product.id}-${currentProductIndex}`}
                            className="glass-effect p-4 rounded-2xl cursor-pointer"
                            initial={{ 
                              opacity: 0, 
                              scale: 0.8,
                              rotate: index === 0 ? 3 : -2
                            }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              rotate: index === 0 ? 3 : -2
                            }}
                            whileHover={{ 
                              scale: 1.05,
                              rotate: 0,
                              transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            transition={{ 
                              duration: 0.5, 
                              delay: index * 0.1,
                              rotate: { duration: 0.4, ease: "easeInOut" }
                            }}
                          >
                            <div className="w-full h-32 bg-white/20 rounded-lg mb-3 overflow-hidden">
                              {product.product_images && product.product_images[0] ? (
                                <img
                                  src={cleanImageUrl(product.product_images[0].image_url)}
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                  <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                        </div>
                              )}
                            </div>
                            <h3 className="text-white font-semibold text-sm line-clamp-1" title={product.title}>
                              {product.title.length > 20 ? product.title.substring(0, 20) + '...' : product.title}
                            </h3>
                            <p className="text-pink-400 font-bold">{formatETB(product.price)}</p>
                      </motion.div>
                    ))}
                  </div>
                      
                      <div className="space-y-4 mt-8">
                        {(heroProducts.length > 0 ? heroProducts : [
                          { id: 'temp1', title: 'Loading Products...', price: 0, product_images: [] },
                          { id: 'temp2', title: 'Please Wait...', price: 0, product_images: [] },
                          { id: 'temp3', title: 'Fetching Data...', price: 0, product_images: [] },
                          { id: 'temp4', title: 'Almost Ready...', price: 0, product_images: [] }
                        ]).slice(2, 4).map((product, index) => (
                          <motion.div 
                            key={`${product.id}-${currentProductIndex}`}
                            className="glass-effect p-4 rounded-2xl cursor-pointer"
                            initial={{ 
                              opacity: 0, 
                              scale: 0.8,
                              rotate: index === 0 ? 2 : -1
                            }}
                            animate={{ 
                              opacity: 1, 
                              scale: 1,
                              rotate: index === 0 ? 2 : -1
                            }}
                            whileHover={{ 
                              scale: 1.05,
                              rotate: 0,
                              transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            transition={{ 
                              duration: 0.5, 
                              delay: (index + 2) * 0.1,
                              rotate: { duration: 0.4, ease: "easeInOut" }
                            }}
                          >
                            <div className="w-full h-32 bg-white/20 rounded-lg mb-3 overflow-hidden">
                              {product.product_images && product.product_images[0] ? (
                                <img
                                  src={cleanImageUrl(product.product_images[0].image_url)}
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                  <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                </div>
                              )}
              </div>
                            <h3 className="text-white font-semibold text-sm line-clamp-1" title={product.title}>
                              {product.title.length > 20 ? product.title.substring(0, 20) + '...' : product.title}
                            </h3>
                            <p className="text-amber-400 font-bold">{formatETB(product.price)}</p>
                          </motion.div>
                        ))}
            </div>
          </div>
                  </motion.div>
          </div>

                {/* Achievement Badges - Moved Up */}
              <motion.div 
                  className="mt-16 pt-12 border-t border-white/10"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
                    {[
                      { icon: '🏆', title: 'Best Marketplace 2023', subtitle: 'Award Winner' },
                      { icon: '⭐', title: '4.9/5 Customer Rating', subtitle: 'Highly Rated' },
                      { icon: '🔒', title: 'Secure Payments', subtitle: '100% Protected' },
                      { icon: '🚚', title: 'Fast Delivery', subtitle: 'Same Day Available' },
                      { icon: '👥', title: '10K+', subtitle: 'Active Users' },
                      { icon: '📦', title: '5K+', subtitle: 'Products Listed' },
                      { icon: '✓', title: '1K+', subtitle: 'Verified Sellers' },
                      { icon: '⭐', title: '4.8', subtitle: 'Average Rating' }
                    ].map((badge, index) => (
              <motion.div 
                        key={index}
                initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.8 + (index * 0.1) }}
                        className="text-center group hover:scale-105 transition-transform duration-300"
                      >
                        <div className="text-2xl lg:text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                          {badge.icon}
          </div>
                        <h3 className="text-white font-bold text-xs lg:text-sm mb-1">
                          {badge.title}
                        </h3>
                        <p className="text-gray-400 text-xs">
                          {badge.subtitle}
                        </p>
              </motion.div>
                    ))}
                  </div>
              </motion.div>
            </div>
          </div>
          </div>

          

          {/* Scroll Indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex flex-col items-center">
              <span className="text-white/60 text-sm mb-2">Scroll to explore</span>
              <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center">
                <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-bounce" />
            </div>
          </div>
              </div>
        </section>

        {/* Main Content Area with Seamless Flow */}
        <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50">
          
          {/* Featured Collections */}
          <div className="w-full">
            <FeaturedCollections />
            </div>
        
        {/* Flash Sales Section */}
        {activeFlashSales.length > 0 && (
          <section className="py-8 md:py-10 w-full bg-gradient-to-br from-red-500/5 via-pink-500/5 to-orange-500/5 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-400/10 rounded-full blur-3xl"></div>
            
            <div className="w-full px-4 lg:px-12 xl:px-16 relative">
              <div className="max-w-screen-2xl mx-auto">
                                {/* Compact Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
                  <div className="flex items-center gap-3 mb-4 sm:mb-0">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-pink-50 text-red-700 px-4 py-2 rounded-full text-sm font-medium shadow-sm">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ⚡
                      </motion.div>
                      {language === 'am' ? 'ፍላሽ ሽያጭ' : 'Flash Sales'}
                    </div>
                    {activeFlashSales.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-lg px-4 py-2 shadow-sm border border-white/20">
                        <span className="text-xs text-gray-600 font-medium">Ends in:</span>
                        <CountdownTimer 
                          endTime={activeFlashSales[0].end_time} 
                          className="text-sm font-bold text-red-600"
                        />
                  </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Limited-time deals on premium products
                  </p>
                </div>

                {/* Navigation Controls */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">{language === 'am' ? 'በቀጥታ የሚሸጡ እቃዎች' : 'Live Deals'}</span>
            </div>
                  <div className="hidden md:flex items-center gap-3">
                  <button 
                      onClick={() => {
                        const container = document.getElementById('flash-scroll');
                        container?.scrollBy({ left: -320, behavior: 'smooth' });
                      }}
                      className="group p-3 rounded-full bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg"
                      aria-label="Scroll left"
                    >
                      <svg className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button 
                      onClick={() => {
                        const container = document.getElementById('flash-scroll');
                        container?.scrollBy({ left: 320, behavior: 'smooth' });
                      }}
                      className="group p-3 rounded-full bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg"
                      aria-label="Scroll right"
                    >
                      <svg className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  </div>
                </div>

                {/* Enhanced Product Cards */}
                <div className="relative">
                  <div 
                    id="flash-scroll"
                    className="flex gap-5 overflow-x-auto scrollbar-hide pb-4"
                    style={{ 
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {getAllFlashSaleProducts().slice(0, 10).map((flashProduct, index) => (
                        <motion.div
                          key={flashProduct.id}
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="flex-none w-80 md:w-72 group"
                      >
                        <Link href={`/products/${flashProduct.product.id}`}>
                           <div className="bg-white/95 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-white/20 group-hover:border-red-200 hover:ring-1 hover:ring-red-200 min-h-[340px] flex flex-col">
                             <div className="relative h-32 sm:h-36 overflow-hidden flex-shrink-0">
                              {flashProduct.product.product_images && flashProduct.product.product_images[0] ? (
                                <img
                                  src={cleanImageUrl(flashProduct.product.product_images[0].image_url)}
                                  alt={flashProduct.product.title}
                                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                  onError={(e) => {
                                    console.error('Flash sale image failed to load:', flashProduct.product.product_images[0].image_url);
                                    const target = e.target as HTMLImageElement;
                                    target.src = PLACEHOLDER_IMAGE;
                                  }}
                                  onLoad={() => {
                                    console.log('Flash sale image loaded successfully:', flashProduct.product.product_images[0].image_url);
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                  <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                            </div>
                              )}
                              
                              {/* Enhanced Discount Badge */}
                                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
                                <div className="relative">
                                      <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-lg">
                                    -{Math.round(((flashProduct.product.price - flashProduct.special_price) / flashProduct.product.price) * 100)}% OFF
                                  </div>
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                                </div>
                            </div>

                              {/* Hot Deal Badge */}
                                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                                    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg animate-pulse">
                                  🔥 HOT
                                </div>
                            </div>

                              {/* Overlay on hover */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              
                              {/* Quick action buttons */}
                              <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                                <button className="w-full bg-white/90 backdrop-blur-sm text-gray-900 py-2 px-4 rounded-full font-semibold text-sm shadow-lg hover:bg-white transition-colors">
                                  Quick Buy
                                </button>
                              </div>
                            </div>
                            
                            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-h-0">
                              {/* Top Section - Title */}
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                                  {flashProduct.product.title}
                                </h3>
                                  </div>
                              
                              {/* Bottom Section - Price, Badges, Timer */}
                              <div className="space-y-3">
                                {/* Price Section (single line for prices, save on its own line) */}
                                <div>
                                  <div className="flex items-baseline gap-2 min-w-0">
                                    <span className="text-xl sm:text-2xl font-extrabold text-red-600">
                                      {formatETB(flashProduct.special_price)}
                                    </span>
                                    <span className="text-xs sm:text-sm text-gray-500 line-through whitespace-nowrap">
                                      {formatETB(flashProduct.product.price)}
                                    </span>
                                  </div>
                                  <div className="mt-1 inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 10a7.5 7.5 0 1113.035 5.303l1.081 1.081a.75.75 0 11-1.06 1.06l-1.082-1.08A7.5 7.5 0 012.5 10zm7.5-4a.75.75 0 00-1.5 0v3.25H5a.75.75 0 000 1.5h3.5V14a.75.75 0 001.5 0V10.75H14a.75.75 0 000-1.5h-3.5V6z"/></svg>
                                    {(() => {
                                      const save = flashProduct.product.price - flashProduct.special_price;
                                      const percent = Math.round((save / flashProduct.product.price) * 100);
                                      return `Save ${formatETB(save)} (${percent}%)`;
                                    })()}
                                  </div>
                                </div>

                                {/* Deal Highlights (no fake numbers) */}
                                <div className="flex flex-wrap gap-2">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-red-50 text-red-600">
                                    🔥 Selling fast
                                  </span>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-amber-50 text-amber-700">
                                    ⏳ Limited time
                                  </span>
                                </div>

                                                                {/* Timer for individual product */}
                                <div className="flex items-center justify-between sm:justify-center gap-2 bg-gray-50 rounded-lg p-2">
                                  <span className="text-xs text-gray-600 font-medium">Ends in:</span>
                                  <CountdownTimer 
                                    endTime={flashProduct.parentSale?.end_time} 
                                    className="text-sm font-bold text-red-600"
                                  />
                  </div>
                </div>
              </div>
              </div>
                        </Link>
                      </motion.div>
                    ))}
                    
                                        {/* Enhanced View All Card - Show if there are additional flash sales or products */}
                    {(getAllFlashSaleProducts().length > 10 || activeFlashSales.length > 1) && (
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        viewport={{ once: true }}
                        className="flex-none w-80 md:w-72"
                      >
                        <Link href="/flash-sales">
                          <div className="bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 rounded-3xl border-2 border-dashed border-red-300 hover:border-red-500 transition-all duration-300 flex items-center justify-center group hover:shadow-xl transform hover:-translate-y-3" style={{ height: '280px' }}>
                            <div className="text-center p-4">
                      <motion.div
                                className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg"
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </motion.div>
                              <h3 className="text-lg font-bold text-gray-900 mb-2">View All Flash Sales</h3>
                              <p className="text-gray-600 text-sm mb-3">
                                Don't miss out on more amazing deals
                              </p>
                              <div className="text-red-600 text-sm font-semibold">
                                {getAllFlashSaleProducts().length > 10 
                                  ? `${getAllFlashSaleProducts().length - 10}+ More Deals →`
                                  : `${activeFlashSales.length - 1} More Flash Sale${activeFlashSales.length > 2 ? 's' : ''} →`
                                }
                            </div>
                          </div>
                          </div>
                        </Link>
                      </motion.div>
                    )}
                </div>

                  {/* Enhanced Gradient Fade Effects */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 via-white/50 to-transparent pointer-events-none z-10"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 via-white/50 to-transparent pointer-events-none z-10"></div>
                </div>
                  </div>
                </div>
          </section>
        )}

          {/* Category Grid */}
          <div className="w-full">
            <CategoryGrid />
              </div>

        {/* Featured Brands */}
          <section className="py-6 w-full bg-gradient-to-br from-slate-50 to-rose-50">
            <div className="w-full px-4 lg:px-12 xl:px-16">
              <div className="max-w-screen-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="flex items-center justify-between mb-10"
              >
                <div className="text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{t('landing.featuredBrands.title')}</h2>
                  <p className="text-xl text-gray-600 max-w-2xl">
                  {t('landing.featuredBrands.subtitle')}
                </p>
                </div>

                {/* Navigation Controls - Moved to top right */}
                <div className="hidden md:flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const container = document.getElementById('featured-brands-scroll');
                      container?.scrollBy({ left: -320, behavior: 'smooth' });
                    }}
                    className="group p-3 rounded-full bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg"
                    aria-label="Scroll left"
                  >
                    <svg className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => {
                      const container = document.getElementById('featured-brands-scroll');
                      container?.scrollBy({ left: 320, behavior: 'smooth' });
                    }}
                    className="group p-3 rounded-full bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg"
                    aria-label="Scroll right"
                  >
                    <svg className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </motion.div>

              <div className="relative">
                <div 
                  id="featured-brands-scroll"
                  className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {featuredBrands
                    .slice(0, 12).map((brand, index) => (
                    <motion.div
                      key={brand.seller_id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                        className="group flex-none w-80"
                  >
                                         <Link href={`/stores/${brand.seller_id}`}>
                       <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 h-[280px] flex flex-col">
                         {/* Banner */}
                         <div className="relative h-28">
                           {brand.store_settings.banner_url ? (
                             <img
                               src={cleanImageUrl(brand.store_settings.banner_url)}
                               alt="Store banner"
                               className="absolute inset-0 w-full h-full object-cover"
                               loading="lazy"
                             />
                           ) : (
                             <div className="w-full h-full bg-gradient-to-r from-red-500 to-pink-500" />
                           )}
                         </div>

                         {/* Logo overlapping banner */}
                         <div className="relative -mt-12 px-3">
                           <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
                            {brand.store_settings.logo_url ? (
                              <Image
                                src={cleanImageUrl(brand.store_settings.logo_url)}
                                alt={brand.store_settings.name}
                                fill
                               className="object-cover"
                               sizes="80px"
                              />
                            ) : (
                               <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-2xl font-bold">
                               {brand.store_settings.name?.[0]?.toUpperCase() || '?'}
                             </div>
                            )}
                          </div>
                         </div>
                                                   <div className="px-3 pt-4 pb-6 text-center flex-1 flex flex-col">
                            <div className="flex items-center justify-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-1">
                                {brand.store_settings.name}
                              </h3>
                              {brand.verification_status === 'verified' && (
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                              )}
                            </div>
                            
                            {/* Metrics Display - Likes and Ratings */}
                            <div className="mt-2 mb-3">
                              <div className="flex items-center justify-center gap-3 text-xs">
                                {/* Average Rating - Always show */}
                                <div className={`flex items-center gap-1 ${brand.avgRating > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="font-medium">
                                    {brand.avgRating > 0 ? brand.avgRating.toFixed(1) : '0.0'}
                                  </span>
                                </div>
                                
                                {/* Total Likes - Always show */}
                                <div className={`flex items-center gap-1 ${brand.totalLikes > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                  </svg>
                                  <span className="font-medium">
                                    {brand.totalLikes}
                                  </span>
                                </div>
                                
                                {/* Total Reviews - Always show */}
                                <div className={`flex items-center gap-1 ${brand.totalRatings > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  <span className="font-medium">
                                    {brand.totalRatings}
                                  </span>
                                </div>
                              </div>
                              

                            </div>
                            
                            {/* Show verification status or description - with flex-grow to fill space */}
                            <div className="flex-grow flex flex-col justify-center">
                              {brand.verification?.business_name ? (
                                <div className="text-center">
                                  <p className="text-xs text-green-600">✓ Verified Business</p>
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                    {brand.store_settings.description || (language === 'am' ? 'በመድረካችን ላይ የተረጋገጠ ሻጭ' : 'Trusted verified seller')}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 line-clamp-2">
                            {brand.store_settings.description || (language === 'am' ? 'በመድረካችን ላይ የተረጋገጠ ሻጭ' : 'Verified seller on our platform')}
                          </p>
                              )}
                            </div>
                            
                         <div className="flex justify-center mt-auto">
                           <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                             ⭐ Top Seller
                           </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Status Indicator */}
                <div className="flex justify-center items-center mt-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Featured Stores</span>
                  </div>
                </div>

                {/* Gradient Fade Effects */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
                </div>
              </div>
              </div>
          </section>

          {/* Trending Products */}
          <section className="py-8 w-full">
            <div className="w-full px-4 lg:px-12 xl:px-16">
              <div className="max-w-screen-2xl mx-auto">
                  <motion.div
                 initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                 viewport={{ once: true }}
                 className="flex items-center justify-between mb-12"
               >
                 <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{t('landing.trending.title')}</h2>
                <p className="text-xl text-gray-600 max-w-2xl">
                  {t('landing.trending.subtitle')}
                </p>
                  </div>
                 <div className="hidden md:flex items-center gap-4">
                <button 
                     onClick={() => {
                       const container = document.getElementById('trending-scroll');
                       container?.scrollBy({ left: -320, behavior: 'smooth' });
                     }}
                     className="p-3 rounded-full bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                     aria-label="Scroll left"
                   >
                     <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                     onClick={() => {
                       const container = document.getElementById('trending-scroll');
                       container?.scrollBy({ left: 320, behavior: 'smooth' });
                     }}
                     className="p-3 rounded-full bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                     aria-label="Scroll right"
                   >
                     <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                 </div>
               </motion.div>

               {/* Scrollable Container */}
               <div className="relative">
                 <div 
                   id="trending-scroll"
                   className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                   }}
                 >
                   {mostLikedProducts.slice(0, 12).map((product, index) => (
                      <motion.div
                        key={product.id}
                       initial={{ opacity: 0, x: 50 }}
                       whileInView={{ opacity: 1, x: 0 }}
                       transition={{ duration: 0.6, delay: index * 0.1 }}
                       viewport={{ once: true }}
                       className="flex-none w-80 md:w-72"
                     >
                       <EnhancedProductCard 
                         product={product}
                         index={index}
                         user={user}
                       />
                     </motion.div>
                   ))}
                   
                   {/* View All Card */}
                   <motion.div
                     initial={{ opacity: 0, x: 50 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     transition={{ duration: 0.6, delay: 0.8 }}
                     viewport={{ once: true }}
                     className="flex-none w-80 md:w-72"
                   >
                     <Link href="/products">
                       <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all duration-300 flex items-center justify-center group hover:shadow-lg" style={{ height: '300px' }}>
                         <div className="text-center p-4">
                           <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                             <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('landing.viewAllProducts')}</h3>
                            <p className="text-gray-600 text-xs">
                              {t('landing.exploreMore')}
                            </p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                </div>

                 {/* Gradient Fade Effects */}
                 <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none"></div>
                 <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                </div>
                  </div>
                </div>
          </section>

          {/* Testimonials */}
          <div className="w-full">
            <TestimonialsSection />
                    </div>

          {/* Mobile App Coming Soon */}
          <section className="py-8 w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
            <div className="w-full px-4 lg:px-12 xl:px-16">
              <div className="max-w-screen-2xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white text-sm font-semibold px-4 py-2 rounded-full mb-6">
                    {t('landing.app.badge')}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">
                    {t('landing.app.title')}
                  </h2>
                  <p className="text-xl text-gray-300 mb-8">
                    {t('landing.app.subtitle')}
                  </p>
                  
                  {/* App Store Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="flex items-center px-6 py-3 bg-gray-800 rounded-lg cursor-not-allowed opacity-75">
                      <svg className="w-8 h-8 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.5 1.32-.82 2.67-2.53 4.08M13 3.5c.73-.83 2.07-1.46 3.15-1.5.17 1.37-.37 2.74-1.08 3.69-.73.87-1.96 1.5-3.07 1.45-.18-1.33.35-2.69 1-3.64z"/>
                        </svg>
                        <div>
                        <div className="text-xs text-gray-400">Coming soon on</div>
                          <div className="text-sm font-semibold">App Store</div>
                        </div>
                      </div>
                    <div className="flex items-center px-6 py-3 bg-gray-800 rounded-lg cursor-not-allowed opacity-75">
                      <svg className="w-8 h-8 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                        </svg>
                        <div>
                        <div className="text-xs text-gray-400">Coming soon on</div>
                          <div className="text-sm font-semibold">Google Play</div>
                        </div>
                      </div>
                  </div>

                  {/* Notify Me Form */}
                  <div>
                    <p className="text-sm text-gray-400 mb-4">
                      Be the first to know when our app launches!
                    </p>
                    <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          placeholder="Enter your email"
                          value={notifyEmail}
                          onChange={(e) => setNotifyEmail(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500 text-white placeholder-gray-400"
                          disabled={subscriptionLoading}
                        required
                        />
                        <button
                          type="submit"
                          disabled={subscriptionLoading}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-lg hover:from-red-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {subscriptionLoading ? 'Subscribing...' : 'Notify Me'}
                        </button>
                    </form>
                      </div>
                </motion.div>

                {/* Phone Mockup */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="relative"
                >
                  <div className="relative mx-auto w-64 h-96 bg-gray-800 rounded-3xl p-2 shadow-2xl">
                    <div className="w-full h-full bg-gray-900 rounded-2xl overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-600/20 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl mb-4">📱</div>
                          <div className="text-white text-lg font-semibold mb-2">AVRIO</div>
                          <div className="text-gray-400 text-sm">Coming Soon</div>
                  </div>
                </div>
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl"></div>
                      </div>
                    </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500/20 rounded-full animate-ping"></div>
                  <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-amber-400/30 rounded-full animate-pulse"></div>
                </motion.div>
                  </div>
                </div>
              </div>
          </section>

          {/* Newsletter */}
          <div className="w-full">
            <NewsletterSection />
          </div>
          
          </div>

        {/* Footer Section */}
        <footer className="relative py-12 w-full border-t border-gray-800">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black">
            <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8 px-4 lg:px-12 xl:px-16">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">AVRIO</h3>
                <p className="text-gray-400 text-sm">
                  Your premier destination for Ethiopian fashion and lifestyle products.
                </p>
                <div className="flex space-x-4">
                  <a href="https://www.facebook.com/profile.php?id=61579174629597" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="https://www.instagram.com/avrio_shop/" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a href="https://t.me/avrioshop" className="text-gray-400 hover:text-white transition-colors" aria-label="Telegram" target="_blank" rel="noopener noreferrer">
                    <Send className="h-6 w-6" />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="TikTok">
                    <svg className="h-6 w-6" viewBox="0 0 640 640" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M544.5 273.9C500.5 274 457.5 260.3 421.7 234.7L421.7 413.4C421.7 446.5 411.6 478.8 392.7 506C373.8 533.2 347.1 554 316.1 565.6C285.1 577.2 251.3 579.1 219.2 570.9C187.1 562.7 158.3 545 136.5 520.1C114.7 495.2 101.2 464.1 97.5 431.2C93.8 398.3 100.4 365.1 116.1 336C131.8 306.9 156.1 283.3 185.7 268.3C215.3 253.3 248.6 247.8 281.4 252.3L281.4 342.2C266.4 337.5 250.3 337.6 235.4 342.6C220.5 347.6 207.5 357.2 198.4 369.9C189.3 382.6 184.4 398 184.5 413.8C184.6 429.6 189.7 444.8 199 457.5C208.3 470.2 221.4 479.6 236.4 484.4C251.4 489.2 267.5 489.2 282.4 484.3C297.3 479.4 310.4 469.9 319.6 457.2C328.8 444.5 333.8 429.1 333.8 413.4L333.8 64L421.8 64C421.7 71.4 422.4 78.9 423.7 86.2C426.8 102.5 433.1 118.1 442.4 131.9C451.7 145.7 463.7 157.5 477.6 166.5C497.5 179.6 520.8 186.6 544.6 186.6L544.6 274z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/products" className="text-gray-400 hover:text-white transition-colors">
                      Shop
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h3>
                <ul className="space-y-2">
                  {PRODUCT_CATEGORIES
                    .filter(category => 
                      ['Traditional Wear', 'Modern Fashion', 'Home & Living', 'Beauty & Personal Care']
                      .includes(category)
                    )
                    .map((category: string) => (
                      <li key={category}>
                        <Link 
                          href={`/products?category=${category.toLowerCase()}`}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {category}
                  </Link>
                </li>
                ))}
                <li>
                  <Link 
                    href="/products"
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    View All Categories
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact Us</h3>
              <ul className="space-y-2">
                <li className="text-gray-400">
                  <span className="block">Addis Ababa, Ethiopia</span>
                </li>
                <li>
                  <a href="tel:+251912841237" className="text-gray-400 hover:text-white transition-colors">
                    +251 91 284 1237
                  </a>
                </li>
                <li>
                  <a href={`mailto:${EMAIL_CONFIG.SUPPORT}`} className="text-gray-400 hover:text-white transition-colors">
                    {EMAIL_CONFIG.SUPPORT}
                  </a>
                </li>
              </ul>
            </div>

            {/* Security */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Security</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/security-policy" className="text-gray-400 hover:text-white transition-colors">
                    Security Policy
                  </Link>
                </li>
                <li>
                    <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                      Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/careers" className="text-gray-400 hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                  <li>
                    <Link href="/support" className="text-gray-400 hover:text-white transition-colors">
                      Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="max-w-screen-2xl mx-auto px-4 lg:px-12 xl:px-16 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} AVRIO. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                  <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Privacy Policy
                  </Link>
                  <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Terms of Service
                  </Link>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-red-500/5 rounded-full filter blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-500/5 rounded-full filter blur-3xl"></div>
          </div>
        </div>
      </footer>
    </div>
  </>
  );
}