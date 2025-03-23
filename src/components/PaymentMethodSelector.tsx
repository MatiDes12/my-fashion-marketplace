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
              />
              <span className="ml-3 font-medium">{method.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 