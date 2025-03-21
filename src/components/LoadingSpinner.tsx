import { motion } from 'framer-motion';

export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
    </div>
  );
} 