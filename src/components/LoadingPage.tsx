import Image from 'next/image';

export default function LoadingPage() {
  return (
    <div className="fixed inset-0 w-full h-full z-[9999] flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="fixed inset-0 bg-white/30 dark:bg-gray-950/30 backdrop-blur-lg" />
      
      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-center p-8 rounded-2xl">
        {/* Logo and brand name */}
        <div className="text-center mb-12 animate-fadeIn">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
            AVRIO
          </h1>
        </div>

        {/* Custom loading animation */}
        <div className="relative w-64">
          {/* Loading bars */}
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex-1 h-16 bg-gradient-to-t from-red-500 to-pink-500 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>

          {/* Circular progress */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full loading-slide" />
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="mt-12 space-y-2 text-center">
          <p className="text-gray-600 dark:text-gray-300 animate-pulse text-sm">
            Loading amazing things...
          </p>
          <div className="flex items-center justify-center gap-1">
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );
} 