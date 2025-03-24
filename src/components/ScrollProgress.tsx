'use client';

import { motion, useScroll as useScrollMotion, useSpring } from 'framer-motion';

const ScrollProgress = () => {
  const { scrollYProgress } = useScrollMotion();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-pink-500 origin-left z-[100]"
      style={{ 
        scaleX,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        transformOrigin: '0%',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
      }}
    />
  );
};

export default ScrollProgress; 