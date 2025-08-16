'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import LoginModal from '@/components/LoginModal';

interface WishlistPopupProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  onSuccess: () => void;
}

export default function WishlistPopup({ 
  isOpen, 
  onClose, 
  productId, 
  productTitle, 
  onSuccess 
}: WishlistPopupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalType, setLoginModalType] = useState<'rate' | 'like' | 'cart' | 'generic'>('generic');
  const supabase = createClientComponent();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddToWishlist = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoginModalType('like');
        setShowLoginModal(true);
        return;
      }

      // Add to wishlist table
      const { error: wishlistError } = await supabase
        .from('wishlist')
        .insert({
          user_id: session.user.id,
          product_id: productId
        });

      if (wishlistError && wishlistError.code !== '23505') { // Ignore unique constraint violation
        throw wishlistError;
      }

      toast.success('Added to wishlist!');
      onSuccess();
      onClose();
      
      // Dispatch event to update wishlist count in navigation
      window.dispatchEvent(new CustomEvent('wishlist-updated'));
      
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Failed to add to wishlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLikeOnly = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoginModalType('like');
        setShowLoginModal(true);
        return;
      }

      // Add to likes table only
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          user_id: session.user.id,
          product_id: productId
        });

      if (likeError && likeError.code !== '23505') { // Ignore unique constraint violation
        throw likeError;
      }

      toast.success('Added to favorites!');
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('Error adding to likes:', error);
      toast.error('Failed to add to favorites');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const popupContent = (
    <>
      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        actionType={loginModalType}
      />
      
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[99999] flex items-center justify-center p-4" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Add to Wishlist?
          </h3>
          <p className="text-gray-600">
            Would you like to add "{productTitle}" to your wishlist for easy access later?
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAddToWishlist}
            disabled={isLoading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </span>
            ) : (
              'Yes, add to wishlist'
            )}
          </button>
          
          <button
            onClick={handleLikeOnly}
            disabled={isLoading}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </span>
            ) : (
              'No, just like it'
            )}
          </button>
          
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full text-gray-500 py-2 px-4 rounded-xl font-medium hover:text-gray-700 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>

        {/* Info text */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            <strong>Wishlist:</strong> Save for later viewing and easy access<br/>
            <strong>Like:</strong> Show appreciation and track favorites
          </p>
        </div>
        </div>
      </div>
    </>
  );

  // Use portal to render at document body level
  return createPortal(popupContent, document.body);
} 