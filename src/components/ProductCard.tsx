'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/utils/currency';
import { getProductMainImage } from '@/utils/imageUtils';
import { useRouter } from 'next/navigation';
import ProductImage from './ProductImage';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

type ProductCardProps = {
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    flash_sale_price?: number | null;
    category?: string;
    owner_id?: string;
    like_count?: number;
    users?: {
      id: string;
      full_name: string;
      email?: string;
      store_settings?: {
        name: string;
        logo_url: string;
      };
    } | null;
    product_images?: Array<{
      id: string;
      image_url: string;
      is_model_picture: boolean;
    }>;
  };
  showOwner?: boolean;
  showActions?: boolean;
  onDelete?: (id: string) => void;
};

export default function ProductCard({ product, showOwner = false, showActions = false, onDelete }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.like_count || 0);
  const [loading, setLoading] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponent();

  // Debug log to see what's in the product object
  useEffect(() => {
    console.log(`ProductCard for ${product.id}:`, {
      hasImages: !!product.product_images,
      imageCount: product.product_images?.length || 0,
      firstImageUrl: product.product_images?.[0]?.image_url,
      title: product.title,
      owner: product.users,
      owner_id: product.owner_id
    });
  }, [product]);

  // Check if user has liked the product
  useEffect(() => {
    const checkIfLiked = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('product_id', product.id)
        .single();

      setIsLiked(!!data);
    };

    checkIfLiked();
  }, [product.id]);

  // Add debug log
  useEffect(() => {
    console.log('ProductCard rendered with product:', {
      id: product.id,
      title: product.title,
      price: product.price,
      flash_sale_price: product.flash_sale_price
    });
  }, [product]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    
    try {
      setLikesLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please login to like products');
        router.push('/login');
        return;
      }

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', session.user.id)
          .eq('product_id', product.id);

        if (error) throw error;
        setLikeCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
        toast.success('Product removed from favorites');
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: session.user.id,
            product_id: product.id
          });

        if (error) throw error;
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
        toast.success('Product added to favorites');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like status');
    } finally {
      setLikesLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this product?')) {
      setLoading(true);
      onDelete(product.id);
    }
  };

  return (
    <div className="group relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative h-48 w-full overflow-hidden">
          <ProductImage 
            product={product} 
            alt={product.title}
            className="transform group-hover:scale-110 transition-transform duration-500" 
          />
          {product.category && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              {product.category}
            </span>
          )}
        </div>
      
        <div className="p-4">
          <h3 className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-1">
            {product.title}
          </h3>
          
          <p className="mt-1 text-sm text-gray-600 line-clamp-1">
            {product.description}
          </p>
          
          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-col">
              {product.flash_sale_price ? (
                <>
                  <span className="text-lg font-bold text-red-600">
                    {formatCurrency(product.flash_sale_price)}
                  </span>
                  <span className="text-xs text-gray-500 line-through">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-xs text-red-600 font-medium">
                    {Math.round(((product.price - product.flash_sale_price) / product.price) * 100)}% OFF
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
            
            <button 
              onClick={handleLike}
              disabled={likesLoading}
              className={`text-gray-400 hover:text-red-500 transition-all duration-300 transform hover:scale-110 
                ${likesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="relative">
                <svg 
                  className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-current' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                  />
                </svg>
                {likeCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-100 text-red-600 text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {likeCount}
                  </span>
                )}
                {likesLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </button>
          </div>
          
          <Link
            href={`/products/${product.id}?action=buy`}
            className="mt-3 w-full block text-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Buy Now
          </Link>
          
          {(showOwner || product.users) && (
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <Link 
                href={`/stores/${product.owner_id}`}
                className="flex items-center hover:text-indigo-600 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white">
                  {product.users?.store_settings?.name?.[0] || product.users?.full_name?.[0] || '?'}
                </div>
                <span className="ml-2 font-medium">
                  {product.users?.store_settings?.name || product.users?.full_name || 'Unknown seller'}
                </span>
              </Link>
            </div>
          )}
          
          {showActions && (
            <div className="mt-4 flex justify-end space-x-2">
              <Link
                href={`/dashboard/products/edit/${product.id}`}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Edit
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}