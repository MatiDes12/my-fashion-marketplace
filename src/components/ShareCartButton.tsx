'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ShareIcon, EnvelopeIcon, PaperAirplaneIcon, LinkIcon } from '@heroicons/react/24/outline';

interface ShareCartButtonProps {
  cartItemsCount: number;
}

export default function ShareCartButton({ cartItemsCount }: ShareCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('Check out my shopping cart!');
  const [shareMethod, setShareMethod] = useState<'link' | 'email' | 'telegram'>('link');

  const handleShare = async () => {
    if (shareMethod === 'email' && !recipientEmail) {
      toast.error('Please enter recipient email');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/cart/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipientEmail, 
          recipientName,
          message, 
          shareMethod 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (shareMethod === 'email') {
          toast.success('Cart shared via email successfully!');
        } else if (shareMethod === 'telegram') {
          // Open Telegram share URL
          window.open(data.telegramUrl, '_blank');
          toast.success('Opening Telegram...');
        } else {
          // Copy link to clipboard
          await navigator.clipboard.writeText(data.shareUrl);
          toast.success('Share link copied to clipboard!');
        }
        
        setShowModal(false);
        setRecipientEmail('');
        setRecipientName('');
        setMessage('Check out my shopping cart!');
        setShareMethod('link');
      } else {
        toast.error(data.error || 'Failed to share cart');
      }
    } catch (error) {
      console.error('Error sharing cart:', error);
      toast.error('Failed to share cart');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/cart/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipientEmail: '', 
          recipientName: '',
          message, 
          shareMethod: 'link' 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await navigator.clipboard.writeText(data.shareUrl);
        toast.success('Share link copied to clipboard!');
        setShowModal(false);
      } else {
        toast.error(data.error || 'Failed to generate share link');
      }
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Failed to copy share link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={cartItemsCount === 0}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShareIcon className="h-4 w-4" />
        Share Cart ({cartItemsCount} items)
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Your Cart</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Share Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Share Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShareMethod('link')}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                      shareMethod === 'link'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <LinkIcon className="h-5 w-5 mb-1" />
                    <span className="text-xs">Link</span>
                  </button>
                  <button
                    onClick={() => setShareMethod('email')}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                      shareMethod === 'email'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <EnvelopeIcon className="h-5 w-5 mb-1" />
                    <span className="text-xs">Email</span>
                  </button>
                  <button
                    onClick={() => setShareMethod('telegram')}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                      shareMethod === 'telegram'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <PaperAirplaneIcon className="h-5 w-5 mb-1" />
                    <span className="text-xs">Telegram</span>
                  </button>
                </div>
              </div>

              {/* Recipient Details (for email) */}
              {shareMethod === 'email' && (
                <>
                  <div>
                    <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      id="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Friend's name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient Email *
                    </label>
                    <input
                      type="email"
                      id="recipientEmail"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </>
              )}

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Add a personal message..."
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>How it works:</strong> When someone uses your shared cart, they can purchase the items and the order will be saved to your account. Perfect for gift purchases!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleShare}
                  disabled={isLoading || (shareMethod === 'email' && !recipientEmail)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {shareMethod === 'email' ? 'Sending...' : shareMethod === 'telegram' ? 'Opening...' : 'Generating...'}
                    </div>
                  ) : (
                    <>
                      {shareMethod === 'email' && 'Send Email'}
                      {shareMethod === 'telegram' && 'Open Telegram'}
                      {shareMethod === 'link' && 'Copy Link'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
