'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function LoadingSpinner() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 w-full h-full flex items-center justify-center"
      style={{ 
        zIndex: 9999999,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
      {/* Enhanced darker blue blurred backdrop */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950/98 via-blue-950/98 to-slate-950/98 backdrop-blur-2xl after:absolute after:inset-0 after:bg-blue-950/30" />
      
      {/* Content container with glass effect */}
      <div 
        className="relative z-20 flex flex-col items-center justify-center p-8 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-2xl"
        style={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000000
        }}
      >
        {/* Logo and brand name with enhanced animation */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-lg">
            AVRIO
          </h1>
        </motion.div>

        {/* Enhanced loading animation */}
        <div className="relative w-72">
          {/* Animated bars with glow effect */}
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ 
                  height: [40, 64, 40], 
                  opacity: [0.5, 1, 0.5] 
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
                className="flex-1 bg-gradient-to-t from-red-500 via-pink-500 to-purple-500 rounded-full shadow-lg shadow-red-500/20"
                style={{
                  filter: 'brightness(1.2) contrast(1.1)',
                }}
              />
            ))}
          </div>

          {/* Enhanced progress bar */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48">
            <div className="h-1.5 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "linear"
                }}
                className="h-full w-1/2 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 rounded-full glow-effect"
              />
            </div>
          </div>
        </div>

        {/* Enhanced loading text */}
        <div className="mt-12 space-y-3 text-center">
          <p className="text-blue-900 text-sm font-medium tracking-wide px-8 whitespace-nowrap">
            Loading amazing things...
          </p>
          <div className="flex items-center justify-center gap-2">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
                className="w-2 h-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full shadow-lg shadow-red-500/50"
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
} 