'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PAYMENT_METHODS } from '@/utils/constants';

type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

interface PaymentMethodSelectorProps {
  onSelect: (method: PaymentMethod) => void;
  selected?: PaymentMethod;
}

export default function PaymentMethodSelector({ onSelect, selected }: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(selected || PAYMENT_METHODS.TELEBIRR);

  const handleSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    onSelect(method);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">የክፍያ መንገድ ይምረጡ / Select Payment Method</h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Telebirr */}
        <button
          onClick={() => handleSelect(PAYMENT_METHODS.TELEBIRR)}
          className={`relative p-4 rounded-lg border ${
            selectedMethod === PAYMENT_METHODS.TELEBIRR
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Image
              src="/payment-icons/telebirr.png"
              alt="Telebirr"
              width={40}
              height={40}
              className="rounded"
            />
            <span className="ml-3 font-medium">Telebirr</span>
          </div>
        </button>

        {/* CBE */}
        <button
          onClick={() => handleSelect(PAYMENT_METHODS.CBE)}
          className={`relative p-4 rounded-lg border ${
            selectedMethod === PAYMENT_METHODS.CBE
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Image
              src="/payment-icons/cbe.png"
              alt="CBE"
              width={40}
              height={40}
              className="rounded"
            />
            <span className="ml-3 font-medium">CBE Bank</span>
          </div>
        </button>

        {/* Amole */}
        <button
          onClick={() => handleSelect(PAYMENT_METHODS.AMOLE)}
          className={`relative p-4 rounded-lg border ${
            selectedMethod === PAYMENT_METHODS.AMOLE
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Image
              src="/payment-icons/amole.png"
              alt="Amole"
              width={40}
              height={40}
              className="rounded"
            />
            <span className="ml-3 font-medium">Amole</span>
          </div>
        </button>

        {/* Cash on Delivery */}
        <button
          onClick={() => handleSelect(PAYMENT_METHODS.CASH_ON_DELIVERY)}
          className={`relative p-4 rounded-lg border ${
            selectedMethod === PAYMENT_METHODS.CASH_ON_DELIVERY
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <span className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            <span className="ml-3 font-medium">ሲደርስ የሚከፈል / Cash on Delivery</span>
          </div>
        </button>
      </div>
    </div>
  );
} 