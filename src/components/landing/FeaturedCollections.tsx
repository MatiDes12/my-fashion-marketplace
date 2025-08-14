'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowRight } from 'lucide-react';
import { getPlaceholderImage } from '@/utils/placeholderImages';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/utils/translations';

interface Collection {
  id: string;
  title: string;
  description: string;
  image: string;
  price: string;
  itemCount: number;
  badge: string;
  href: string;
}

// moved into component to localize by language

export default function FeaturedCollections() {
  const { language } = useLanguage();
  const collections: Collection[] = [
    {
      id: '1',
      title: translations['collections.clothing.title'][language],
      description: translations['collections.clothing.description'][language],
      image: getPlaceholderImage('clothing'),
      price: translations['collections.clothing.priceFrom'][language],
      itemCount: 42,
      badge: translations['collections.badge.popular'][language],
      href: '/collections/clothing'
    },
    {
      id: '2',
      title: translations['collections.home.title'][language],
      description: translations['collections.home.description'][language],
      image: getPlaceholderImage('home-living'),
      price: translations['collections.home.priceFrom'][language],
      itemCount: 28,
      badge: translations['collections.badge.new'][language],
      href: '/collections/home-living'
    },
    {
      id: '3',
      title: translations['collections.traditional.title'][language],
      description: translations['collections.traditional.description'][language],
      image: getPlaceholderImage('traditional'),
      price: translations['collections.traditional.priceFrom'][language],
      itemCount: 18,
      badge: translations['collections.badge.heritage'][language],
      href: '/collections/clothing?category=Traditional%20Wear'
    }
  ];
  return (
    <section className="py-8 w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="w-full px-4 lg:px-12 xl:px-16">
        <div className="max-w-screen-2xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            {translations['landing.curated'][language]}
          </motion.div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {translations['landing.featuredCollections'][language]}
          </h2>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {translations['landing.featuredDesc'][language]}
          </p>
        </motion.div>

        {/* Collections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <Link href={collection.href} className="block">
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                  {/* Image Container */}
                  <div className="relative h-80 overflow-hidden">
                    <Image
                      src={collection.image}
                      alt={collection.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    
                    {/* Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white shadow-lg">
                        {collection.badge}
                      </span>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-4 left-4 right-4">
                        <motion.button
                          initial={{ opacity: 0, y: 20 }}
                          whileHover={{ opacity: 1, y: 0 }}
                          className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:from-red-500 hover:to-pink-500 transition-colors duration-300"
                        >
                          {translations['landing.shopNow'][language]}
                          <ArrowRight className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">
                      {collection.title}
                    </h3>
                    
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {collection.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-red-600">
                        {collection.price}
                      </span>
                      <span className="text-sm text-gray-500">
                        {collection.itemCount} {translations['landing.items'][language]}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-3 rounded-full font-semibold hover:from-red-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            {translations['landing.viewAllCollections'][language]}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
        </div>
      </div>
    </section>
  );
} 