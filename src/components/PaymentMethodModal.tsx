'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { CartItem, SellerOrder } from '@/types/cart';
import PaymentMethodSelector from './PaymentMethodSelector';
import { PAYMENT_METHODS } from '@/utils/constants';
import { getTelebirrConfig, TelebirrPayment } from '@/lib/telebirr';

type PaymentMethodType = keyof typeof PAYMENT_METHODS;

interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  isAvailable: boolean;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    logo: '/images/telebirr-logo.png', // Add this image to your public folder
    isAvailable: true
  },
  {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    logo: '/images/cbe-logo.png', // Add this image to your public folder
    isAvailable: false
  },
  {
    id: 'paypal',
    name: 'PayPal',
    logo: '/images/paypal-logo.png', // Add this image to your public folder
    isAvailable: false
  }
];

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (methodId: PaymentMethodType, phoneNumber?: string) => Promise<void>;
  isProcessing: boolean;
  sellers: SellerOrder[];
}

export default function PaymentMethodModal({
  isOpen,
  onClose,
  onSelectMethod,
  isProcessing,
  sellers
}: PaymentMethodModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpReference, setOtpReference] = useState<string | null>(null);
  const [step, setStep] = useState<'method' | 'phone' | 'otp'>('method');
  const [error, setError] = useState('');
  const [localProcessing, setLocalProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    if (selectedMethod === 'TELEBIRR') {
      try {
        setLocalProcessing(true);
        const response = await fetch('/api/telebirr/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: sellers.reduce((sum, seller) => sum + seller.total, 0),
            description: `Order payment for ${sellers.length} seller(s)`,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to initialize payment');
        }

        // Redirect to Telebirr payment page
        window.location.href = data.paymentUrl;

      } catch (error) {
        console.error('Payment error:', error);
        setError(error instanceof Error ? error.message : 'Payment failed');
      } finally {
        setLocalProcessing(false);
      }
      return;
    }

    // Handle other payment methods...
    try {
      await onSelectMethod(selectedMethod);
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                    {step === 'method' ? 'Select Payment Method' : 
                     step === 'phone' ? 'Enter Phone Number' : 'Enter OTP Code'}
                  </Dialog.Title>

                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Order Summary</h4>
                    {sellers.map((seller) => (
                      <div key={seller.id} className="mb-4 border rounded-lg p-4">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium">{seller.name}</span>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subtotal</span>
                            <span>ETB {seller.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Platform Fee (5%)</span>
                            <span>ETB {seller.platformFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Service Fee (2%)</span>
                            <span>ETB {seller.serviceFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">VAT (15%)</span>
                            <span>ETB {seller.ethiopiaTax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Delivery Fee</span>
                            <span>ETB {seller.deliveryFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t font-medium">
                            <span>Total</span>
                            <span>ETB {seller.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between font-medium text-lg">
                        <span>Grand Total</span>
                        <span>ETB {sellers.reduce((sum, seller) => sum + seller.total, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {step === 'method' ? (
                    <>
                      <PaymentMethodSelector
                        onSelect={(method) => {
                          setSelectedMethod(method);
                          setError('');
                        }}
                        selected={selectedMethod}
                      />
                      {error && (
                        <div className="mt-4 text-red-500">
                          {error}
                        </div>
                      )}
                      <div className="mt-6">
                        <button
                          onClick={handleSubmit}
                          disabled={!selectedMethod || isProcessing}
                          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Continue'}
                        </button>
                      </div>
                    </>
                  ) : step === 'phone' ? (
                    <div className="space-y-4">
                      <div>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            setError('');
                          }}
                          placeholder="e.g., 0911234567"
                          className="w-full px-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Enter your Telebirr registered phone number
                        </p>
                      </div>
                      {error && (
                        <div className="text-red-500">{error}</div>
                      )}
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => setStep('method')}
                          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!phoneNumber || isProcessing || localProcessing}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing || localProcessing ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value);
                            setError('');
                          }}
                          placeholder="Enter OTP code"
                          className="w-full px-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Enter the OTP code sent to {phoneNumber}
                        </p>
                      </div>
                      {error && (
                        <div className="text-red-500">{error}</div>
                      )}
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => setStep('phone')}
                          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!otpCode || isProcessing || localProcessing}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing || localProcessing ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 