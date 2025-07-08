'use client';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="relative max-w-5xl mx-auto px-4 py-12">
        {/* Gradient Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-0 w-64 h-64 bg-red-500/10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-pink-500/10 rounded-full filter blur-3xl"></div>
        </div>

        <h1 className="text-5xl font-bold text-white mb-8 text-center">About AVRIO</h1>
        
        <div className="space-y-12 relative z-10">
          <section className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-4">Our Story</h2>
            <p className="text-gray-300 leading-relaxed">
              AVRIO is Ethiopia's premier online marketplace, connecting talented local artisans
              and sellers with customers across the country. We started with a simple mission:
              to make Ethiopian products accessible to everyone while supporting
              local businesses.
            </p>
          </section>

          <section className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
            <p className="text-gray-300 leading-relaxed">
              We aim to revolutionize the Ethiopian e-commerce landscape by providing a 
              platform that celebrates local craftsmanship while embracing modern technology. 
              Our goal is to make buying and selling online accessible, secure, and enjoyable 
              for everyone.
            </p>
          </section>

          <section className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-4">Why Choose AVRIO?</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
              <li className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Support local Ethiopian businesses</span>
              </li>
              <li className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secure shopping experience</span>
              </li>
              <li className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Authentic Ethiopian products</span>
              </li>
              <li className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Multiple payment options</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
} 