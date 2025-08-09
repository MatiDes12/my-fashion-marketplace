'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Quote, Star, Users, ShoppingBag, Store, Heart, CheckCircle } from 'lucide-react';

interface Testimonial {
  id: number;
  name: string;
  location: string;
  avatar: string;
  rating: number;
  review: string;
  purchaseInfo: string;
  verified: boolean;
}

const customerTestimonials: Testimonial[] = [
  {
    id: 1,
    name: "Meron Tadesse",
    location: "Addis Ababa",
    avatar: "MT",
    rating: 5,
    review: "Great marketplace! I found everything I needed for my home. Fast delivery and quality products from local sellers.",
    purchaseInfo: "Purchased 8 items this month",
    verified: true
  },
  {
    id: 2,
    name: "Dawit Bekele",
    location: "Bahir Dar",
    avatar: "DB",
    rating: 5,
    review: "Amazing selection of products from Ethiopian sellers. Customer service is excellent and prices are very competitive.",
    purchaseInfo: "Regular customer for 6 months",
    verified: true
  },
  {
    id: 3,
    name: "Hanna Solomon",
    location: "Hawassa",
    avatar: "HS",
    rating: 5,
    review: "Love supporting local businesses through this platform. The variety is incredible and delivery is always on time.",
    purchaseInfo: "Purchased 15+ items",
    verified: true
  }
];

const marketplaceStats = [
  { label: "Happy Customers", value: "50K+", icon: Users },
  { label: "Local Sellers", value: "1K+", icon: Store },
  { label: "Products Sold", value: "100K+", icon: ShoppingBag },
  { label: "Satisfaction Rate", value: "98%", icon: Heart }
];

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % customerTestimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const section = document.getElementById('testimonials');
    if (section) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={16}
        className={`${index < rating ? 'text-red-500 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <section id="testimonials" className="py-8 w-full bg-gradient-to-br from-red-50 to-pink-50">
      <div className="w-full px-4 lg:px-12 xl:px-16">
        <div className="max-w-screen-2xl mx-auto">
          
          {/* Section Header - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              What Our Customers Say
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Trusted by thousands of Ethiopians for quality products and reliable service
            </p>
          </motion.div>

          {/* Stats Grid - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {marketplaceStats.map((stat, index) => (
              <div key={index} className="text-center bg-white rounded-xl p-4 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <stat.icon size={20} className="text-blue-600" />
                </div>
                <div className="font-bold text-xl text-gray-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Testimonials Carousel - More Compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <div className="relative h-64">
              {customerTestimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === currentIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* Quote Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Quote className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>

                  {/* Testimonial Content */}
                  <div className="text-center">
                    <blockquote className="text-lg text-gray-700 mb-4 leading-relaxed">
                      "{testimonial.review}"
                    </blockquote>

                    {/* Customer Info */}
                    <div className="flex items-center justify-center mb-3">
                      <div className={`w-12 h-12 rounded-full mr-4 flex items-center justify-center text-white font-semibold text-sm ${
                        testimonial.id === 1 ? 'bg-blue-500' : 
                        testimonial.id === 2 ? 'bg-green-500' : 'bg-purple-500'
                      }`}>
                        {testimonial.avatar}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center">
                          <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                          {testimonial.verified && (
                            <CheckCircle className="w-4 h-4 text-green-500 ml-1" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{testimonial.location}</p>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex justify-center mb-2">
                      {renderStars(testimonial.rating)}
                    </div>

                    {/* Purchase Info */}
                    <div className="inline-flex items-center px-3 py-1 bg-green-100 rounded-full">
                      <span className="text-xs text-green-700 font-medium">
                        {testimonial.purchaseInfo}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center mt-4">
              {customerTestimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full mx-1 transition-all duration-300 ${
                    index === currentIndex ? 'bg-blue-600 scale-125' : 'bg-gray-300'
                  }`}
                  aria-label={`View testimonial ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Trust Indicators - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-6"
          >
            <div className="flex flex-wrap justify-center items-center gap-6 text-gray-500">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-sm">Verified Reviews</span>
              </div>
              <div className="flex items-center">
                <ShoppingBag className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-sm">Secure Shopping</span>
              </div>
              <div className="flex items-center">
                <Heart className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-sm">Ethiopian Owned</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}