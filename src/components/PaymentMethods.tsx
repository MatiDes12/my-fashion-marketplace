'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  description: string;
  category: 'primary' | 'secondary';
  isAvailable: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'cash',
    name: 'Cash on Delivery',
    logo: '/images/payment-methods/cash-icon.jpg',
    description: 'Pay when you receive your order',
    category: 'primary',
    isAvailable: true
  },
  {
    id: 'stripe',
    name: 'Stripe',
    logo: '/images/payment-methods/stripe.svg',
    description: 'Secure credit/debit card payments',
    category: 'primary',
    isAvailable: true
  },
  {
    id: 'chapa',
    name: 'Chapa',
    logo: '/images/payment-methods/chapa-logo.png',
    description: 'Bank transfer, card & mobile money',
    category: 'primary',
    isAvailable: true
  },
  {
    id: 'telebirr',
    name: 'Telebirr',
    logo: '/images/payment-methods/Telebirr-logo.png',
    description: 'Ethio Telecom mobile money',
    category: 'secondary',
    isAvailable: true
  },
  {
    id: 'cbe-birr',
    name: 'CBE Birr',
    logo: '/images/payment-methods/cbe.jpg',
    description: 'Commercial Bank of Ethiopia',
    category: 'secondary',
    isAvailable: true
  },
  {
    id: 'mpesa',
    name: 'M-Pesa',
    logo: '/images/payment-methods/mpesa-logo.png',
    description: 'Safaricom mobile money',
    category: 'secondary',
    isAvailable: true
  },
  {
    id: 'kacha',
    name: 'Kacha',
    logo: '/images/payment-methods/kacha.png',
    description: 'Digital payment solution',
    category: 'secondary',
    isAvailable: true
  }
];

export default function PaymentMethods() {
  const { t, language } = useLanguage();

  const primaryMethods = PAYMENT_METHODS.filter(method => method.category === 'primary');
  const secondaryMethods = PAYMENT_METHODS.filter(method => method.category === 'secondary');

  return (
    <section className="py-16 w-full bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="w-full px-4 lg:px-12 xl:px-16">
        <div className="max-w-screen-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
                         <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
               {t('paymentMethods.title')}
             </h2>
             <p className="text-xl text-gray-600 max-w-3xl mx-auto">
               {t('paymentMethods.subtitle')}
             </p>
          </motion.div>

          {/* Primary Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mb-12"
          >
                         <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
               {t('paymentMethods.primary.title')}
             </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {primaryMethods.map((method, index) => (
                <motion.div
                  key={method.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative w-20 h-20 mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Image
                          src={method.logo}
                          alt={method.name}
                          fill
                          className="object-contain"
                          sizes="80px"
                        />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        {method.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {method.description}
                      </p>
                      {method.isAvailable && (
                        <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          {t('paymentMethods.available')}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Secondary Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
                         <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
               {t('paymentMethods.secondary.title')}
             </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {secondaryMethods.map((method, index) => (
                <motion.div
                  key={method.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative w-16 h-16 mb-3 group-hover:scale-110 transition-transform duration-300">
                        <Image
                          src={method.logo}
                          alt={method.name}
                          fill
                          className="object-contain"
                          sizes="64px"
                        />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {method.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2">
                        {method.description}
                      </p>
                      {method.isAvailable && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1"></div>
                          {t('paymentMethods.available')}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Security Badge */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 rounded-2xl border border-green-200">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">
                  {t('paymentMethods.security.title')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('paymentMethods.security.subtitle')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
