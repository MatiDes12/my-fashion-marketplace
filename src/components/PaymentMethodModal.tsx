'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { CartItem, SellerOrder } from '@/types/cart';

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
  onSelectMethod: (methodId: string, sellerId: string) => void;
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
                    Select Payment Method
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

                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          const sellersWithoutSettings = sellers.filter(s => !s.hasPaymentSettings);
                          if (sellersWithoutSettings.length > 0) {
                            toast.error(`Some sellers haven't set up ${method.name} payments yet: ${
                              sellersWithoutSettings.map(s => s.name).join(', ')
                            }`);
                            return;
                          }
                          onSelectMethod(method.id, sellers[0].id);
                        }}
                        disabled={!method.isAvailable || isProcessing}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border ${
                          method.isAvailable 
                            ? 'hover:bg-gray-50 border-gray-200' 
                            : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 relative">
                            <Image
                              src={method.logo}
                              alt={method.name}
                              fill
                              className="object-contain"
                            />
                          </div>
                          <span className="font-medium text-gray-900">{method.name}</span>
                        </div>
                        {!method.isAvailable && (
                          <span className="text-sm text-gray-500">Coming Soon</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 