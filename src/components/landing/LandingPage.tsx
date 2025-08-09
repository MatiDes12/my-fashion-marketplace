'use client';

import { motion } from 'framer-motion';
import FeaturedCollections from './FeaturedCollections';
import CategoryGrid from './CategoryGrid';
import TestimonialsSection from './TestimonialsSection';
import NewsletterSection from './NewsletterSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section Placeholder - This will be replaced by your existing hero */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center"
      >
        <div className="text-center text-white">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="block">Discover Your</span>
            <span className="block bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              Perfect Style
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Welcome to AvrioxShop - where fashion meets elegance. Explore our curated collections and find your unique style.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105">
              Shop Collection
            </button>
            <button className="px-8 py-4 border-2 border-white text-white rounded-full font-semibold hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105">
              View Lookbook
            </button>
          </div>
        </div>
      </motion.div>

      {/* Featured Collections Section */}
      <FeaturedCollections />

      {/* Category Grid Section */}
      <CategoryGrid />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Newsletter Section */}
      <NewsletterSection />
    </div>
  );
} 