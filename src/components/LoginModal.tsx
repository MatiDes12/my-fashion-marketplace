'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { XMarkIcon, UserCircleIcon, ShoppingBagIcon, HeartIcon } from '@heroicons/react/24/outline';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actionType?: 'rate' | 'like' | 'cart' | 'generic';
}

export default function LoginModal({ 
  isOpen, 
  onClose, 
  title,
  message,
  actionType = 'generic'
}: LoginModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Store the current URL to redirect back after login
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentPath);
    
    router.push('/login');
    onClose();
  };

  const handleSignup = async () => {
    setIsLoading(true);
    // Store the current URL to redirect back after signup
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentPath);
    
    router.push('/signup');
    onClose();
  };

  const getIcon = () => {
    switch (actionType) {
      case 'rate':
        return <div className="h-12 w-12 mx-auto mb-4 text-yellow-500">⭐</div>;
      case 'like':
        return <HeartIcon className="h-12 w-12 mx-auto mb-4 text-red-500" />;
      case 'cart':
        return <ShoppingBagIcon className="h-12 w-12 mx-auto mb-4 text-green-500" />;
      default:
        return <UserCircleIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />;
    }
  };

  const getDefaultTitle = () => {
    switch (actionType) {
      case 'rate':
        return 'Login to Rate This Product';
      case 'like':
        return 'Login to Save to Favorites';
      case 'cart':
        return 'Login to Add to Cart';
      default:
        return 'Login Required';
    }
  };

  const getDefaultMessage = () => {
    switch (actionType) {
      case 'rate':
        return 'Share your experience with other shoppers by rating and reviewing this product.';
      case 'like':
        return 'Create an account to save your favorite products and build your wishlist.';
      case 'cart':
        return 'Create an account to add items to your cart and complete your purchase.';
      default:
        return 'You need to be logged in to perform this action.';
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {title || getDefaultTitle()}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="text-center">
                  {getIcon()}
                  
                  <p className="text-sm text-gray-500 mb-6">
                    {message || getDefaultMessage()}
                  </p>

                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleLogin}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      Login to Continue
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleSignup}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Create New Account
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                      Join thousands of shoppers who trust our platform for secure and convenient shopping.
                    </p>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
