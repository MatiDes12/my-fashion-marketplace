'use client';

import { useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface ProductRatingProps {
  productId: string;
  initialRating?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
  onRatingSubmit?: () => void;
}

export default function ProductRating({ productId, initialRating, onRatingSubmit }: ProductRatingProps) {
  const [rating, setRating] = useState(initialRating?.rating || 0);
  const [comment, setComment] = useState(initialRating?.comment || '');
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponent();

  const handleRatingSubmit = async () => {
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to rate products');
        return;
      }

      if (initialRating) {
        // Update existing rating
        const { error } = await supabase
          .from('ratings')
          .update({
            rating,
            comment,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialRating.id);

        if (error) throw error;
        toast.success('Rating updated successfully');
      } else {
        // Create new rating
        const { error } = await supabase
          .from('ratings')
          .insert({
            user_id: session.user.id,
            product_id: productId,
            rating,
            comment
          });

        if (error) throw error;
        toast.success('Rating submitted successfully');
      }

      setComment('');
      onRatingSubmit?.();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="rating-section" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {initialRating ? 'Update Your Rating' : 'Rate this Product'}
      </h3>
      
      <div className="flex items-center mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="p-1 -ml-1 first:ml-0"
          >
            <svg
              className={`w-8 h-8 transition-colors duration-200 ${
                star <= (hoveredStar || rating)
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {rating ? `${rating} out of 5 stars` : 'Select rating'}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your thoughts about this product (optional)"
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
        rows={4}
      />

      <button
        onClick={handleRatingSubmit}
        disabled={!rating || isSubmitting}
        className={`mt-4 w-full px-4 py-2 text-white rounded-lg transition-all duration-200 ${
          rating && !isSubmitting
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  );
} 