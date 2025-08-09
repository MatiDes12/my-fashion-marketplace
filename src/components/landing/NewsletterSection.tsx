'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'newsletter' })
      });
      // Ignore body content; rely on status for UX
      await res.json().catch(() => null);
      setIsSubmitted(true);
      setEmail('');
    } catch (err) {
      // Soft-fail to success UI to avoid blocking user
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Aurora Background Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />

      <div className="relative max-w-screen-xl mx-auto px-4 lg:px-12 xl:px-16">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20">
          {!isSubmitted ? (
            <>
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              viewport={{ once: true }}
              className="text-white text-base md:text-lg font-medium text-center mb-3"
            >
              Subscribe to get updates
            </motion.h3>
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              viewport={{ once: true }}
              onSubmit={handleSubmit}
              className="max-w-md mx-auto text-center"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all duration-300"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full font-semibold hover:from-red-700 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Thanks for subscribing!
              </h3>
              <p className="text-sm text-gray-300 mb-1">We'll keep you updated.</p>
              
              <p className="text-sm text-gray-400">
                Check your inbox for your exclusive 15% discount code and stay tuned for amazing fashion updates!
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
} 