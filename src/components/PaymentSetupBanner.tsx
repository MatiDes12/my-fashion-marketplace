'use client';

import Link from 'next/link';
import { CreditCardIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

interface PaymentSetupBannerProps {
  variant?: 'warning' | 'error' | 'info';
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export default function PaymentSetupBanner({
  variant = 'warning',
  title,
  description,
  actionText,
  actionHref = '/dashboard/payment-settings',
  showIcon = true,
  dismissible = false,
  onDismiss,
  className = ''
}: PaymentSetupBannerProps) {
  const { t } = useLanguage();

  const variantStyles = {
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      description: 'text-yellow-700',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      closeButton: 'text-yellow-400 hover:text-yellow-500'
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      description: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      closeButton: 'text-red-400 hover:text-red-500'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      description: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      closeButton: 'text-blue-400 hover:text-blue-500'
    }
  };

  const styles = variantStyles[variant];
  
  const defaultTitle = variant === 'error' 
    ? 'Payment Setup Required' 
    : variant === 'warning' 
      ? 'Payment Methods Not Configured'
      : 'Set Up Payment Methods';
      
  const defaultDescription = variant === 'error'
    ? 'Please set up your payment methods to start selling products and accepting orders.'
    : variant === 'warning'
      ? 'Add payment methods to start accepting orders from customers.'
      : 'Configure your preferred payment methods to begin selling.';
      
  const defaultActionText = variant === 'error'
    ? 'Set Up Payments Now'
    : 'Configure Payment Methods';

  const IconComponent = variant === 'error' ? ExclamationTriangleIcon : CreditCardIcon;

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex">
        {showIcon && (
          <div className="flex-shrink-0">
            <IconComponent className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
          </div>
        )}
        <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {title || defaultTitle}
          </h3>
          <div className={`mt-2 text-sm ${styles.description}`}>
            <p>{description || defaultDescription}</p>
          </div>
          <div className="mt-4">
            <div className="flex">
              <Link
                href={actionHref}
                className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${styles.button}`}
              >
                {actionText || defaultActionText}
              </Link>
            </div>
          </div>
        </div>
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.closeButton}`}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
