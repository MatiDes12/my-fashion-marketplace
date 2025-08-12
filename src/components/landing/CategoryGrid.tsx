'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/utils/translations';
import Link from 'next/link';

const stylePreferences = [
  {
    id: 'minimalist',
    title: 'Minimalist',
    icon: '—',
    description: 'Clean lines and simple designs',
    href: '/products?style=minimalist'
  },
  {
    id: 'bohemian',
    title: 'Bohemian',
    icon: '❋',
    description: 'Free-spirited and artistic',
    href: '/products?style=bohemian'
  },
  {
    id: 'streetwear',
    title: 'Streetwear',
    icon: '⚡',
    description: 'Urban and contemporary',
    href: '/products?style=streetwear'
  },
  {
    id: 'vintage',
    title: 'Vintage',
    icon: '◐',
    description: 'Classic and timeless',
    href: '/products?style=vintage'
  },
  {
    id: 'luxury',
    title: 'Luxury',
    icon: '♔',
    description: 'Premium and sophisticated',
    href: '/products?style=luxury'
  },
  {
    id: 'casual',
    title: 'Casual',
    icon: '☕',
    description: 'Comfortable and relaxed',
    href: '/products?style=casual'
  }
];

const budgetRanges = [
  {
    id: 'budget',
    title: 'Budget-Friendly',
    range: 'Under ETB 500',
    href: '/products?price_max=500'
  },
  {
    id: 'mid-range',
    title: 'Mid-Range',
    range: 'ETB 500 - 2,000',
    href: '/products?price_min=500&price_max=2000'
  },
  {
    id: 'premium',
    title: 'Premium',
    range: 'ETB 2,000+',
    href: '/products?price_min=2000'
  }
];

const occasions = [
  {
    id: 'casual',
    title: 'Everyday Casual',
    href: '/products?occasion=casual'
  },
  {
    id: 'work',
    title: 'Professional',
    href: '/products?occasion=work'
  },
  {
    id: 'special',
    title: 'Special Events',
    href: '/products?occasion=special'
  },
  {
    id: 'traditional',
    title: 'Traditional',
    href: '/products?occasion=traditional'
  }
];

export default function CategoryGrid() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('Style');
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);

  const tabs = [
  { id: 'Style', label: translations['landing.tab.style'][language], color: 'text-red-600' },
  { id: 'Budget', label: translations['landing.tab.budget'][language], color: 'text-blue-600' },
  { id: 'Occasion', label: translations['landing.tab.occasion'][language], color: 'text-purple-600' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Style':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stylePreferences.map((style, index) => (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Link href={style.href}>
                  <div className={`
                    relative p-6 bg-white border-2 rounded-2xl text-center cursor-pointer transition-all duration-300 hover:shadow-lg group
                    ${selectedPreference === style.id ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => setSelectedPreference(style.id)}
                  >
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
                      {style.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{style.title}</h3>
                    <p className="text-xs text-gray-600">{style.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        );
      
      case 'Budget':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {budgetRanges.map((budget, index) => (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Link href={budget.href}>
                  <div className={`
                    p-6 bg-white border-2 rounded-2xl text-center cursor-pointer transition-all duration-300 hover:shadow-lg
                    ${selectedPreference === budget.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => setSelectedPreference(budget.id)}
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">{budget.title}</h3>
                    <p className="text-blue-600 font-medium">{budget.range}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        );
      
      case 'Occasion':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {occasions.map((occasion, index) => (
              <motion.div
                key={occasion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Link href={occasion.href}>
                  <div className={`
                    p-6 bg-white border-2 rounded-2xl text-center cursor-pointer transition-all duration-300 hover:shadow-lg
                    ${selectedPreference === occasion.id ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => setSelectedPreference(occasion.id)}
                  >
                    <h3 className="font-semibold text-gray-900">{occasion.title}</h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <section className="py-8 w-full">
      <div className="w-full px-4 lg:px-12 xl:px-16">
        <div className="max-w-screen-2xl mx-auto">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {translations['landing.findPerfect'][language]}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              {translations['landing.findPerfectDesc'][language]}
            </p>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex justify-center mb-12"
          >
            <div className="flex bg-gray-100 rounded-full p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedPreference(null);
                  }}
                  className={`
                    px-6 py-3 rounded-full font-medium transition-all duration-300
                    ${activeTab === tab.id 
                      ? 'bg-white text-gray-900 shadow-md' 
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            {renderContent()}
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Link href="/products">
              <button className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-4 rounded-full font-semibold hover:from-red-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                {translations['landing.exploreAll'][language]}
              </button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}