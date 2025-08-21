'use client';

import Image from 'next/image';
import { PAYMENT_METHODS } from '@/utils/constants';

type PaymentMethodType = keyof typeof PAYMENT_METHODS;

interface PaymentMethodSelectorProps {
  onSelect: (method: PaymentMethodType) => void;
  selected: PaymentMethodType | null;
  paymentSettings: any;
}

export default function PaymentMethodSelector({ onSelect, selected, paymentSettings }: PaymentMethodSelectorProps) {
  // Filter available payment methods
  const availablePaymentMethods = Object.values(PAYMENT_METHODS).filter(method => 
    method.id === 'CASH' || // Cash is always available
    (method.id === 'TELEBIRR' && paymentSettings?.telebirr_settings?.is_active) ||
    (method.id === 'CBE' && paymentSettings?.cbe_birr_settings?.is_active) ||
    (method.id === 'AMOLE' && paymentSettings?.amole_settings?.is_active) ||
    (method.id === 'CHAPA' && paymentSettings?.chapa_settings?.is_active)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">የክፍያ መንገድ ይምረጡ / Select Payment Method</h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {availablePaymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id as PaymentMethodType)}
            className={`relative p-4 rounded-lg border ${
              selected === method.id
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <Image
                src={method.logo}
                alt={method.name}
                width={40}
                height={40}
                className="rounded"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  
                  if (parent) {
                    // Special handling for Stripe logo - try SVG fallback first
                    if (method.id === 'STRIPE') {
                      // Try to load the SVG fallback
                      const img = document.createElement('img') as HTMLImageElement;
                      img.onload = () => {
                        target.src = '/images/payment-methods/stripe.svg';
                      };
                      img.onerror = () => {
                        // If SVG also fails, show generic payment icon
                        target.style.display = 'none';
                        parent.innerHTML = `
                          <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded">
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                            </svg>
                          </div>
                        `;
                      };
                      img.src = '/images/payment-methods/stripe.svg';
                    } else {
                      // For other payment methods, show generic payment icon
                      target.style.display = 'none';
                      parent.innerHTML = `
                        <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded">
                          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                          </svg>
                        </div>
                      `;
                    }
                  }
                }}
              />
              <span className="ml-3 font-medium">{method.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 