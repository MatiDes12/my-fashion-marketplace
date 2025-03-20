import { motion } from 'framer-motion';

interface FloatingGradientProps {
  color1?: string;
  color2?: string;
  duration?: number;
  className?: string;
}

const FloatingGradient: React.FC<FloatingGradientProps> = ({
  color1 = "rgba(239, 68, 68, 0.2)",
  color2 = "rgba(236, 72, 153, 0.2)",
  duration = 8,
  className = ""
}) => {
  return (
    <motion.div
      className={`absolute pointer-events-none mix-blend-overlay blur-3xl ${className}`}
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 180, 360],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear"
      }}
      style={{
        background: `radial-gradient(circle, ${color1} 0%, ${color2} 100%)`,
        width: '40%',
        aspectRatio: '1',
      }}
    />
  );
};

export default FloatingGradient; 