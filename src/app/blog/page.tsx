'use client';

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="relative max-w-5xl mx-auto px-4 py-12">
        {/* Gradient Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-0 w-64 h-64 bg-red-500/10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-pink-500/10 rounded-full filter blur-3xl"></div>
        </div>

        <h1 className="text-5xl font-bold text-white mb-12 text-center">AVRIO Blog</h1>
        
        <div className="relative z-10 bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm max-w-2xl mx-auto">
          <div className="text-center">
            <svg 
              className="w-16 h-16 text-red-500 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" 
              />
            </svg>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Coming Soon!
            </h2>
            <p className="text-gray-300 leading-relaxed">
              We're working on bringing you interesting articles about Ethiopian fashion, 
              culture, and shopping tips. Stay tuned for updates about the latest trends, 
              local artisans, and shopping guides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 