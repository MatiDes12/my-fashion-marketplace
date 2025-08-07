'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getPlaceholderImage } from '@/utils/placeholderImages';

interface Collection {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  badge: string;
  itemCount: number;
  bgColor: string;
}

const collections: Collection[] = [
  {
    id: '1',
    title: 'Clothing Collection',
    description: 'Discover traditional Ethiopian wear and modern fashion pieces. From beautiful Habesha Kemis to contemporary dresses and accessories.',
    image: getPlaceholderImage('clothing'),
    href: '/collections/clothing',
    badge: 'Popular',
    itemCount: 42,
    bgColor: 'from-pink-500 to-rose-500'
  },
  {
    id: '2',
    title: 'Home & Living',
    description: 'Transform your space with beautiful furniture, home decor, and kitchen essentials crafted by local Ethiopian artisans.',
    image: getPlaceholderImage('home-living'),
    href: '/collections/home-living',
    badge: 'New',
    itemCount: 28,
    bgColor: 'from-blue-500 to-cyan-500'
  }
];

export default function CollectionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            All Collections
          </motion.div>
          
          <motion.h1 
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Explore Our Collections
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-600 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Discover carefully curated collections featuring the best of Ethiopian fashion, craftsmanship, and home essentials
          </motion.p>
        </div>

        {/* Collections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
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
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${collection.bgColor} opacity-20 group-hover:opacity-30 transition-opacity duration-300`} />
                    
                    {/* Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white text-gray-900 shadow-lg">
                        {collection.badge}
                      </span>
                    </div>

                    {/* Item Count */}
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-black/20 text-white backdrop-blur-sm">
                        {collection.itemCount} items
                      </span>
                    </div>

                    {/* Hover Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white text-gray-900 px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-xl"
                      >
                        Explore Collection
                        <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-amber-600 transition-colors duration-300">
                      {collection.title}
                    </h3>
                    
                    <p className="text-gray-600 leading-relaxed">
                      {collection.description}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Coming Soon Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-center"
        >
          <div className="max-w-2xl mx-auto">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold text-white mb-4">
              More Collections Coming Soon
            </h3>
            <p className="text-gray-300 mb-6">
              We're working on expanding our collection with more categories including electronics, 
              beauty products, and specialty Ethiopian crafts. Stay tuned for exciting updates!
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">Electronics</span>
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">Beauty & Health</span>
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">Books & Media</span>
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full">Sports & Outdoors</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}