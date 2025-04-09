'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { EMAIL_CONFIG } from '@/config/email';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Message sent successfully!');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="relative max-w-5xl mx-auto px-4 py-12">
        {/* Gradient Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-0 w-64 h-64 bg-red-500/10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-pink-500/10 rounded-full filter blur-3xl"></div>
        </div>

        <h1 className="text-5xl font-bold text-white mb-12 text-center">Contact Us</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
          {/* Contact Information */}
          <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-8">Get in Touch</h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-red-500/10 rounded-lg p-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Address</h3>
                  <p className="text-gray-300">Addis Ababa, Ethiopia</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-red-500/10 rounded-lg p-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Phone</h3>
                  <p className="text-gray-300">+251 91 123 4567</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-red-500/10 rounded-lg p-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Email</h3>
                  <p className="text-gray-300">{EMAIL_CONFIG.SUPPORT}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-200">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full bg-gray-700/50 border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full bg-gray-700/50 border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-200">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="mt-1 block w-full bg-gray-700/50 border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-200">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="mt-1 block w-full bg-gray-700/50 border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-3 px-4 rounded-md hover:from-red-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 