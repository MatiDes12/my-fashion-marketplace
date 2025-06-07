'use client';

import Image from 'next/image';

interface PaymentMethod {
  id: 'telebirr' | 'chapa';
  name: string;
  logo: string;
  description: string;
  isAvailable: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'telebirr',
    name: 'Telebirr (Coming Soon)',
    logo: '/images/payment-methods/telebirr-logo.png',
    description: 'Coming soon - Pay directly with your Telebirr mobile wallet',
    isAvailable: false
  },
  {
    id: 'chapa',
    name: 'Chapa',
    logo: '/images/payment-methods/chapa-logo.png',
    description: 'Pay with bank transfer, card, or mobile money',
    isAvailable: true
  }
];

interface Props {
  selectedMethod: string;
  onSelect: (method: string) => void;
}

export default function SubscriptionPaymentSelector({ selectedMethod, onSelect }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Payment Method</h3>
      <div className="grid grid-cols-1 gap-4">
        {PAYMENT_METHODS.map((method) => (
          <div
            key={method.id}
            onClick={() => method.isAvailable && onSelect(method.id)}
            className={`
              relative flex items-center p-4 cursor-pointer rounded-xl transition-all
              ${selectedMethod === method.id 
                ? 'bg-indigo-50 border-2 border-indigo-500 shadow-sm' 
                : method.isAvailable
                  ? 'bg-white border border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                  : 'bg-gray-50 border border-gray-200 opacity-75 cursor-not-allowed'
              }
            `}
          >
            <div className="flex items-center flex-1 min-w-0">
              <div className="h-16 w-16 relative flex-shrink-0">
                <Image
                  src={method.logo}
                  alt={method.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className={`text-lg font-semibold ${
                      selectedMethod === method.id ? 'text-indigo-700' : 'text-gray-900'
                    }`}>
                      {method.name}
                    </p>
                    {!method.isAvailable && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  {method.isAvailable && (
                    <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${selectedMethod === method.id 
                        ? 'border-indigo-500 bg-indigo-500' 
                        : 'border-gray-300'
                      }
                    `}>
                      {selectedMethod === method.id && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                  )}
                </div>
                <p className={`mt-1 text-sm ${
                  selectedMethod === method.id ? 'text-indigo-600' : 'text-gray-500'
                }`}>
                  {method.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 