'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';

interface RatingProps {
  productId: string;
  initialRating?: number;
  totalRatings?: number;
  readonly?: boolean;
  onRatingSubmit?: (rating: number) => void;
}

export default function ProductRating({ 
  productId, 
  initialRating = 0, 
  totalRatings = 0,
  readonly = false,
  onRatingSubmit 
}: RatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    // Update local rating when initialRating prop changes
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    if (!readonly) {
      fetchUserRating();
    }
  }, [productId, readonly]);

  const fetchUserRating = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ratingData } = await supabase
      .from('ratings')
      .select('rating')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .single();

    if (ratingData) {
      setRating(ratingData.rating);
      setUserRating(ratingData.rating);
    }
  };

  const handleRating = async (value: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Handle not logged in state - maybe redirect to login or show modal
      alert('Please login to rate products');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: user.id,
          product_id: productId,
          rating: value,
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) throw error;

      setRating(value);
      setUserRating(value);
      if (onRatingSubmit) onRatingSubmit(value);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly || isSubmitting}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} 
                     ${isSubmitting ? 'opacity-50' : 'opacity-100'}`}
          onClick={() => !readonly && handleRating(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          {star <= (hover || rating) ? (
            <StarIcon className="h-5 w-5 text-yellow-400" />
          ) : (
            <StarOutlineIcon className="h-5 w-5 text-yellow-400" />
          )}
        </button>
      ))}
      {totalRatings > 0 && !readonly && userRating && (
        <span className="ml-2 text-sm text-gray-500">
          Your rating: {userRating}
        </span>
      )}
    </div>
  );
} 