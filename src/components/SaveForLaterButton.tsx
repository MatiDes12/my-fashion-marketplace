'use client';

import { useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { BookmarkIcon, BookmarkSlashIcon } from '@heroicons/react/24/outline';

interface SaveForLaterButtonProps {
  cartItemId: string;
  isSaved: boolean;
  onToggle: () => void;
}

export default function SaveForLaterButton({ cartItemId, isSaved, onToggle }: SaveForLaterButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponent();

  const handleToggle = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/cart/save-for-later', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartItemId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        onToggle();
      } else {
        toast.error(data.error || 'Failed to update save for later status');
      }
    } catch (error) {
      console.error('Error toggling save for later:', error);
      toast.error('Failed to update save for later status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        isSaved
          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isSaved ? (
        <BookmarkSlashIcon className="h-4 w-4" />
      ) : (
        <BookmarkIcon className="h-4 w-4" />
      )}
      {isSaved ? 'Remove from Saved' : 'Save for Later'}
    </button>
  );
}
